
const app = require('./app');
const pool = require('./db');

// Kiểm tra kết nối DB khi khởi động server
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Kết nối database thành công');
    app.listen(3004, () => {
      console.log('Transaction service listening on port 3004');
    });
  })
  .catch((err) => {
    console.error('❌ Kết nối thất bại',err);
    process.exit(1);
  });
