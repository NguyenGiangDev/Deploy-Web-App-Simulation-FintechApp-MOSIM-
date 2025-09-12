# Dùng image Node.js chính thức
FROM node:18

# Tạo thư mục làm việc trong container
WORKDIR /usr/src/app

# Sao chép file API_Gateway.js vào container
COPY package*.json ./
RUN npm install
COPY API_Gateway.js .

# Mở port (ví dụ API Gateway của bạn chạy ở cổng 8080)
EXPOSE 8080

# Chạy file Node.js
CMD ["node", "server.js"]
