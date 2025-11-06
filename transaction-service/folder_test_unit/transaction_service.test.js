const request = require('supertest');
const { Pool } = require('pg');
const axios = require('axios');

// 1. Tạo một hàm mock mà chúng ta có thể kiểm soát cho axios.post
const mockAxiosPost = jest.fn();

// 2. Mock module 'axios'
// Khi app.js gọi axios.create(), chúng ta can thiệp và trả về
// một đối tượng giả có hàm 'post' trỏ đến 'mockAxiosPost'
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: mockAxiosPost,
  })),
}));

// 3. Mock module 'pg'
// Khi app.js gọi new Pool(), nó sẽ nhận được đối tượng mockPool
// Tên biến bắt đầu bằng 'mock' để tránh lỗi 'ReferenceError' của Jest
const mockPool = {
  query: jest.fn(),
};
jest.mock('pg', () => {
  return { Pool: jest.fn(() => mockPool) };
});

// 4. Nạp 'app' SAU KHI đã thiết lập các mock
// Đảm bảo đường dẫn này trỏ đúng đến file app.js của bạn
// Giả sử file test này nằm trong 'folder_test_unit' và app.js ở thư mục cha
const app = require('../app'); 

describe('Transaction Service Tests', () => {
  let pool;

  beforeEach(() => {
    // Lấy đối tượng pool đã được mock
    pool = new Pool();
    
    // Xóa lịch sử gọi của tất cả các mock trước mỗi test
    jest.clearAllMocks();
    mockAxiosPost.mockClear();
  });

  describe('GET /healthz', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/healthz');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'transaction-service');
      expect(response.body).toHaveProperty('ts');
    });
  });

  describe('POST /transfer', () => {
    const validTransferData = {
      from_user: 'user1',
      to_user: 'user2',
      from_phone_number: '1234567890',
      to_phone_number: '0987654321',
      amount: 100
    };

    it('should handle successful transfer', async () => {
      // Giả lập charge-service thành công
      mockAxiosPost.mockResolvedValue({
        data: { success: true, message: 'Transfer successful' }
      });

      // Giả lập ghi DB thành công
      pool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/transfer')
        .send(validTransferData);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Chuyển tiền thành công');
      // Kiểm tra xem service đã gọi đúng các mock chưa
      expect(mockAxiosPost).toHaveBeenCalledWith('/api/transfer-between-accounts', {
        from_user: 'user1',
        from_phone_number: '1234567890',
        to_user: 'user2',
        to_phone_number: '0987654321',
        amount: 100
      });
      expect(pool.query).toHaveBeenCalled();
    });

    it('should handle missing parameters', async () => {
      const invalidData = { from_user: 'user1' }; // Thiếu trường

      const response = await request(app)
        .post('/transfer')
        .send(invalidData);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Thiếu tham số');
      // Đảm bảo không gọi service hay DB
      expect(mockAxiosPost).not.toHaveBeenCalled();
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should handle charge service failure (e.g., insufficient funds)', async () => {
      // Giả lập charge-service trả về lỗi logic (vd: không đủ tiền)
      mockAxiosPost.mockResolvedValue({
        data: { success: false, message: 'Không đủ số dư' }
      });

      const response = await request(app)
        .post('/transfer')
        .send(validTransferData);

      expect(response.statusCode).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Không đủ số dư');
      // Đảm bảo không ghi log DB
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should handle charge service network error (safePost retries fail)', async () => {
      // Giả lập charge-service lỗi mạng (ví dụ: timeout, 503)
      mockAxiosPost.mockRejectedValue(new Error('Network Error'));

      const response = await request(app)
        .post('/transfer')
        .send(validTransferData);

      // Lỗi này sẽ bị bắt bởi block catch ngoài cùng
      expect(response.statusCode).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Lỗi hệ thống khi chuyển tiền');
      
      // Kiểm tra xem logic retry (safePost) đã chạy đúng (3 lần)
      expect(mockAxiosPost).toHaveBeenCalledTimes(3);
      expect(pool.query).not.toHaveBeenCalled();
    });

    it('should handle database logging failure', async () => {
      // Giả lập charge-service thành công
      mockAxiosPost.mockResolvedValue({
        data: { success: true, message: 'Transfer successful' }
      });

      // Giả lập ghi DB thất bại
      pool.query.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/transfer')
        .send(validTransferData);

      // Đây là kịch bản đặc biệt trong app.js
      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.warning).toBe('Giao dịch thành công nhưng ghi log thất bại');
      
      // Đảm bảo đã gọi cả hai
      expect(mockAxiosPost).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /get-transaction-history', () => {
    it('should return transaction history for a phone number', async () => {
      const mockTransactions = [
        {
          amount: 100,
          transaction_time: new Date().toISOString(),
          type: 'Chuyển tiền',
          description: 'Chuyển tiền tới user2'
        }
      ];

      pool.query.mockResolvedValue({ rows: mockTransactions });

      const response = await request(app)
        .post('/get-transaction-history')
        .send({ phone_number: '1234567890' });

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // So sánh dữ liệu JSON-safe
      expect(JSON.parse(JSON.stringify(response.body))).toEqual(mockTransactions);
      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), ['1234567890']);
    });

    it('should handle database error', async () => {
      pool.query.mockRejectedValue(new Error('DB Error'));

      const response = await request(app)
        .post('/get-transaction-history')
        .send({ phone_number: '1234567890' });

      expect(response.statusCode).toBe(500);
      expect(response.body).toHaveProperty('error', 'Lỗi server khi lấy lịch sử chuyển tiền');
    });
  });

  describe('GET /test-db', () => {
    it('should return current timestamp when DB is connected', async () => {
      const mockTimestamp = { now: new Date() };
      pool.query.mockResolvedValue({ rows: [mockTimestamp] });

      const response = await request(app).get('/test-db');

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual(JSON.parse(JSON.stringify(mockTimestamp)));
    });

    it('should handle database connection failure', async () => {
      pool.query.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app).get('/test-db');

      expect(response.statusCode).toBe(500);
      expect(response.body).toHaveProperty('message', 'DB connection failed');
    });
  });
});