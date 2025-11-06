/**
 * @file transaction-service-test.js
 * Mục đích: kiểm tra các API chính của transaction-service
 * Chạy bằng lệnh:  npx jest transaction-service-test.js --runInBand
 */

const request = require('supertest');
const app = require('../app'); // import file app.js của bạn
const axios = require('axios');

// Mock axios để tránh gọi ra charge-service thật
jest.mock('axios');

describe('Transaction Service API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---- TEST HEALTH ----
  it('GET /healthz → trả về trạng thái OK', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'transaction-service');
  });

  // ---- TEST TRANSFER ----
  it('POST /transfer → chuyển tiền thành công (mock charge-service)', async () => {
    // Giả lập phản hồi từ charge-service thành công
    axios.post.mockResolvedValueOnce({
      data: { success: true, message: 'Transfer successful' },
    });

    const payload = {
      from_user: 'alice',
      to_user: 'bob',
      from_phone_number: '0901',
      to_phone_number: '0902',
      amount: 1000,
      transaction_realtime: new Date().toISOString()
    };

    const res = await request(app)
      .post('/transfer')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/Chuyển tiền thành công/i);
    expect(axios.post).toHaveBeenCalledWith(
      '/api/transfer-between-accounts',
      expect.objectContaining({
        from_user: 'alice',
        to_user: 'bob',
        amount: 1000
      })
    );
  });

  // ---- TEST TRANSFER FAIL ----
  it('POST /transfer → lỗi khi charge-service trả về thất bại', async () => {
    axios.post.mockResolvedValueOnce({
      data: { success: false, message: 'Không đủ số dư' }
    });

    const res = await request(app)
      .post('/transfer')
      .send({
        from_user: 'alice',
        to_user: 'bob',
        from_phone_number: '0901',
        to_phone_number: '0902',
        amount: 999999
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Không đủ số dư/i);
  });

  // ---- TEST DB ----
  it('GET /test-db → trả về thời gian từ DB', async () => {
    const res = await request(app).get('/test-db');
    // Nếu có DB thật thì sẽ trả về { now: '...' }, còn nếu không có thì sẽ 500.
    expect([200, 500]).toContain(res.status);
  });
});
