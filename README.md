## LINK TRANG WEB :
https://d29lh6hd2oahwi.cloudfront.net/


# MOSIM: Fintech Simulation Web Microservice on AWS

## Project Overview
MOSIM is a microservice-based Fintech simulation web application developed to provide a realistic environment for simulating financial transactions. The project emphasizes **scalability, security, and maintainability**, leveraging AWS cloud services and modern DevOps practices.

This project showcases the full lifecycle of a cloud-native web application, from containerization to deployment, and delivery optimization using CDN.

---

## Architecture Diagram

### AWS Infrastructure
<img width="493" height="550" alt="image" src="https://github.com/user-attachments/assets/47996608-f2b0-4527-b2b3-859013b85d16" />




The AWS architecture is designed for high availability and secure communication between services. Key components include:
- **Amazon EC2**: Hosts backend services via Docker containers.
- **Amazon S3**: Stores static frontend files.
- **AWS CloudFront**: Provides CDN for fast content delivery and HTTPS termination.
- **PostgreSQL**: Managed relational database for storing transactional data.
- **Nginx**: Configured as a reverse proxy and load balancer.

---

### Client-Server Interaction
<img width="977" height="658" alt="image" src="https://github.com/user-attachments/assets/88e677de-c770-41cf-b1fc-13fc5c7ceefa" />


The system follows a **microservice architecture**, where the frontend communicates with backend services through RESTful APIs. Key points:
- **Frontend (S3 + CloudFront)**: Delivers static HTML/CSS/JS and communicates with backend APIs securely over HTTPS.
- **Backend (Dockerized services)**: Each microservice is containerized and orchestrated using Docker Compose, handling authentication, transaction processing, and history management.
- **Database (PostgreSQL)**: Provides persistent storage for user accounts, balances, and transaction logs.
- **Nginx**: Routes client requests to appropriate backend services and balances load for high availability.

---

## Technologies Used
- **Backend:** Node.js, Docker, Docker Compose
- **Frontend:** Static web assets hosted on S3
- **Database:** PostgreSQL
- **Web Server / Proxy:** Nginx
- **Cloud Infrastructure:** AWS CloudFormation, EC2, S3, CloudFront
- **Deployment & Automation:** Containerized microservices, Docker Compose orchestration

---

## Key Features
- Containerized backend services for easy deployment and scalability.
- Infrastructure as Code using AWS CloudFormation for reproducibility.
- Reverse proxy and load balancing via Nginx to manage multiple services efficiently.
- Frontend hosting on S3 with CloudFront CDN for low-latency access globally.
- Secure communication between client, services, and database.
- Realistic simulation of fintech transactions, including balance tracking and transaction history.

---

## Future Improvements
- Implement auto-scaling policies for backend services using ECS or Kubernetes.
- Add monitoring and alerting via AWS CloudWatch or Prometheus.
- Introduce CI/CD pipelines for automated testing and deployment.



