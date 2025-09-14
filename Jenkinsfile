pipeline {
    agent any

    triggers {
        githubPush()
    }

    environment {
        ECR_URL = "676206906655.dkr.ecr.ap-southeast-1.amazonaws.com/fintech_web_app"
        REGION  = "ap-southeast-1"
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
                sh "git fetch --all"
            }
        }

        stage('Detect Changed Services') {
            steps {
                script {
                    def changedFiles = []

                    if (env.BRANCH_NAME == "dev") {
                        sh "git fetch origin main"
                        changedFiles = sh(
                            script: "git diff --name-only origin/main..HEAD",
                            returnStdout: true
                        ).trim().split("\n")
                    } else {
                        changedFiles = sh(
                            script: "git diff --name-only HEAD~1..HEAD",
                            returnStdout: true
                        ).trim().split("\n")
                    }

                    echo "📄 Files changed:\n${changedFiles.join('\n')}"

                    def allServices = ["api-gateway", "auth-service", "charge-service", "history-service", "transaction-service"]
                    def changedServices = [] as Set

                    for (file in changedFiles) {
                        def topDir = file.tokenize('/')[0]
                        if (allServices.contains(topDir)) {
                            changedServices << topDir
                        } else if (topDir == "common-lib" || topDir == "config") {
                            changedServices.addAll(allServices)
                            break
                        }
                    }

                    if (changedServices.isEmpty()) {
                        echo "⚡ Không có service nào thay đổi. Stop pipeline."
                        currentBuild.result = 'SUCCESS'
                        error("No services changed")
                    }

                    env.CHANGED_SERVICES = changedServices.join(" ")
                    echo "📦 Các service thay đổi: ${env.CHANGED_SERVICES}"
                }
            }
        }

        stage('Build on Dev only') {
            when { expression { env.BRANCH_NAME == 'dev' } }
            steps {
                echo "🚀 Running build on dev branch"
            }
        }

        stage('Run Unit Tests') {
            when { expression { env.BRANCH_NAME == 'dev' } }
            agent {
                docker {
                    image 'node:18'
                    args '-u root:root -v ${PWD}:/workspace -w /workspace'
                }
            }
            steps {
                script {
                    for (service in env.CHANGED_SERVICES.split(" ")) {
                        sh """
                            echo "=============================="
                            echo "Running unit tests for ${service}..."
                            echo "=============================="
                            cd ${service}
                            npm install
                            npm test || (echo "❌ Tests failed for ${service}" && exit 1)
                            echo "✅ Tests passed for ${service}"
                        """
                    }
                }
            }
        }

        stage('Semgrep Scan') {
            when { expression { env.BRANCH_NAME == 'dev' } }
            steps {
                sh '''
                    echo "🔍 Running Semgrep scan..."
                    semgrep --config=auto .
                '''
            }
        }

        stage('Login to ECR') {
            when { expression { env.BRANCH_NAME == 'dev' } }
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
            when { expression { env.BRANCH_NAME == 'dev' } }
            steps {
                script {
                    for (service in env.CHANGED_SERVICES.split(" ")) {
                        def tag = "${ECR_URL}:${service}-latest"
                        sh """
                            echo "=============================="
                            echo "Processing ${service}..."
                            echo "=============================="

                            docker build --no-cache -t ${service}:latest ./${service}

                            echo "🔍 Scanning Node.js dependencies in ${service}..."
                            trivy fs --exit-code 1 --severity CRITICAL --scanners vuln ./${service}

                            echo "🔍 Scanning base image ${service}..."
                            trivy image --exit-code 0 --severity CRITICAL ${service}:latest

                            docker tag ${service}:latest ${tag}
                            docker push ${tag}

                            docker rmi ${service}:latest || true
                            docker rmi ${tag} || true
                        """
                    }
                }
            }
        }

        stage('Deploy on EC2') {
            when { expression { env.BRANCH_NAME == 'dev' } }
            steps {
                sshagent (credentials: ['ec2-ssh-key']) {
                    withCredentials([string(credentialsId: 'frontend_url', variable: 'FRONTEND_URL')]) {
                        sh """
                          ssh -o StrictHostKeyChecking=no ubuntu@ec2-54-169-85-203.ap-southeast-1.compute.amazonaws.com '
                            set -e
                            aws ecr get-login-password --region ap-southeast-1 | \
                              docker login --username AWS --password-stdin 676206906655.dkr.ecr.ap-southeast-1.amazonaws.com

                            export FRONTEND_URL=${FRONTEND_URL}

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
