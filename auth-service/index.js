// index.js
const app = require('./app');
const pool = require('./db');

const PORT = process.env.PORT || 3001;

// Kiểm tra kết nối DB trước khi start server
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Kết nối database thành công');
    app.listen(PORT, () => {
      console.log(`Auth service listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Kết nối database thất bại:', err.message);
    process.exit(1);
  });
