# ============================
# Stage 1: Build dependencies
# ============================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files của service
COPY package*.json ./

# Cài dependencies production
RUN npm ci --only=production

# Copy source code
COPY . .

# ============================
# Stage 2: Runtime
# ============================
FROM node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app /usr/src/app

EXPOSE 3000

USER appuser

CMD ["npm", "start"]
