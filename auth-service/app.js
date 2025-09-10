const express = require('express');
const bcrypt = require('bcrypt');
const app = express();
const pool = require('./db');
require('dotenv').config();

app.use(express.json());

// Đăng ký người dùng
app.post('/register', async (req, res) => {
  const { name, phone_number, password } = req.body;
  try {
    if (!name || !phone_number || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin đăng ký' });
    }

    // Kiểm tra số điện thoại đã tồn tại
    const existing = await pool.query(
      'SELECT * FROM users WHERE phone_number = $1',
      [phone_number]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Thêm người dùng vào cơ sở dữ liệu
    const newUser = await pool.query(
      'INSERT INTO users (name, phone_number, password) VALUES ($1, $2, $3) RETURNING id, name, phone_number',
      [name, phone_number, hashedPassword]
    );

    res.status(201).json({
      message: 'Đăng ký thành công',
      user: newUser.rows[0]
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Đăng nhập người dùng
app.post('/login', async (req, res) => {
  const { phone_number, password } = req.body;
  try {
    // Tìm người dùng theo số điện thoại
    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone_number = $1',
      [phone_number]
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Sai số điện thoại hoặc mật khẩu' });
    }

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Sai số điện thoại hoặc mật khẩu' });
    }

    res.json({
      message: 'Đăng nhập thành công',
      user: {
        id: user.id,
        name: user.name,
        phone_number: user.phone_number
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Xác nhận người dùng (cho việc chuyển tiền)
app.post('/confirm-user', async (req, res) => {
  const { phone_number } = req.body;
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone_number = $1',
      [phone_number]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Người dùng không tồn tại !!' });
    }

    const user = userResult.rows[0];
    res.json({
      message: 'Xác nhận người dùng thành công.',
      name: user.name
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xác nhận người dùng.' });
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