// ================= Elastic APM Agent =================
// ⚠️ Phải đặt ở dòng đầu tiên!
require('elastic-apm-node').start({
  serviceName: 'charge-service', 
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

// Atomic transfer endpoint: check sender balance, deduct, credit receiver in one DB transaction
app.post('/api/transfer-between-accounts', async (req, res) => {
  const { from_user, from_phone_number, to_user, to_phone_number, amount } = req.body;
  if (!from_user || !from_phone_number || !to_user || !to_phone_number || !amount) {
    return res.status(400).json({ success: false, message: 'Thiếu tham số' });
  }

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock sender row
    const senderRes = await client.query(
      'SELECT amount FROM charge WHERE username=$1 AND phone_number=$2 FOR UPDATE',
      [from_user, from_phone_number]
    );

    if (senderRes.rows.length === 0) {
      // Sender not found
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Người gửi không tồn tại' });
    }

    const senderBalance = parseFloat(senderRes.rows[0].amount);
    if (senderBalance < numericAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Số dư không đủ' });
    }

    // Deduct from sender
    const deductRes = await client.query(
      'UPDATE charge SET amount = amount - $1 WHERE username=$2 AND phone_number=$3 RETURNING amount',
      [numericAmount, from_user, from_phone_number]
    );

    // Add to receiver with upsert (single statement)
    const upsertRes = await client.query(`
      INSERT INTO charge (username, phone_number, amount)
      VALUES ($1, $2, $3)
      ON CONFLICT (username, phone_number)
      DO UPDATE SET amount = charge.amount + EXCLUDED.amount
      RETURNING amount
    `, [to_user, to_phone_number, numericAmount]);

    await client.query('COMMIT');

    return res.json({
      success: true,
      from_remaining: deductRes.rows[0].amount,
      to_new_balance: upsertRes.rows[0].amount
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[charge-service] transfer error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi server khi chuyển tiền' });
  } finally {
    client.release();
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
