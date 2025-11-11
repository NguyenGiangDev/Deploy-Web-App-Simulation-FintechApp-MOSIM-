const request = require('supertest');
const express = require('express');
const app = require('../app'); // import app.js
const axios = require('axios');
const pool = require('../db');

jest.mock('axios');
jest.mock('../db');

describe('Transaction Service API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /transfer', () => {
    it('should fail when balance is insufficient', async () => {
      axios.post.mockResolvedValueOnce({ data: { flag: false } }); // check-balance

      const res = await request(app)
        .post('/transfer')
        .send({
          from_user: 'Alice',
          to_user: 'Bob',
          from_phone_number: '111',
          to_phone_number: '222',
          amount: 100,
          transaction_realtime: '2025-09-05 12:00:00'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Số dư không đủ');
    });

    it('should succeed when all steps are ok', async () => {
      // Mock lần lượt cho các API call
      axios.post
        .mockResolvedValueOnce({ data: { flag: true } })       // check-balance
        .mockResolvedValueOnce({ data: { success: true } })    // transfer-money
        .mockResolvedValueOnce({ data: { success: true } });   // add-money

      pool.query.mockResolvedValueOnce({ rows: [] });          // insert DB

      const res = await request(app)
        .post('/transfer')
        .send({
          from_user: 'Alice',
          to_user: 'Bob',
          from_phone_number: '111',
          to_phone_number: '222',
          amount: 100,
          transaction_realtime: '2025-09-05 12:00:00'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Chuyển tiền thành công');
    });

    it('should rollback when add-money fails', async () => {
      axios.post
        .mockResolvedValueOnce({ data: { flag: true } })       // check-balance
        .mockResolvedValueOnce({ data: { success: true } })    // transfer-money
        .mockResolvedValueOnce({ data: { success: false } })   // add-money fail
        .mockResolvedValueOnce({ data: { success: true } });   // rollback

      const res = await request(app)
        .post('/transfer')
        .send({
          from_user: 'Alice',
          to_user: 'Bob',
          from_phone_number: '111',
          to_phone_number: '222',
          amount: 100,
          transaction_realtime: '2025-09-05 12:00:00'
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('rollback');
    });
  });

  describe('POST /get-transaction-history', () => {
    it('should return transaction history', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { amount: 100, transaction_time: '2025-09-05', type: 'Chuyển tiền', description: 'Chuyển tiền tới Bob' }
        ]
      });

      const res = await request(app)
        .post('/get-transaction-history')
        .send({ phone_number: '111' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].amount).toBe(100);
    });
  });
});

 describe('GET /test-db', () => {
     it('should return current time when DB is connected', async () => {
    const mockTime = { now: '2025-09-05 12:00:00' };
    pool.query.mockResolvedValueOnce({ rows: [mockTime] });

    const res = await request(app).get('/test-db');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTime);
    expect(pool.query).toHaveBeenCalledWith('SELECT NOW()');
  });

  it('should return 500 when DB connection fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/test-db');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('DB connection failed');
  });
});