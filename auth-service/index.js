const express = require('express');
const bcrypt = require('bcrypt');
const app = express();
const pool = require('./db');
require('dotenv').config();

// Middler ware để parse JSON BODY
app.use(express.json());

// Đăng ký
app.post('/register', async (req, res) => {
  console.log('Received body:', req.body);
  const { name, phone_number, password } = req.body;

  try {
    if (!name || !phone_number || !password) {
  return res.status(400).json({ message: 'Thiếu thông tin đăng ký' });
}

    // Kiểm tra trùng số điện thoại
    const existing = await pool.query(
      'SELECT * FROM users WHERE phone_number = $1',
      [phone_number]
    );
    console.log('Rows from DB:', existing.rows);  
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Thêm user vào Database vào DB
    const newUser = await pool.query(
      'INSERT INTO users (name, phone_number, password) VALUES ($1, $2, $3) RETURNING id, name, phone_number',
      [name, phone_number, hashedPassword]
    );

    res.status(201).json({
      message: 'Đăng ký thành công',    
      user: newUser.rows[0]
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Đăng nhập
app.post('/login', async (req, res) => {
   console.log('Received body:', req.body);
  const { phone_number, password } = req.body;

  try {
    // Tìm người dùng
    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone_number = $1',
      [phone_number]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Sai số điện thoại hoặc mật khẩu' });
    }

    const user = userResult.rows[0];

    // So sánh mật khẩu
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
    res.status(500).send(err.message);
  }
});

// Xác nhận người dùng (Cho việc chuyển tiền)
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

    // Lấy user từ kết quả truy vấn
    const user = userResult.rows[0];

    res.json({
      message: 'Xác nhận người dùng thành công.',
      name: user.name // hoặc user.username nếu cột là username
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi xác nhận người dùng.' });
  }
});

// Kiểm tra kết nối DB thủ công qua API
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send('DB connection failed');
  }
});

// Kiểm tra kết nối DB khi khởi động server
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Kết nối database thành công');
    app.listen(3001, () => {
      console.log('Auth service listening on port 3001');
    });
  })
  .catch((err) => {
    console.error('❌ Kết nối database thất bại:', err.message);
    process.exit(1); // Dừng server nếu không kết nối được
  });

  module.exports = app