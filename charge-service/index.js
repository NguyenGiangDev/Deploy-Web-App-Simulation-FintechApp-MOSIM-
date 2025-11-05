// ================= Elastic APM Agent =================
// ⚠️ Phải đặt ở dòng đầu tiên!
require('elastic-apm-node').start({
  serviceName: 'charge-service', // Tên service (chỉnh đúng theo từng service)
  serverUrl: 'http://apm-server:8200',
  secretToken: process.env.SECRET_TOKEN,
  environment: process.env.ENVIRONMENT,
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
    service: 'charge-service',
    timestamp: new Date().toISOString()
  });
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

// Nạp tiền
app.post('/charge', async (req, res) => {
  const { username, phone_number, amount } = req.body;

  try {
    const existing = await pool.query(
      'SELECT amount FROM charge WHERE username = $1 AND phone_number = $2',
      [username, phone_number]
    );

    if (existing.rows.length > 0) {
      const currentAmount = parseFloat(existing.rows[0].amount);
      const newAmount = currentAmount + parseFloat(amount);

      await pool.query(
        'UPDATE charge SET amount = $1 WHERE username = $2 AND phone_number = $3',
        [newAmount, username, phone_number]
      );

      return res.json({
        message: 'Nạp tiền thành công',
        balance: { total_amount: newAmount }
      });
    } else {
      await pool.query(
        'INSERT INTO charge (username, phone_number, amount) VALUES ($1, $2, $3)',
        [username, phone_number, amount]
      );

      return res.json({
        message: 'Nạp tiền thành công',
        balance: { amount: parseFloat(amount) }
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi khi xử lý yêu cầu nạp tiền' });
  }
});

// Lấy tổng số dư
app.post('/get-balance', async (req, res) => {
  const { username, phone_number } = req.body;
  try {
    const result = await pool.query(
      'SELECT amount AS balance FROM charge WHERE username = $1 AND phone_number = $2',
      [username, phone_number]
    );

    const balance = parseFloat(result.rows[0]?.balance) || 0;
    res.json({ balance });
  } catch (err) {
    console.error('Lỗi khi truy vấn PostgreSQL:', err);
    res.status(500).json({ error: 'Không thể lấy số dư' });
  }
});

// Kiểm tra số dư
app.post('/api/check-balance', async (req, res) => {
  const { username, phone_number, amount } = req.body;
  try {
    const result = await pool.query(
      'SELECT amount AS balance FROM charge WHERE username = $1 AND phone_number = $2',
      [username, phone_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng', flag: false });
    }

    const balance = parseFloat(result.rows[0].balance);

    if (balance >= amount) {
      return res.json({ message: 'Số dư đủ để thực hiện giao dịch', flag: true });
    } else {
      return res.status(400).json({ message: 'Số dư không đủ để thực hiện giao dịch', flag: false });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Lỗi server', flag: false });
  }
});

// Trừ tiền người gửi
app.post('/api/transfer-money', async (req, res) => {
  const { from_user, from_phone_number, amount } = req.body;

  try {
    const result = await pool.query(
      'UPDATE charge SET amount = amount - $1 WHERE username = $2 AND phone_number = $3 RETURNING amount',
      [amount, from_user, from_phone_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Người gửi không tồn tại' });
    }

    return res.json({ success: true, remaining: result.rows[0].amount });
  } catch (err) {
    console.error('Lỗi khi trừ tiền:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi trừ tiền' });
  }
});

// Cộng tiền người nhận
app.post('/api/add-money', async (req, res) => {
  const { to_user, to_phone_number, amount } = req.body;

  try {
    const result = await pool.query(
      'UPDATE charge SET amount = amount + $1 WHERE username = $2 AND phone_number = $3 RETURNING amount',
      [amount, to_user, to_phone_number]
    );

    if (result.rows.length === 0) {
       await pool.query(
        'INSERT INTO charge (username, phone_number, amount) VALUES ($1, $2, $3)',
        [to_user, to_phone_number, amount]
      );
      return res.json({success:true, new_balance: amount});
    }

    return res.json({ success: true, new_balance: result.rows[0].amount });
  } catch (err) {
    console.error('Lỗi khi cộng tiền:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cộng tiền' });
  }
});

// Rollback: hoàn tiền lại cho người gửi
app.post('/api/rollback', async (req, res) => {
  const { from_user, from_phone_number, amount } = req.body;

  try {
    const result = await pool.query(
      'UPDATE charge SET amount = amount + $1 WHERE username = $2 AND phone_number = $3 RETURNING amount',
      [amount, from_user, from_phone_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Người gửi không tồn tại để rollback' });
    }

    return res.json({ success: true, restored_amount: result.rows[0].amount });
  } catch (err) {
    console.error('Lỗi rollback:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi rollback' });
  }
});

// Khởi động server
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Kết nối database thành công');
    app.listen(3002, () => {
      console.log('Charge service listening on port 3002');
    });
  })
  .catch((err) => {
    console.error('❌ Kết nối database thất bại:', err.message);
    process.exit(1);
  });
