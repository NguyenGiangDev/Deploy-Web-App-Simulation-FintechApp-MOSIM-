// ================= Elastic APM Agent =================
require('elastic-apm-node').start({
  serviceName: 'api-gateway', 
  serverUrl: 'http://apm-server:8200',
  secretToken: process.env.SECRET_TOKEN,
  environment: process.env.ENVIRONMENT,
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
