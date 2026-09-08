pipeline {

    agent any

    options {
        timestamps()
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
    }

    environment {
        GITHUB_REPO = 'https://github.com/AuraLab-international/bestra.git'

        ACR_NAME = 'bestradevacr'
        ACR_LOGIN_SERVER = 'bestradevacr.azurecr.io'

        IMAGE_NAME = 'bestra-backend'
        IMAGE_TAG = "${BUILD_NUMBER}"

        SONAR_HOST_URL = 'http://localhost:9000'
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
                deleteDir()

                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        url: "${GITHUB_REPO}",
                        credentialsId: 'github-final'
                    ]],
                    extensions: [
                        [$class: 'CloneOption',
                         shallow: false,
                         noTags: false,
                         depth: 0,
                         honorRefspec: true]
                    ]
                ])

                sh '''
                    echo "========================================"
                    echo "Git information"
                    echo "========================================"

                    git fetch origin main --prune

                    git checkout -f origin/main

                    echo "Commit:"
                    git rev-parse HEAD

                    echo "Commit message:"
                    git log -1 --oneline

                    echo "Logo:"
                    ls -lh bestra/static/Bestra-logo.webp
                '''
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

                    echo "Checking required Node version..."

                    NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")

                    if [ "$NODE_MAJOR" -lt 24 ]; then
                        echo "ERROR: Node.js >= 24 is required."
                        echo "Current Node.js: $(node --version)"
                        exit 1
                    fi
                '''
            }
        }

        stage('GitLeaks Secret Scan') {
            steps {
                sh '''
                    echo "Running GitLeaks..."

                    docker run --rm \
                        -v "$WORKSPACE:/path" \
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
                            -Dsonar.host.url=${SONAR_HOST_URL} \
                            -Dsonar.login=${SONAR_TOKEN}

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

                    echo "Checking logo..."
                    test -f static/Bestra-logo.webp

                    npm run build

                    echo "ReactLynx build completed"

                    echo "Generated files:"
                    ls -lh dist/
                '''
            }
        }

        stage('Prepare Android Bundle') {
            steps {
                sh '''
                    echo "Preparing Android bundle..."

                    test -f bestra/dist/main.lynx.bundle

                    cp bestra/dist/main.lynx.bundle \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/

                    echo "Android bundle prepared"

                    ls -lh \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle
                '''
            }
        }

        stage('Build Android APK') {
            steps {
                sh '''
                    echo "Building Android APK..."

                    docker build \
                        -f Dockerfile.android \
                        -t bestra-android-build:${BUILD_NUMBER} \
                        .

                    echo "Android Docker build completed"

                    docker rm -f bestra-android-${BUILD_NUMBER} 2>/dev/null || true

                    docker create \
                        --name bestra-android-${BUILD_NUMBER} \
                        bestra-android-build:${BUILD_NUMBER}

                    docker cp \
                        bestra-android-${BUILD_NUMBER}:/app/app/build/outputs/apk/debug/app-debug.apk \
                        bestra-debug-${BUILD_NUMBER}.apk

                    docker rm \
                        bestra-android-${BUILD_NUMBER}

                    ls -lh bestra-debug-${BUILD_NUMBER}.apk
                '''
            }
        }

        stage('Archive Android APK') {
            steps {
                archiveArtifacts(
                    artifacts: 'bestra-debug-*.apk',
                    fingerprint: true
                )

                echo "Android APK archived successfully"
            }
        }

        stage('Build Backend Docker') {
            steps {
                sh '''
                    echo "Building backend Docker image..."

                    docker build \
                        -t ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG} \
                        -t ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest \
                        ./backend

                    echo "Backend Docker image built"

                    docker images | grep bestra-backend
                '''
            }
        }

        stage('Trivy Backend Scan') {
            steps {
                sh '''
                    echo "Running Trivy..."

                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        aquasec/trivy:latest \
                        image \
                        --severity HIGH,CRITICAL \
                        --exit-code 1 \
                        ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}

                    echo "Trivy scan passed"
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

                        echo "${ACR_PASSWORD}" | docker login \
                            ${ACR_LOGIN_SERVER} \
                            -u "${ACR_USERNAME}" \
                            --password-stdin

                        echo "ACR login successful"
                    '''
                }
            }
        }

        stage('Push Backend to ACR') {
            steps {
                sh '''
                    echo "Pushing backend image..."

                    docker push \
                        ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}

                    docker push \
                        ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest

                    echo "Backend image pushed successfully"
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
                    )
                ]) {
                    sh '''
                        echo "Deploying backend to Azure..."

                        az login \
                            --service-principal \
                            -u "${AZURE_CLIENT_ID}" \
                            -p "${AZURE_CLIENT_SECRET}" \
                            --tenant "${AZURE_TENANT_ID}"

                        az account set \
                            --subscription "${AZURE_SUBSCRIPTION_ID}"

                        echo "Azure authentication successful"

                        echo "Backend image:"
                        echo "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"

                        # Deployment command depends on the Azure resource
                        # configured for Bestra.
                        #
                        # Keep this stage ready for the final Azure target.
                        echo "Azure deployment stage completed"
                    '''
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                sh '''
                    echo "Running OWASP ZAP DAST..."

                    docker run --rm \
                        --network host \
                        ghcr.io/zaproxy/zaproxy:stable \
                        zap-baseline.py \
                        -t http://localhost:3000/health \
                        -r zap-report.html \
                        || true

                    echo "OWASP ZAP completed"
                '''
            }
        }
    }

    post {

        success {
            echo "========================================"
            echo "PIPELINE SUCCESS"
            echo "Build: ${BUILD_NUMBER}"
            echo "========================================"
        }

        failure {
            echo "========================================"
            echo "PIPELINE FAILED"
            echo "Build: ${BUILD_NUMBER}"
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
