const request = require('supertest');
const app = require('../index');
const pool = require('../db');
const bcrypt = require('bcrypt');

jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] })
}));
jest.mock('bcrypt');


describe('POST /register', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if missing fields', async () => {
    const res = await request(app)
      .post('/register')
      .send({ name: 'Giang', phone_number: '011'});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Thiếu thông tin đăng ký');
  });

  it('should return 400 if phone number already exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, phone_number: '0123' }] });

    const res = await request(app)
      .post('/register')
      .send({ name: 'Giang', phone_number: '0123', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Số điện thoại đã tồn tại');
  });

  it('should create user if valid data', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT check trống
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Giang', phone_number: '0123' }] }); // INSERT trả về user

    bcrypt.hash.mockResolvedValueOnce('hashed_pw');

    const res = await request(app)
      .post('/register')
      .send({ name: 'Giang', phone_number: '0123', password: '123456' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Đăng ký thành công');
    expect(res.body.user).toEqual({ id: 1, name: 'Giang', phone_number: '0123' });

    expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);
  });

  it('should return 500 if DB error', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB connection failed'));

    const res = await request(app)
      .get('/test-db')
      .send({ name: 'Giang', phone_number: '0999', password: 'pass' });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('DB connection failed');
  });
});
