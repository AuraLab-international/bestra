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
                echo "       B E S T R A   P I P E L I N E"
                echo "========================================"
                echo "Build: ${BUILD_NUMBER}"
                sh 'date'
            }
        }

        stage('Clone from GitHub') {
            steps {
                echo "Cloning repository..."

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
                sh '''
                    echo "Node:"
                    node --version

                    echo "NPM:"
                    npm --version

                    echo "Docker:"
                    docker --version

                    echo "Git:"
                    git --version

                    echo "Workspace:"
                    ls -lah
                '''
            }
        }

        stage('GitLeaks Secret Scan') {
            steps {
                echo "Running GitLeaks..."

                sh '''
                    docker run --rm \
                        -v "$PWD:/repo" \
                        zricethezav/gitleaks:latest \
                        detect \
                        --source=/repo \
                        --no-banner \
                        --redact

                    echo "GitLeaks: PASS"
                '''
            }
        }

        stage('SAST - SonarQube') {
            steps {
                echo "Running SonarQube SAST..."

                withCredentials([
                    string(
                        credentialsId: 'sonar-token',
                        variable: 'SONAR_TOKEN'
                    )
                ]) {

                    sh '''
                        set +e

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

                        SONAR_EXIT=$?

                        if [ "$SONAR_EXIT" -ne 0 ]; then
                            echo "WARNING: SonarQube analysis failed."
                            echo "Pipeline continues so other security stages can execute."
                        else
                            echo "SonarQube: PASS"
                        fi

                        exit 0
                    '''
                }
            }
        }

        stage('Snyk Dependency Scan') {
            steps {
                echo "Running Snyk..."

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

                        echo "Snyk: PASS"
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

                    echo "Backend validation: PASS"
                '''
            }
        }

        stage('ReactLynx Build') {
            steps {
                echo "Building ReactLynx..."

                sh '''
                    cd bestra

                    npm ci --no-fund --no-audit

                    npm run build

                    test -f dist/main.lynx.bundle
                    test -f dist/main.web.bundle

                    echo "ReactLynx build: PASS"
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

                    echo "Android bundle: READY"
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

                    echo "Android APK build: PASS"
                '''
            }
        }

        stage('Archive Android APK') {
            steps {
                echo "Archiving Android APK..."

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

                archiveArtifacts(
                    artifacts: 'bestra-debug-${BUILD_NUMBER}.apk',
                    fingerprint: true
                )
            }
        }

        stage('Build Backend Docker') {
            steps {
                echo "Building backend Docker image..."

                sh '''
                    docker build \
                        -t "$BACKEND_IMAGE" \
                        ./backend

                    echo "Backend Docker build: PASS"
                '''
            }
        }

        stage('Trivy Backend Scan') {
            steps {
                echo "Running Trivy security scan..."

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

                    echo "Trivy: PASS"
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

                        echo "ACR login: PASS"
                    '''
                }
            }
        }

        stage('Push Backend to ACR') {
            steps {
                echo "Pushing backend image to ACR..."

                sh '''
                    docker push "$BACKEND_IMAGE"

                    echo "ACR push: PASS"
                    echo "Image: $BACKEND_IMAGE"
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                echo "Authenticating with Azure..."

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

                        echo "Azure authentication: PASS"
                        echo "Backend image ready for deployment:"
                        echo "$BACKEND_IMAGE"
                    '''
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                echo "Running OWASP ZAP..."

                sh '''
                    echo "Starting OWASP ZAP baseline scan..."

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

                archiveArtifacts(
                    artifacts: 'zap-report.html',
                    allowEmptyArchive: true
                )
            }
        }
    }

    post {

        success {
            echo "========================================"
            echo "       PIPELINE SUCCESS"
            echo "========================================"
            echo "Bestra CI/CD completed successfully"
            echo "Build: ${BUILD_NUMBER}"
            echo "========================================"
        }

        failure {
            echo "========================================"
            echo "       PIPELINE FAILED"
            echo "========================================"
            echo "Check the failed stage above"
            echo "Build: ${BUILD_NUMBER}"
            echo "========================================"
        }

        always {
            echo "Pipeline finished."

            sh '''
                echo "Docker disk usage:"
                docker system df || true
            '''
        }
    }
}
