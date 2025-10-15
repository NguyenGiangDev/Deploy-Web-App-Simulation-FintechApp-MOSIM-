const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const pool = require('./db');

// Load biến môi trường từ .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

app.use(express.json());

// ================= Elastic APM Agent =================
require('elastic-apm-node').start({
  serviceName: 'transaction-service',
  serverUrl: 'http://apm-server.monitoring.svc.cluster.local:8200',
  secretToken:  'XyZ123!@#secureToken456',
  environment: process.env.NODE_ENV || 'production',
  captureBody: 'all',
  captureHeaders: true,
  active: true,
});

// ===============API End point================
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'transaction-service',
    timestamp: new Date().toISOString()
  });
});




// Lấy URL charge-service từ biến môi trường
const CHARGE_SERVICE_URL = process.env.CHARGE_SERVICE_URL || "http://charge-service:3002";


// Chuyển tiền
app.post('/transfer', async (req, res) => {
  const { from_user, to_user, from_phone_number, to_phone_number, amount, transaction_realtime } = req.body;
  try {
    // 1. Kiểm tra số dư
    const balanceRes = await axios.post(`${CHARGE_SERVICE_URL}/api/check-balance`, {
      username: from_user,
      phone_number: from_phone_number,
      amount
    });

    if (!balanceRes.data.flag) {
      return res.status(400).json({ success: false, error: 'Số dư không đủ để chuyển tiền.' });
    }

    // 2. Trừ tiền người gửi
    const deductRes = await axios.post(`${CHARGE_SERVICE_URL}/api/transfer-money`, {
      from_user,
      from_phone_number,
      amount
    });

    if (!deductRes.data.success) {
      return res.status(500).json({ success: false, error: 'Lỗi khi trừ tiền người gửi.' });
    }

    // 3. Cộng tiền người nhận
    const addRes = await axios.post(`${CHARGE_SERVICE_URL}/api/add-money`, {
      to_user,
      to_phone_number,
      amount
    });

    if (!addRes.data.success) {
      // ❌ Rollback: Cộng lại tiền cho người gửi
      await axios.post(`${CHARGE_SERVICE_URL}/api/rollback`, {
        from_user,
        from_phone_number,
        amount
      });

      return res.status(500).json({ success: false, error: 'Lỗi khi cộng tiền cho người nhận. Đã rollback.' });
    }

    // 4. Lưu vào DB
    try {
      await pool.query(
        'INSERT INTO transactions (from_user, to_user, from_phone_number, to_phone_number, amount, transaction_realtime) VALUES ($1, $2, $3, $4, $5, $6)',
        [from_user, to_user, from_phone_number, to_phone_number, amount, transaction_realtime]
      );
    } catch (dbErr) {
      // ❌ Rollback cả 2 bước:
      // 4.1 Trừ người nhận lại
      await axios.post(`${CHARGE_SERVICE_URL}/api/transfer-money`, {
        from_user: to_user,
        from_phone_number: to_phone_number,
        amount
      });

      // 4.2 Cộng lại cho người gửi
      await axios.post(`${CHARGE_SERVICE_URL}/api/add-money`, {
        to_user: from_user,
        to_phone_number: from_phone_number,
        amount
      });

      console.error('Lỗi khi ghi DB, đã rollback:', dbErr);
      return res.status(500).json({ success: false, error: 'Lỗi khi ghi log giao dịch. Đã rollback.' });
    }

    return res.json({ success: true, message: 'Chuyển tiền thành công.' });

  } catch (err) {
    console.error('Lỗi hệ thống khi xử lý chuyển tiền:', err);
    return res.status(500).json({ success: false, error: 'Lỗi hệ thống.' });
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