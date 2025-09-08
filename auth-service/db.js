const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false   // bắt buộc để bỏ qua check cert khi connect RDS
  }
});

// export để tái sử dụng trong file index.js
module.exports = pool;
