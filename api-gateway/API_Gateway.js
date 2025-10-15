const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const winston = require('winston');

const app = express();
// ================= Elastic APM Agent =================
require('elastic-apm-node').start({
  serviceName: 'api-gateway',
  serverUrl: 'http://apm-server.monitoring.svc.cluster.local:8200',
  secretToken:  'XyZ123!@#secureToken456',
  environment: process.env.NODE_ENV || 'production',
  captureBody: 'all',
  captureHeaders: true,
  active: true,
});
// ================= Logger setup =================
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'local' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [ new winston.transports.Console() ]
});

// Morgan middleware to log HTTP requests
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));

// ================= Load env =================
dotenv.config({ path: path.join(__dirname, '..', '.env') });

if (process.env.NODE_ENV === 'local') {
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
  logger.info("Loaded local env");
} else if (process.env.NODE_ENV === 'docker') {
  dotenv.config({ path: path.join(__dirname, '..', '.env.docker') });
  logger.info("Loaded docker env");
} else {
  logger.info("Loaded default .env");
}


const ENV_FRONTEND_URL = process.env.ENV_FRONTEND_URL;
logger.info("Front-end kiểm tra URL:", { ENV_FRONTEND_URL });

// ================= Service URLs =================
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
const CHARGE_SERVICE_URL = process.env.CHARGE_SERVICE_URL || "http://charge-service:3002";
const HISTORY_SERVICE_URL = process.env.HISTORY_SERVICE_URL || "http://history-service:3003";
const TRANSACTION_SERVICE_URL = process.env.TRANSACTION_SERVICE_URL || "http://transaction-service:3004";

//-----Thêm endpoint để cập nhật dữ liệu cho heartbeat----
app.get('/healthz', async (req, res) => {
  const services = { auth: AUTH_SERVICE_URL, charge: CHARGE_SERVICE_URL, history: HISTORY_SERVICE_URL, transaction: TRANSACTION_SERVICE_URL };
  const results = {};
  let allOk = true;

  for (const [name, url] of Object.entries(services)) {
    try {
      await axios.get(url);
      results[name] = 'ok';
    } catch (err) {
      results[name] = 'unreachable';
      allOk = false;
    }
  }

  res.status(allOk ? 200 : 500).json({
    gateway: 'ok',
    services: results,
    service: 'api-gateway'
  });
});

// ================= Middlewares =================
app.use(cors({
  origin: [ENV_FRONTEND_URL],
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'Public')));

// ================= Routes =================

// --- Đăng ký ---
app.post('/register', async (req, res) => {
  const { fullname, phone, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    logger.warn('Mật khẩu không khớp', { phone, fullname });
    return res.status(400).send('Mật khẩu không khớp');
  }

  try {
    logger.info('Calling auth-service /register', { phone, fullname });
    await axios.post(`${AUTH_SERVICE_URL}/register`, { name: fullname, phone_number: phone, password });

    const loginUrl = `${ENV_FRONTEND_URL}/Login.html`;
    logger.info('Register success, redirecting', { redirect: loginUrl });
    res.redirect(loginUrl);

  } catch (err) {
    logger.error('Register error', { message: err.message, stack: err.stack, response: err.response?.data });
    if (err.response) {
      res.status(err.response.status).send(err.response.data.message || 'Lỗi từ auth_service');
    } else {
      res.status(500).send('API Gateway error');
    }
  }
});

// --- Đăng nhập ---
app.post('/login', async (req, res) => {
  const { phone_number, password } = req.body;

  try {
    logger.info('Calling auth-service /login', { phone_number });
    const response = await axios.post(`${AUTH_SERVICE_URL}/login`, { phone_number, password });

    const { name, phone_number: phone } = response.data.user;
    const dashboardUrl = `${ENV_FRONTEND_URL}/Dashboard.html?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`;
    logger.info('Login success, redirecting', { redirect: dashboardUrl });
    res.redirect(dashboardUrl);

  } catch (err) {
    logger.error('Login error', { message: err.message, stack: err.stack, response: err.response?.data });
    if (err.response) {
      res.status(err.response.status).json({ message: err.response.data });
    } else if (err.request) {
      res.status(500).json({ message: 'Không thể kết nối tới auth-service' });
    } else {
      res.status(500).json({ message: 'Lỗi không xác định tại API Gateway' });
    }
  }
});

// --- Nạp tiền ---
app.post('/api/deposit', async (req, res) => {
  const { amount, username, phone_number } = req.body;
  logger.info('Deposit request', { username, phone_number, amount });

  try {
    const response = await axios.post(`${CHARGE_SERVICE_URL}/charge`, { amount, username, phone_number });
    logger.info('Deposit success', { username, balance: response.data.balance });
    res.json({ message: 'Nạp tiền thành công', balance: response.data.balance });

  } catch (err) {
    logger.error('Deposit error', { username, message: err.message, stack: err.stack, response: err.response?.data });
    if (err.response) {
      res.status(err.response.status).json({ message: err.response.data });
    } else {
      res.status(500).json({ message: 'Không thể kết nối tới charge-service' });
    }
  }
});

// --- Lấy số dư ---
app.post('/api/get-balance', async (req, res) => {
  const { username, phone_number } = req.body;
  logger.info('Get balance request', { username, phone_number });

  try {
    const response = await axios.post(`${CHARGE_SERVICE_URL}/get-balance`, { username, phone_number });
    logger.info('Get balance success', { username, balance: response.data.balance });
    res.json(response.data);

  } catch (err) {
    logger.error('Get balance error', { username, message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Không thể lấy số dư từ charge-service' });
  }
});

// --- Thêm lịch sử ---
app.post('/api/add-history', async (req, res) => {
  const { amount, username, phone_number, bank, transaction_time } = req.body;
  logger.info('Add history request', { username, amount, bank, transaction_time });

  try {
    const response = await axios.post(`${HISTORY_SERVICE_URL}/add-history`, { amount, username, phone_number, bank, transaction_time });
    logger.info('Add history success', { username });
    res.json(response.data);

  } catch (err) {
    logger.error('Add history error', { username, message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Không thể lấy dữ liệu từ history-service' });
  }
});

// --- Lấy lịch sử giao dịch tổng hợp ---
app.post('/api/get-combined-history', async (req, res) => {
  const { username, phone_number } = req.body;
  logger.info('Get combined history request', { username });

  try {
    const [depositHistoryRes, transferHistoryRes] = await Promise.all([
      axios.post(`${HISTORY_SERVICE_URL}/history`, { username, phone_number }),
      axios.post(`${TRANSACTION_SERVICE_URL}/get-transaction-history`, { phone_number }).catch(e => ({ data: [] }))
    ]);

    const combinedHistory = [...depositHistoryRes.data, ...transferHistoryRes.data];
    combinedHistory.sort((a, b) => new Date(b.transaction_time) - new Date(a.transaction_time));

    logger.info('Get combined history success', { username, totalRecords: combinedHistory.length });
    res.json(combinedHistory);

  } catch (err) {
    logger.error('Get combined history error', { username, message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Không thể lấy lịch sử tổng hợp' });
  }
});

// --- Xác nhận người dùng ---
app.post('/api/confirm-user', async (req, res) => {
  const { phone_number } = req.body;
  logger.info('Confirm user request', { phone_number });

  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/confirm-user`, { phone_number });
    logger.info('Confirm user success', { phone_number });
    res.json(response.data);

  } catch (err) {
    logger.error('Confirm user error', { phone_number, message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Không thể xác nhận người dùng từ auth-service' });
  }
});

// --- Chuyển tiền ---
app.post('/api/transfer', async (req, res) => {
  const { from_user, to_user, from_phone_number, to_phone_number, amount, transaction_realtime } = req.body;
  logger.info('Transfer request', { from_user, to_user, amount });

  try {
    const response = await axios.post(`${TRANSACTION_SERVICE_URL}/transfer`, { from_user, to_user, from_phone_number, to_phone_number, amount, transaction_realtime });
    logger.info('Transfer success', { from_user, to_user, amount });
    res.json(response.data);

  } catch (err) {
    logger.error('Transfer error', { from_user, to_user, amount, message: err.message, stack: err.stack });
    res.status(500).json({ error: 'Không thể thực hiện việc chuyển tiền !!' });
  }
});

// ================= Export =================
module.exports = app;
