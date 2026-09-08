pipeline {

    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
    }

    environment {
        AZURE_RESOURCE_GROUP = 'bestra-rg'
        AZURE_APP_SERVICE_BACKEND = 'bestra-backend'
        AZURE_ACR_NAME = 'bestraacr'
        BACKEND_IMAGE = "${AZURE_ACR_NAME}.azurecr.io/bestra-backend"
    }

    stages {

        stage('Start') {
            steps {
                sh '''
                    echo "========================================"
                    echo "Bestra DevSecOps Pipeline"
                    echo "========================================"
                    echo "Build: ${BUILD_NUMBER}"
                    echo "Date:"
                    date
                '''
            }
        }

        stage('Clone from GitHub') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        url: 'https://github.com/AuraLab-international/bestra.git',
                        credentialsId: 'github-final'
                    ]]
                ])
            }
        }

        stage('Prepare') {
            steps {
                sh '''
                    echo "Preparing environment..."
                    node --version
                    npm --version
                    docker --version
                    git --version
                '''
            }
        }

        stage('GitLeaks Secret Scan') {
            steps {
                sh '''
                    echo "Running GitLeaks..."

                    docker run --rm \
                        -v "$PWD:/path" \
                        zricethezav/gitleaks:latest \
                        detect \
                        --source=/path \
                        --verbose

                    echo "GitLeaks passed"
                '''
            }
        }

        stage('SAST - SonarQube') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'sonar-token',
                        variable: 'SONAR_TOKEN'
                    )
                ]) {
                    sh '''
                        echo "Running SonarQube SAST..."

                        cd backend

                        npx --yes sonar-scanner \
                            -Dsonar.projectKey=Bestra-Backend \
                            -Dsonar.sources=. \
                            -Dsonar.host.url=http://localhost:9000 \
                            -Dsonar.login="$SONAR_TOKEN"

                        echo "SonarQube analysis completed"
                    '''
                }
            }
        }

        stage('Snyk Dependency Scan') {
    steps {
        withCredentials([
            string(
                credentialsId: 'snyk-token',
                variable: 'SNYK_TOKEN'
            )
        ]) {
            sh '''
                echo "Running Snyk dependency scan..."

                cd backend

                npx --yes snyk test \
                    --severity-threshold=high

                echo "Snyk scan completed"
            '''
        }
    }
}

        stage('Backend Validation') {
            steps {
                sh '''
                    echo "Validating backend..."

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
                sh '''
                    echo "Building ReactLynx application..."

                    cd bestra

                    npm ci --no-fund --no-audit

                    npm run build

                    echo "Build output:"
                    ls -lh dist/

                    echo "ReactLynx build completed"
                '''
            }
        }

        stage('Prepare Android Bundle') {
            steps {
                sh '''
                    echo "Preparing Android Lynx bundle..."

                    test -f bestra/dist/main.lynx.bundle

                    cp bestra/dist/main.lynx.bundle \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    echo "Android bundle prepared"
                '''
            }
        }

        stage('Build Android APK') {
            steps {
                sh '''
                    echo "Building Android APK with Docker..."

                    docker build \
                        -f Dockerfile.android \
                        -t bestra-android:${BUILD_NUMBER} .

                    CONTAINER_ID=$(docker create bestra-android:${BUILD_NUMBER})

                    docker cp \
                        ${CONTAINER_ID}:/app/app/build/outputs/apk/debug/app-debug.apk \
                        ./bestra-debug.apk

                    docker rm ${CONTAINER_ID}

                    echo "APK created:"
                    ls -lh bestra-debug.apk

                    echo "Android APK build completed"
                '''
            }
        }

        stage('Archive Android APK') {
            steps {
                archiveArtifacts artifacts: 'bestra-debug.apk',
                    fingerprint: true

                echo "Android APK archived"
            }
        }

        stage('Build Backend Docker') {
            steps {
                sh '''
                    echo "Building backend Docker image..."

                    docker build \
                        -t ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                        -t ${BACKEND_IMAGE}:latest \
                        ./backend

                    echo "Backend Docker image built"
                '''
            }
        }

        stage('Trivy Backend Scan') {
            steps {
                sh '''
                    echo "Running Trivy security scan..."

                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        aquasec/trivy:latest \
                        image \
                        --severity HIGH,CRITICAL \
                        --ignore-unfixed \
                        ${BACKEND_IMAGE}:${BUILD_NUMBER}

                    echo "Trivy scan completed"
                '''
            }
        }

        stage('Docker Login to ACR') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'azure-acr-credentials',
                        usernameVariable: 'ACR_USERNAME',
                        passwordVariable: 'ACR_PASSWORD'
                    )
                ]) {
                    sh '''
                        echo "Logging into Azure Container Registry..."

                        echo "$ACR_PASSWORD" | docker login \
                            ${AZURE_ACR_NAME}.azurecr.io \
                            -u "$ACR_USERNAME" \
                            --password-stdin

                        echo "ACR login successful"
                    '''
                }
            }
        }

        stage('Push Backend to ACR') {
            steps {
                sh '''
                    echo "Pushing backend image to ACR..."

                    docker push \
                        ${BACKEND_IMAGE}:${BUILD_NUMBER}

                    docker push \
                        ${BACKEND_IMAGE}:latest

                    echo "Backend images pushed to ACR"
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
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
                    ),
                    usernamePassword(
                        credentialsId: 'azure-acr-credentials',
                        usernameVariable: 'ACR_USERNAME',
                        passwordVariable: 'ACR_PASSWORD'
                    )
                ]) {
                    sh '''
                        echo "Deploying backend to Azure..."

                        az login \
                            --service-principal \
                            --username "$AZURE_CLIENT_ID" \
                            --password "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID"

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        az webapp config container set \
                            --name "$AZURE_APP_SERVICE_BACKEND" \
                            --resource-group "$AZURE_RESOURCE_GROUP" \
                            --container-image-name "${BACKEND_IMAGE}:${BUILD_NUMBER}" \
                            --container-registry-url "https://${AZURE_ACR_NAME}.azurecr.io" \
                            --container-registry-user "$ACR_USERNAME" \
                            --container-registry-password "$ACR_PASSWORD"

                        az webapp restart \
                            --name "$AZURE_APP_SERVICE_BACKEND" \
                            --resource-group "$AZURE_RESOURCE_GROUP"

                        echo "Backend deployed successfully"
                    '''
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                sh '''
                    echo "Running OWASP ZAP DAST..."

                    BACKEND_URL="https://${AZURE_APP_SERVICE_BACKEND}.azurewebsites.net"

                    echo "Target:"
                    echo "$BACKEND_URL/health"

                    docker run --rm \
                        -v "$PWD:/zap/wrk:rw" \
                        zaproxy/zap-stable \
                        zap-baseline.py \
                        -t "$BACKEND_URL/health" \
                        -r zap-report.html \
                        || true

                    echo "ZAP scan completed"
                '''
            }
        }
    }

    post {

        success {
            echo "========================================"
            echo "PIPELINE SUCCESS"
            echo "========================================"

            echo "Backend:"
            echo "https://${AZURE_APP_SERVICE_BACKEND}.azurewebsites.net"

            echo "Android APK archived successfully"
        }

        failure {
            echo "========================================"
            echo "PIPELINE FAILED"
            echo "========================================"
        }

        always {
            echo "========================================"
            echo "Pipeline finished"
            echo "Build: ${BUILD_NUMBER}"
            echo "========================================"
        }
    }
}
