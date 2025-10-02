// Require các module cần thiết
const app = require('./API_Gateway')




// Khởi động server api-gateway lắng nghe trên cổng 3000
app.listen(3000, () => {
  console.log('API Gateway listening on port 3000');
});
