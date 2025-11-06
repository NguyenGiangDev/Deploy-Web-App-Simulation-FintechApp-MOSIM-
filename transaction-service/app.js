// transaction-service/app.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// DB pool cho transaction-service (ghi lịch sử giao dịch)
const pool = new Pool({
  connectionString: process.env.TRANSACTION_DATABASE_URL,
  max: parseInt(process.env.DB_MAX_CONN || '10', 10)
});

// Axios instance with keep-alive and timeouts
const axiosInstance = axios.create({
  baseURL: process.env.CHARGE_SERVICE_URL || 'http://charge-service:3002',
  timeout: 5000,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

// retry helper
async function safePost(url, data, retries = 3, backoff = 150) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await axiosInstance.post(url, data);
    } catch (err) {
      lastErr = err;
      // if final try -> throw
      if (i === retries - 1) break;
      // small backoff
      await new Promise(r => setTimeout(r, backoff * (i + 1)));
    }
  }
  throw lastErr;
}

// Health
app.get('/healthz', (req, res) => res.json({ status: 'ok', service: 'transaction-service', ts: new Date().toISOString() }));

// Transfer: call charge-service single endpoint then persist transaction log
app.post('/transfer', async (req, res) => {
  const { from_user, to_user, from_phone_number, to_phone_number, amount, transaction_realtime } = req.body;
  if (!from_user || !to_user || !from_phone_number || !to_phone_number || !amount) {
    return res.status(400).json({ success: false, message: 'Thiếu tham số' });
  }

  try {
    // 1) Call charge-service atomic transfer
    const chargeResp = await safePost('/api/transfer-between-accounts', {
      from_user, from_phone_number, to_user, to_phone_number, amount
    });

    if (!chargeResp.data || !chargeResp.data.success) {
      return res.status(400).json({ success: false, message: chargeResp.data?.message || 'Không thể chuyển tiền' });
    }

    // 2) Persist transaction log (non-blocking pattern: ensure log but keep simple)
    try {
      await pool.query(
        'INSERT INTO transactions (from_user, to_user, from_phone_number, to_phone_number, amount, transaction_realtime) VALUES ($1,$2,$3,$4,$5,$6)',
        [from_user, to_user, from_phone_number, to_phone_number, amount, transaction_realtime || new Date()]
      );
    } catch (logErr) {
      // Logging failed: we already completed money transfer on charge-service.
      // Optionally: raise alert, write to fallback log, or retry persisting.
      console.error('[transaction-service] Failed to write transaction log:', logErr);
      // We still return success, but inform that log failed.
      return res.status(200).json({ success: true, warning: 'Giao dịch thành công nhưng ghi log thất bại' });
    }

    return res.json({ success: true, message: 'Chuyển tiền thành công', details: chargeResp.data });
  } catch (err) {
    console.error('[transaction-service] transfer error:', err?.response?.data || err.message || err);
    const status = err?.response?.status || 500;
    const message = err?.response?.data?.message || 'Lỗi hệ thống khi chuyển tiền';
    return res.status(status).json({ success: false, message });
  }
});


// Lấy lịch sử chuyển tiền
app.post('/get-transaction-history', async (req, res) => {
  const { phone_number } = req.body;

  try {
    const result = await pool.query(`
      SELECT
        amount,
        transaction_realtime as transaction_time,
        CASE
          WHEN from_phone_number = $1 THEN 'Chuyển tiền'
          ELSE 'Nhận tiền'
        END as type,
        CASE
          WHEN from_phone_number = $1 THEN 'Chuyển tiền tới ' || to_user
          ELSE 'Nhận tiền từ ' || from_user
        END as description
      FROM transactions
      WHERE from_phone_number = $1 OR to_phone_number = $1
      ORDER BY transaction_realtime DESC
    `, [phone_number]);

    res.json(result.rows);
  } catch (err) {
    console.error('Lỗi khi lấy lịch sử chuyển tiền:', err);
    res.status(500).json({ error: 'Lỗi server khi lấy lịch sử chuyển tiền' });
  }
});


// Kiểm tra kết nối DB qua API
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'DB connection failed' });
  }
});


module.exports = app;