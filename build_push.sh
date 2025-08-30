#!/bin/bash

# Thông tin ECR
ECR_URL="676206906655.dkr.ecr.ap-southeast-1.amazonaws.com/fintech_web_app"
REGION="ap-southeast-1"

# Danh sách service và folder tương ứng
services=("api-gateway" "auth-service" "charge-service" "history-service" "transaction-service")

# Login vào ECR
echo "Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URL

# Lặp qua từng service
for service in "${services[@]}"; do
    echo "=============================="
    echo "Processing $service..."
    echo "=============================="

    # Build Docker image
    docker build -t $service ./$service

    # Tag image cho ECR
    docker tag $service:latest $ECR_URL:$service-latest

    # Push image lên ECR
    docker push $ECR_URL:$service-latest

    # Xoá image local để tiết kiệm dung lượng
    docker rmi $service:latest
    docker rmi $ECR_URL:$service-latest

    echo "$service done."
done

echo "All services have been built and pushed to ECR!"
