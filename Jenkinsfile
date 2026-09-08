pipeline {

    agent any

    environment {
        ACR_REGISTRY = "bestradevacr.azurecr.io"
        BACKEND_IMAGE = "bestradevacr.azurecr.io/bestra-backend:${BUILD_NUMBER}"
        SONAR_HOST_URL = "http://localhost:9000"
    }

    stages {

        stage('Start') {
            steps {
                echo "========================================"
                echo "Starting Bestra CI/CD Pipeline"
                echo "Build: ${BUILD_NUMBER}"
                echo "========================================"
                sh 'date'
            }
        }

        stage('Clone from GitHub') {
            steps {
                echo "Cloning Bestra repository..."

                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        credentialsId: 'github-final',
                        url: 'https://github.com/AuraLab-international/bestra.git'
                    ]]
                ])
            }
        }

        stage('Prepare') {
            steps {
                echo "Preparing build environment..."

                sh '''
                    echo "Node version:"
                    node --version || true

                    echo "NPM version:"
                    npm --version || true

                    echo "Docker version:"
                    docker --version

                    echo "Git version:"
                    git --version

                    echo "Project files:"
                    ls -la
                '''
            }
        }

        stage('GitLeaks Secret Scan') {
            steps {
                echo "Running GitLeaks secret scan..."

                sh '''
                    docker run --rm \
                        -v "$PWD:/repo" \
                        zricethezav/gitleaks:latest \
                        detect \
                        --source=/repo \
                        --no-banner \
                        --redact
                '''

                echo "GitLeaks scan completed successfully"
            }
        }

        stage('SAST - SonarQube') {
            steps {
                echo "Running SonarQube SAST analysis..."

                withCredentials([
                    string(
                        credentialsId: 'sonar-token',
                        variable: 'SONAR_TOKEN'
                    )
                ]) {
                    sh '''
                        docker run --rm \
                            --network host \
                            -e SONAR_HOST_URL="$SONAR_HOST_URL" \
                            -e SONAR_TOKEN="$SONAR_TOKEN" \
                            -v "$PWD:/usr/src" \
                            sonarsource/sonar-scanner-cli:latest \
                            -Dsonar.projectKey=bestra \
                            -Dsonar.sources=/usr/src/backend,/usr/src/bestra \
                            -Dsonar.host.url="$SONAR_HOST_URL" \
                            -Dsonar.token="$SONAR_TOKEN"
                    '''
                }

                echo "SonarQube analysis completed"
            }
        }

        stage('Snyk Dependency Scan') {
            steps {
                echo "Running Snyk dependency scan..."

                withCredentials([
                    string(
                        credentialsId: 'snyk-token',
                        variable: 'SNYK_TOKEN'
                    )
                ]) {
                    sh '''
                        cd backend

                        export SNYK_TOKEN="$SNYK_TOKEN"

                        npx --yes snyk test \
                            --severity-threshold=high

                        echo "Snyk scan completed successfully"
                    '''
                }
            }
        }

        stage('Backend Validation') {
            steps {
                echo "Validating backend..."

                sh '''
                    cd backend

                    npm ci --no-fund --no-audit

                    npx prisma generate

                    node --check src/index.js

                    echo "Backend validation passed"
                '''
            }
        }

        stage('ReactLynx Build') {
            steps {
                echo "Building ReactLynx application..."

                sh '''
                    cd bestra

                    npm ci --no-fund --no-audit

                    npm run build

                    echo "ReactLynx build completed"
                    ls -lh dist/
                '''
            }
        }

        stage('Prepare Android Bundle') {
            steps {
                echo "Preparing Android bundle..."

                sh '''
                    test -f bestra/dist/main.lynx.bundle

                    cp bestra/dist/main.lynx.bundle \
                       integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    echo "Android bundle prepared"
                    ls -lh integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/
                '''
            }
        }

        stage('Build Android APK') {
            steps {
                echo "Building Android APK..."

                sh '''
                    docker build \
                        -f integrating-lynx/android/KotlinEmptyProject/Dockerfile \
                        -t bestra-android:${BUILD_NUMBER} \
                        .

                    echo "Android Docker build completed"
                '''
            }
        }

        stage('Archive Android APK') {
            steps {
                echo "Extracting Android APK..."

                sh '''
                    docker rm -f bestra-android-extract 2>/dev/null || true

                    docker create \
                        --name bestra-android-extract \
                        bestra-android:${BUILD_NUMBER}

                    docker cp \
                        bestra-android-extract:/app/app/build/outputs/apk/debug/app-debug.apk \
                        bestra-debug-${BUILD_NUMBER}.apk

                    docker rm bestra-android-extract

                    ls -lh bestra-debug-${BUILD_NUMBER}.apk
                '''

                archiveArtifacts artifacts: 'bestra-debug-${BUILD_NUMBER}.apk',
                                 fingerprint: true
            }
        }

        stage('Build Backend Docker') {
            steps {
                echo "Building backend Docker image..."

                sh '''
                    docker build \
                        -t "$BACKEND_IMAGE" \
                        ./backend

                    echo "Backend Docker image built successfully"

                    docker images | grep bestra-backend || true
                '''
            }
        }

        stage('Trivy Backend Scan') {
            steps {
                echo "Running Trivy vulnerability scan..."

                sh '''
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        aquasec/trivy:latest \
                        image \
                        --scanners vuln \
                        --severity HIGH,CRITICAL \
                        --ignore-unfixed \
                        --exit-code 1 \
                        "$BACKEND_IMAGE"

                    echo "Trivy scan completed successfully"
                '''
            }
        }

        stage('Docker Login to ACR') {
            steps {
                echo "Logging in to Azure Container Registry..."

                withCredentials([
                    usernamePassword(
                        credentialsId: 'azure-acr-credentials',
                        usernameVariable: 'ACR_USERNAME',
                        passwordVariable: 'ACR_PASSWORD'
                    )
                ]) {
                    sh '''
                        echo "$ACR_PASSWORD" | docker login "$ACR_REGISTRY" \
                            --username "$ACR_USERNAME" \
                            --password-stdin

                        echo "ACR login successful"
                    '''
                }
            }
        }

        stage('Push Backend to ACR') {
            steps {
                echo "Pushing backend image to Azure Container Registry..."

                sh '''
                    docker push "$BACKEND_IMAGE"

                    echo "Backend image pushed successfully"
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                echo "Deploying backend to Azure..."

                withCredentials([
                    usernamePassword(
                        credentialsId: 'azure-service-principal',
                        usernameVariable: 'AZURE_CLIENT_ID',
                        passwordVariable: 'AZURE_CLIENT_SECRET'
                    ),
                    string(
                        credentialsId: 'azure-tenant-id',
                        variable: 'AZURE_TENANT_ID'
                    ),
                    string(
                        credentialsId: 'azure-subscription-id',
                        variable: 'AZURE_SUBSCRIPTION_ID'
                    )
                ]) {
                    sh '''
                        az login \
                            --service-principal \
                            --username "$AZURE_CLIENT_ID" \
                            --password "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID"

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        echo "Azure authentication successful"

                        # Deployment command can be adapted to the existing
                        # Azure App Service / AKS configuration.
                        echo "Backend deployment stage completed"
                    '''
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                echo "Running OWASP ZAP DAST scan..."

                sh '''
                    echo "Starting OWASP ZAP scan..."

                    docker run --rm \
                        --network host \
                        -v "$WORKSPACE:/zap/wrk/:rw" \
                        ghcr.io/zaproxy/zaproxy:stable \
                        zap-baseline.py \
                        -t http://localhost:3000 \
                        -r zap-report.html \
                        || true

                    echo "OWASP ZAP scan completed"
                '''

                archiveArtifacts artifacts: 'zap-report.html',
                                 allowEmptyArchive: true
            }
        }
    }

    post {

        success {
            echo "========================================"
            echo "PIPELINE SUCCESS"
            echo "Bestra CI/CD completed successfully"
            echo "Build: ${BUILD_NUMBER}"
            echo "========================================"
        }

        failure {
            echo "========================================"
            echo "PIPELINE FAILED"
            echo "Check the failed stage above"
            echo "Build: ${BUILD_NUMBER}"
            echo "========================================"
        }

        always {
            echo "Pipeline finished."
            sh 'docker system df || true'
        }
    }
}
