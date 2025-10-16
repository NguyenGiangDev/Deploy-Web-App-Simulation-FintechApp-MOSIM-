// ================= Elastic APM Agent =================
// ⚠️ Phải đặt ở dòng đầu tiên!
require('elastic-apm-node').start({
  serviceName: 'auth-service', // Tên service (chỉnh đúng theo từng service)
  serverUrl: 'http://apm-server.argocd.svc.cluster.local:8200',
  secretToken: 'XyZ123!@#secureToken456',
  environment: process.env.NODE_ENV || 'production',
  captureBody: 'all',
  captureHeaders: true,
  active: true,
});

// ================= Service Logic =================
const app = require('./app');
const pool = require('./db');

const PORT = process.env.PORT || 3001;

// --- Kiểm tra kết nối DB trước khi start server ---
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
