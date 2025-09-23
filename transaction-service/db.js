const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  user: "postgres",
  password: process.env.DB_PASSWORD,
  database: "wallet_transaction",
  ssl: {
    rejectUnauthorized: false   // bắt buộc để bỏ qua check cert khi connect RDS
  }
});

// Expose pool để các module khác có thể sử dụng
module.exports = pool;
