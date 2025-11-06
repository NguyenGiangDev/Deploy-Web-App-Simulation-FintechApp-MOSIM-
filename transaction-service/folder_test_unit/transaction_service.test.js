const express = require('express');
const axios = require('axios');
const pool = require('./db'); // nếu bạn có kết nối DB
const app = express();

app.use(express.json());

// ---- HEALTH CHECK ----
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', service: 'transaction-service' });
});

// ---- CHUYỂN TIỀN ----
app.post('/transfer', async (req, res) => {
  const payload = req.body;
  try {
    // Gọi đến charge-service (mock trong test)
    const response = await axios.post('/api/transfer-between-accounts', payload);

    const { success, message } = response.data;

    if (!success) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(200).json({ success: true, message: 'Chuyển tiền thành công' });
  } catch (err) {
    console.error('Lỗi khi gọi charge-service:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
});

// ---- TEST DB ----
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ now: result.rows[0].now });
  } catch (err) {
    console.error('Lỗi DB:', err.message);
    res.status(500).json({ error: 'Lỗi kết nối DB' });
  }
});

module.exports = app;
