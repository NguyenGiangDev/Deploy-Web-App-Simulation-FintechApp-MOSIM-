// Require các module cần thiết
const app = require('./API_Gateway')



// Khởi động server auth-service
app.listen(3000, () => {
  console.log('API Gateway listening on port 3000');
});
