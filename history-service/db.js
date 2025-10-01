const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  user: "postgres",  
  password: process.env.DB_PASSWORD,
  database: "wallet_history",
  ssl: {
    rejectUnauthorized: false   // bắt buộc để bỏ qua check cert khi connect RDS
  }
});
// export để tái sử dụng trong file index.js
module.exports = pool;
