// ================= Elastic APM Agent =================
// ⚠️ Phải đặt ở dòng đầu tiên!
require('elastic-apm-node').start({
  serviceName: 'history-service', // Tên service (chỉnh đúng theo từng service)
  serverUrl: 'http://apm-server.argocd.svc.cluster.local:8200',
  secretToken: 'XyZ123!@#secureToken456',
  environment: process.env.NODE_ENV || 'production',
  captureBody: 'all',
  captureHeaders: true,
  active: true,
});

const express = require('express');
const app = express();
const pool = require('./db');
require('dotenv').config();
app.use(express.json());

// ===============API End point================
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'history-service',
    timestamp: new Date().toISOString()
  });
});

// Khởi động server history service
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Kết nối database history thành công');
    app.listen(3003, () => {
      console.log('Charge service listening on port 3003');
    });
  })
  .catch((err) => {
    console.error('❌ Kết nối database thất bại', err);
    process.exit(1);
  });


// Kiểm tra kết nối DB
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send('DB connection failed');
  }
});

// Thêm lịch sử giao dịch
app.post('/add-history', async (req, res) => {
  const { amount, username, phone_number, bank, transaction_time } = req.body;
  console.log('Kiểm tra transaction_time:', transaction_time);
  try {
    await pool.query(
      'INSERT INTO history (amount, username, phone_number, bank, transaction_time) VALUES ($1, $2, $3, $4, $5)',
      [amount, username, phone_number, bank, transaction_time]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Lỗi khi thêm lịch sử giao dịch', err);
    res.status(500).json({ error: 'Lỗi khi thêm lịch sử giao dịch' });
  }
});


// Lấy lịch sử giao dịch theo username và phone_number
app.post('/history', async (req, res) => {
    const { username, phone_number } = req.body;
    try {
        const result = await pool.query(
            `SELECT
                amount,
                transaction_time,
                'Nạp tiền' as type,
                'Nạp tiền vào ví từ ' || bank as description
            FROM history
            WHERE username = $1 AND phone_number = $2
            ORDER BY transaction_time DESC`,
            [username, phone_number]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Lỗi khi lấy lịch sử nạp tiền:', err);
        res.status(500).json({ error: 'Lỗi server khi lấy lịch sử nạp tiền' });
    }
});


