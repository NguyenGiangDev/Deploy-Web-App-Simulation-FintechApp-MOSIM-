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
                git branch: 'main', url: 'https://github.com/NguyenGiangDev/Deploy-Web-App-Simulation-FintechApp-MOSIM-.git'
            }
        }

        stage('Detect Changed Services') {
            steps {
                script {
                    def changedFiles = sh(
                        script: "git diff --name-only HEAD~1 HEAD",
                        returnStdout: true
                    ).trim().split("\n")

                    def changedServices = [] as Set
                    for (file in changedFiles) {
                        def topDir = file.tokenize('/')[0]
                        if (file && topDir.endsWith("-service") || topDir == "api-gateway") {
                            changedServices << topDir
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
                            trivy image --exit-code 1 --severity HIGH,CRITICAL ${service}:latest

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
    }

    post {
        success {
            echo "✅ Chỉ build & push các service thay đổi thành công!"
        }
        failure {
            echo "❌ Pipeline failed. Please check logs."
        }
    }
}
