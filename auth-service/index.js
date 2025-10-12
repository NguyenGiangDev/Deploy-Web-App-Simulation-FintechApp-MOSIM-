const app = require('./app');
const pool = require('./db');
const client = require('prom-client'); // Prometheus client

const PORT = process.env.PORT || 3001;

// --- Thiết lập Prometheus metrics ---
client.collectDefaultMetrics(); // CPU, memory, event loop

// Endpoint /metrics để Prometheus scrape
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

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
