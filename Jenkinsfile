pipeline {
    agent any

    environment {
        ECR_URL  = "676206906655.dkr.ecr.ap-southeast-1.amazonaws.com/fintech_web_app"
        REGION   = "ap-southeast-1"
    }

    stages {
        stage('Build on Dev only') {
            when {
                branch 'dev'
            }
            steps {
                echo "🚀 Running build because this is dev branch"
            }
        }

      stage('Checkout Code') {
    steps {
        checkout([
            $class: 'GitSCM',
            branches: [[name: '*/dev']],
            userRemoteConfigs: [[url: 'https://github.com/NguyenGiangDev/Deploy-Web-App-Simulation-FintechApp-MOSIM-.git']],
            extensions: [[$class: 'CleanBeforeCheckout']]
        ])
    }
}

         
        stage('Detect Changed Services') {
            steps {
                script {
                    // Fetch latest main to compare
                    sh "git fetch origin main"

                    // Lấy danh sách file thay đổi so với main
                    def changedFiles = sh(
                        script: "git diff --name-only origin/main...HEAD",
                        returnStdout: true
                    ).trim().split("\n")

                    echo "📄 Files changed:\n${changedFiles.join('\n')}"

                    // Danh sách service thật
                    def allServices = ["api-gateway", "auth-service", "charge-service", "history-service", "transaction-service"]

                    // Set lưu service thay đổi
                    def changedServices = [] as Set

                    for (file in changedFiles) {
                        def topDir = file.tokenize('/')[0]
                        if (allServices.contains(topDir)) {
                            changedServices << topDir
                        } else if (topDir == "common-lib" || topDir == "config") {
                            // Nếu thay đổi file chung, build tất cả service
                            break
                        }
                    }

                    if (changedServices.isEmpty()) {
                        echo "⚡ Không có service nào thay đổi. Dừng pipeline."
                        currentBuild.result = 'SUCCESS'
                        error("Stop build - no services changed")
                    }

                    env.CHANGED_SERVICES = changedServices.join(" ")
                    echo "📦 Các service thay đổi: ${env.CHANGED_SERVICES}"
                }
            }
        }

  stage('Run Unit Tests') {
    agent {
        docker {
            image 'node:18'
            args '-u root:root'
        }
    }
    steps {
        script {
            for (service in env.CHANGED_SERVICES.split(" ")) {
                sh """
                    echo "=============================="
                    echo "Running unit tests for ${service}..."
                    echo "==============================="
                    cd ${service}
                    npm install
                    chmod +x ./node_modules/.bin/jest
                    npm test
                    if [ \$? -ne 0 ]; then
                        echo "❌ Unit tests failed for ${service}"
                        exit 1
                    else
                        echo "✅ Unit tests passed for ${service}"
                    fi
                """
            }
        }
    }
}


        stage('Semgrep Scan') {
            steps {
                sh '''
                    echo "Running Semgrep scan..."
                    semgrep --config=auto .
                '''
            }
        }
        
        stage('Login to ECR') {
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-cred-id']]) {
                    sh """
                        echo "🔑 Logging into ECR..."
                        aws ecr get-login-password --region ${REGION} \
                            | docker login --username AWS --password-stdin ${ECR_URL}
                    """
                }
            }
        }

        stage('Build, Scan & Push Docker Images') {
            steps {
                script {
                    for (service in env.CHANGED_SERVICES.split(" ")) {
                        sh """
                            echo "=============================="
                            echo "Processing ${service}..."
                            echo "=============================="

                            docker build --no-cache -t ${service} ./${service}

                            echo "🔍 Scanning image ${service}..."
                            echo "🔍 Scanning Node.js dependencies in ${service}..."
                            trivy fs --exit-code 1 --severity CRITICAL --scanners vuln ./${service}

                            echo "🔍 Scanning base image ${service} (OS packages, warnings only)..."
                            trivy image --exit-code 0 --severity CRITICAL ${service}:latest

                            docker tag ${service}:latest ${ECR_URL}:${service}-latest
                            docker push ${ECR_URL}:${service}-latest

                            docker rmi ${service}:latest || true
                            docker rmi ${ECR_URL}:${service}-latest || true

                            echo "${service} done."
                        """
                    }
                }
            }
        }
  stage('Deploy on EC2') {
    sshagent (credentials: ['ec2-ssh-key']) {
        withCredentials([string(credentialsId: 'frontend_url', variable: 'FRONTEND_URL')]) {
            sh """
              ssh -o StrictHostKeyChecking=no ubuntu@ec2-54-169-85-203.ap-southeast-1.compute.amazonaws.com '
                # Đăng nhập lại vào ECR
                aws ecr get-login-password --region ap-southeast-1 | \
                  docker login --username AWS --password-stdin 676206906655.dkr.ecr.ap-southeast-1.amazonaws.com

                # Xuất biến môi trường để docker-compose dùng
                export FRONTEND_URL=${FRONTEND_URL}

                # Triển khai container
                cd /home/ubuntu/Web-App-Simulation-FintechApp-MOSIM- &&
                docker compose pull &&
                docker compose up -d &&
                docker image prune -f
              '
            """
        }
    }
}




    }

    post {
        success {
            echo "✅ Triển khai webapp trên môi trường dev thành công !"
        }
        failure {
            echo "❌ Pipeline failed. Please check logs."
        }
    }
}
