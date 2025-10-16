// ================= Elastic APM Agent =================
// ⚠️ Phải đặt ở dòng đầu tiên!
require('elastic-apm-node').start({
  serviceName: 'api-gateway', // Tên service (chỉnh đúng theo từng service)
  serverUrl: 'http://apm-server.argocd.svc.cluster.local:8200',
  secretToken: 'XyZ123!@#secureToken456',
  environment: process.env.NODE_ENV || 'production',
  captureBody: 'all',
  captureHeaders: true,
  active: true,
});
// Require các module cần thiết
const app = require('./API_Gateway')




// Khởi động server api-gateway lắng nghe trên cổng 3000
app.listen(3000, () => {
  console.log('API Gateway listening on port 3000');
});
