// Set biến môi trường trước khi require app
process.env.ENV_FRONTEND_URL = 'http://mock-frontend.com';
process.env.AUTH_SERVICE_URL = 'http://auth-service:3001';
process.env.CHARGE_SERVICE_URL = 'http://charge-service:3002';
process.env.HISTORY_SERVICE_URL = 'http://history-service:3003';
process.env.TRANSACTION_SERVICE_URL = 'http://transaction-service:3004';

const request = require('supertest');
const app = require('../API_Gateway'); 
const axios = require('axios');

// Mock axios để không gọi thật ra ngoài
jest.mock('axios');

describe('API Gateway routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /register - password mismatch', async () => {
    const res = await request(app)
      .post('/register')
      .send({ fullname: 'A', phone: '123', password: '1', confirmPassword: '2' });

    expect(res.status).toBe(400);
    expect(res.text).toContain('Mật khẩu không khớp');
  });

  test('POST /register - success', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });

    const res = await request(app)
      .post('/register')
      .send({ fullname: 'A', phone: '123', password: '1', confirmPassword: '1' });

    expect(res.status).toBe(302); // redirect
    expect(res.headers.location).toBe('http://mock-frontend.com/Login.html');
    expect(axios.post).toHaveBeenCalledWith(
      'http://auth-service:3001/register',
      { name: 'A', phone_number: '123', password: '1' }
    );
  });

  test('POST /login - success', async () => {
    axios.post.mockResolvedValueOnce({
      data: { user: { name: 'Test', phone_number: '999' } }
    });

    const res = await request(app)
      .post('/login')
      .send({ phone_number: '999', password: 'abc' });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('http://mock-frontend.com/Dashboard.html');
  });

  test('POST /api/deposit - success', async () => {
    axios.post.mockResolvedValueOnce({ data: { balance: 1000 } });

    const res = await request(app)
      .post('/api/deposit')
      .send({ amount: 100, username: 'A', phone_number: '123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Nạp tiền thành công', balance: 1000 });
    expect(axios.post).toHaveBeenCalledWith(
      'http://charge-service:3002/charge',
      { amount: 100, username: 'A', phone_number: '123' }
    );
  });

  test('POST /api/get-balance - success', async () => {
    axios.post.mockResolvedValueOnce({ data: { balance: 500 } });

    const res = await request(app)
      .post('/api/get-balance')
      .send({ username: 'A', phone_number: '123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ balance: 500 });
  });
});
