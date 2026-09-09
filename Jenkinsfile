pipeline {

    agent any

    environment {

        DOCKER_BUILDKIT = '1'

        // Azure ACR
        BACKEND_IMAGE = "bestraacr.azurecr.io/bestra-backend:${BUILD_NUMBER}"

        // Frontend Web / DockerHub
        FRONTEND_IMAGE = "bestra-frontend:${BUILD_NUMBER}"

        // SonarQube
        SONAR_HOST_URL = "${SONAR_HOST_URL}"
    }

    stages {

        stage('Start') {
            steps {
                echo "========================================"
                echo "Starting Bestra DevSecOps Pipeline"
                echo "Build Number: ${BUILD_NUMBER}"
                echo "========================================"
            }
        }


        stage('Clone from GitHub') {
            steps {
                echo "Checking out Bestra source code..."
                checkout scm
                echo "GitHub checkout: PASS"
            }
        }


        stage('Prepare') {
            steps {
                sh '''
                    set -e

                    node --version || true
                    npm --version || true
                    docker --version
                    git --version

                    echo ""
                    echo "Checking project directories..."

                    test -d backend
                    test -d bestra
                    test -d integrating-lynx

                    echo ""
                    echo "Project structure: PASS"
                '''
            }
        }


        stage('GitLeaks Secret Scan') {
            steps {
                echo "Running GitLeaks..."

                sh '''
                    set -e

                    docker run --rm \
                        -v "$WORKSPACE:/repo" \
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
                            echo "WARNING: SonarQube failed - pipeline continues."
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

                withCredentials([
                    string(
                        credentialsId: 'snyk-token',
                        variable: 'SNYK_TOKEN'
                    )
                ]) {

                    sh '''
                        set -e

                        cd backend

                        export SNYK_TOKEN="$SNYK_TOKEN"

                        npx --yes snyk test \
                            --severity-threshold=high

                        echo "Snyk: PASS"
                    '''
                }
            }
        }


        // ============================================================
        // PARALLEL BUILD & SCAN
        // ============================================================

        stage('Parallel Build & Scan') {

            parallel {

                // ====================================================
                // BACKEND
                // ====================================================

                stage('Backend Build + Trivy') {

                    stages {

                        stage('Backend Validation') {
                            steps {

                                sh '''
                                    set -e

                                    cd backend

                                    npm ci --no-fund --no-audit

                                    npx prisma generate

                                    node --check src/index.js

                                    echo "Backend Validation: PASS"
                                '''
                            }
                        }


                        stage('Backend Docker Build') {
                            steps {

                                sh '''
                                    set -e

                                    docker build \
                                        -t "$BACKEND_IMAGE" \
                                        ./backend

                                    echo "Backend Docker Build: PASS"
                                '''
                            }
                        }


                        stage('Backend Trivy Scan') {
                            steps {

                                sh '''
                                    set -e

                                    docker run --rm \
                                        -v /var/run/docker.sock:/var/run/docker.sock \
                                        -v trivy-cache:/root/.cache/trivy \
                                        aquasec/trivy:latest \
                                        image \
                                        --scanners vuln \
                                        --severity HIGH,CRITICAL \
                                        --ignore-unfixed \
                                        --skip-dirs /usr/local/lib/node_modules/npm \
                                        --timeout 10m \
                                        --exit-code 1 \
                                        "$BACKEND_IMAGE"

                                    echo "Backend Trivy: PASS"
                                '''
                            }
                        }
                    }
                }


                // ====================================================
                // FRONTEND WEB
                // ====================================================

                stage('Frontend Build + Trivy') {

                    stages {

                        stage('ReactLynx Build') {
                            steps {

                                sh '''
                                    set -e

                                    cd bestra

                                    npm ci --no-fund --no-audit

                                    npm run build

                                    test -f dist/main.lynx.bundle
                                    test -f dist/main.web.bundle

                                    echo "ReactLynx Build: PASS"
                                '''
                            }
                        }


                        stage('Frontend Docker Build') {
                            steps {

                                sh '''
                                    set -e

                                    docker build \
                                        -t "$FRONTEND_IMAGE" \
                                        ./bestra

                                    echo "Frontend Docker Build: PASS"
                                '''
                            }
                        }


                        stage('Frontend Trivy Scan') {
                            steps {

                                sh '''
                                    set -e

                                    docker run --rm \
                                        -v /var/run/docker.sock:/var/run/docker.sock \
                                        -v trivy-cache:/root/.cache/trivy \
                                        aquasec/trivy:latest \
                                        image \
                                        --scanners vuln \
                                        --severity HIGH,CRITICAL \
                                        --ignore-unfixed \
                                        --timeout 10m \
                                        --exit-code 1 \
                                        "$FRONTEND_IMAGE"

                                    echo "Frontend Trivy: PASS"
                                '''
                            }
                        }
                    }
                }
            }
        }


        // ============================================================
        // ANDROID APK
        // ============================================================

        stage('Prepare Android Bundle') {
            steps {

                sh '''
                    set -e

                    test -f bestra/dist/main.lynx.bundle

                    cp \
                        bestra/dist/main.lynx.bundle \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    echo "Android Bundle: PASS"
                '''
            }
        }


        stage('Build Android APK') {
            steps {

                sh '''
                    set -e

                    test -f Dockerfile.android

                    docker build \
                        -f Dockerfile.android \
                        -t bestra-android:${BUILD_NUMBER} \
                        .

                    echo "Android APK Docker Build: PASS"
                '''
            }
        }


        stage('Archive Android APK') {
            steps {

                sh '''
                    set -e

                    docker rm -f bestra-android-extract 2>/dev/null || true

                    docker create \
                        --name bestra-android-extract \
                        bestra-android:${BUILD_NUMBER}

                    docker cp \
                        bestra-android-extract:/app/app/build/outputs/apk/debug/app-debug.apk \
                        bestra-debug-${BUILD_NUMBER}.apk

                    docker rm bestra-android-extract

                    test -f bestra-debug-${BUILD_NUMBER}.apk

                    ls -lh bestra-debug-${BUILD_NUMBER}.apk
                '''

                archiveArtifacts(
                    artifacts: "bestra-debug-${BUILD_NUMBER}.apk",
                    fingerprint: true
                )

                echo "Android APK archived successfully."
            }
        }


        // ============================================================
        // FRONTEND → DOCKERHUB
        // ============================================================

        stage('Docker Login to DockerHub') {
            steps {

                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_PASSWORD'
                    )
                ]) {

                    sh '''
                        set -e

                        echo "$DOCKERHUB_PASSWORD" | \
                            docker login \
                            --username "$DOCKERHUB_USERNAME" \
                            --password-stdin

                        echo "DockerHub Login: PASS"
                    '''
                }
            }
        }


        stage('Push Frontend to DockerHub') {
            steps {

                sh '''
                    set -e

                    FULL_FRONTEND_IMAGE="$DOCKERHUB_USERNAME/bestra-frontend:${BUILD_NUMBER}"

                    docker tag \
                        "$FRONTEND_IMAGE" \
                        "$FULL_FRONTEND_IMAGE"

                    docker push "$FULL_FRONTEND_IMAGE"

                    echo "Frontend pushed to DockerHub: PASS"
                '''
            }
        }


        // ============================================================
        // BACKEND → AZURE ACR
        // ============================================================

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
                        set -e

                        ACR_REGISTRY="bestraacr.azurecr.io"

                        echo "$ACR_PASSWORD" | \
                            docker login "$ACR_REGISTRY" \
                            --username "$ACR_USERNAME" \
                            --password-stdin

                        echo "ACR Login: PASS"
                    '''
                }
            }
        }


        stage('Push Backend to ACR') {
            steps {

                sh '''
                    set -e

                    docker push "$BACKEND_IMAGE"

                    echo "Backend pushed to ACR: PASS"
                '''
            }
        }


        // ============================================================
        // AZURE BACKEND
        // ============================================================

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
                        set -e

                        RESOURCE_GROUP="bestra-rg"
                        APP_NAME="bestra-backend"
                        ACR_REGISTRY="bestraacr.azurecr.io"

                        az login \
                            --service-principal \
                            --username "$AZURE_CLIENT_ID" \
                            --password "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID" \
                            --output none

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        az webapp config container set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --container-image-name "$BACKEND_IMAGE" \
                            --container-registry-url "https://$ACR_REGISTRY" \
                            --container-registry-user "$ACR_USERNAME" \
                            --container-registry-password "$ACR_PASSWORD"

                        az webapp config appsettings set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --settings WEBSITES_PORT=3000

                        az webapp restart \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME"

                        sleep 30

                        BACKEND_HOST=$(az webapp show \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --query defaultHostName \
                            --output tsv)

                        curl -f \
                            --max-time 30 \
                            "https://$BACKEND_HOST/health"

                        echo ""
                        echo "Backend Deployment: PASS"
                    '''
                }
            }
        }


        // ============================================================
        // FRONTEND → AZURE WEB APP
        // ============================================================

        stage('Deploy Frontend WebApp') {
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
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_PASSWORD'
                    )
                ]) {

                    sh '''
                        set -e

                        RESOURCE_GROUP="bestra-rg"
                        APP_NAME="bestra-frontend"

                        FRONTEND_IMAGE="$DOCKERHUB_USERNAME/bestra-frontend:${BUILD_NUMBER}"

                        az login \
                            --service-principal \
                            --username "$AZURE_CLIENT_ID" \
                            --password "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID" \
                            --output none

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        az webapp config container set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --container-image-name "$FRONTEND_IMAGE" \
                            --container-registry-url "https://index.docker.io" \
                            --container-registry-user "$DOCKERHUB_USERNAME" \
                            --container-registry-password "$DOCKERHUB_PASSWORD"

                        az webapp config appsettings set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --settings WEBSITES_PORT=80

                        az webapp restart \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME"

                        sleep 30

                        FRONTEND_HOST=$(az webapp show \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --query defaultHostName \
                            --output tsv)

                        curl -f \
                            --max-time 30 \
                            "https://$FRONTEND_HOST"

                        echo ""
                        echo "Frontend WebApp Deployment: PASS"
                    '''
                }
            }
        }


        // ============================================================
        // DAST
        // ============================================================

        stage('DAST - OWASP ZAP') {
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
                        set +e

                        RESOURCE_GROUP="bestra-rg"
                        APP_NAME="bestra-backend"

                        az login \
                            --service-principal \
                            --username "$AZURE_CLIENT_ID" \
                            --password "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID" \
                            --output none

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        BACKEND_HOST=$(az webapp show \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --query defaultHostName \
                            --output tsv)

                        BACKEND_URL="https://$BACKEND_HOST"

                        sleep 20

                        echo "Testing backend..."

                        curl -k \
                            --max-time 30 \
                            "$BACKEND_URL/health"

                        echo ""
                        echo "Starting OWASP ZAP..."

                        docker run --rm \
                            -v "$WORKSPACE:/zap/wrk/:rw" \
                            ghcr.io/zaproxy/zaproxy:stable \
                            zap-baseline.py \
                            -t "$BACKEND_URL" \
                            -r zap-report.html

                        ZAP_EXIT=$?

                        echo ""
                        echo "ZAP exit code: $ZAP_EXIT"

                        if [ -f zap-report.html ]; then
                            ls -lh zap-report.html
                        fi

                        echo ""
                        echo "DAST stage is non-blocking."

                        exit 0
                    '''
                }

                archiveArtifacts(
                    artifacts: 'zap-report.html',
                    allowEmptyArchive: true,
                    fingerprint: true
                )
            }
        }
    }


    post {

        success {
            echo "========================================"
            echo "BESTRA DEVSECOPS PIPELINE: SUCCESS"
            echo "Build ${BUILD_NUMBER} completed successfully."
            echo "========================================"
        }

        failure {
            echo "========================================"
            echo "BESTRA DEVSECOPS PIPELINE: FAILED"
            echo "Build ${BUILD_NUMBER} failed."
            echo "Check Jenkins logs."
            echo "========================================"
        }

        always {
            sh '''
                docker rm -f bestra-android-extract 2>/dev/null || true
            '''

            echo "Pipeline finished."
        }
    }
}
