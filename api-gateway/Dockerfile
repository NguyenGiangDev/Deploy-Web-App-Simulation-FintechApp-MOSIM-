# ============================
# Stage 1: Build dependencies
# ============================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files trước (tận dụng cache Docker)
COPY package*.json ./

# Cài dependencies production (nhanh + reproducible)
RUN npm ci --only=production

# Copy source code
COPY . .

# ============================
# Stage 2: Runtime
# ============================
FROM node:20-alpine

# Tạo user không phải root để tăng bảo mật
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

# Copy node_modules + source từ stage builder
COPY --from=builder /usr/src/app /usr/src/app

# Expose cổng service (chỉnh lại cho đúng service của bạn)
EXPOSE 3000

# Chạy bằng user non-root
USER appuser

# Lệnh khởi chạy app
CMD ["npm", "start"]
