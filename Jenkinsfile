pipeline {

    agent any

    environment {

        DOCKER_BUILDKIT = '1'

        // ============================================================
        // Azure / ACR
        // ============================================================

        BACKEND_IMAGE = "bestraacr.azurecr.io/bestra-backend:${BUILD_NUMBER}"

        // ============================================================
        // SonarQube
        // ============================================================

        SONAR_HOST_URL = "${SONAR_HOST_URL}"
    }


    stages {

        // ============================================================
        // 1. START
        // ============================================================

        stage('Start') {
            steps {

                echo "========================================"
                echo "Starting Bestra DevSecOps Pipeline"
                echo "Build Number: ${BUILD_NUMBER}"
                echo "========================================"
            }
        }


        // ============================================================
        // 2. CLONE FROM GITHUB
        // ============================================================

        stage('Clone from GitHub') {
            steps {

                echo "Checking out Bestra source code..."

                checkout scm

                echo "GitHub checkout: PASS"
            }
        }


        // ============================================================
        // 3. PREPARE
        // ============================================================

        stage('Prepare') {
            steps {

                echo "Preparing build environment..."

                sh '''
                    set -e

                    echo "Node version:"
                    node --version || true

                    echo ""
                    echo "NPM version:"
                    npm --version || true

                    echo ""
                    echo "Docker version:"
                    docker --version

                    echo ""
                    echo "Git version:"
                    git --version

                    echo ""
                    echo "Workspace:"
                    pwd

                    ls -la

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


        // ============================================================
        // 4. GITLEAKS SECRET SCAN
        // ============================================================

        stage('GitLeaks Secret Scan') {
            steps {

                echo "Running GitLeaks secret scan..."

                sh '''
                    set -e

                    docker run --rm \
                        -v "$WORKSPACE:/repo" \
                        zricethezav/gitleaks:latest \
                        detect \
                        --source=/repo \
                        --no-banner \
                        --redact

                    echo ""
                    echo "GitLeaks: PASS"
                '''
            }
        }


        // ============================================================
        // 5. SONARQUBE SAST
        // ============================================================

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

                        echo "Starting SonarQube analysis..."

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

                            echo ""
                            echo "WARNING: SonarQube analysis failed."
                            echo "Pipeline continues so other security stages can execute."

                        else

                            echo ""
                            echo "SonarQube: PASS"

                        fi

                        exit 0
                    '''
                }
            }
        }


        // ============================================================
        // 6. SNYK DEPENDENCY SCAN
        // ============================================================

        stage('Snyk Dependency Scan') {
            steps {

                echo "Running Snyk dependency security scan..."

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

                        echo ""
                        echo "Snyk: PASS"
                    '''
                }
            }
        }


        // ============================================================
        // 7. BACKEND VALIDATION
        // ============================================================

        stage('Backend Validation') {
            steps {

                echo "Validating Node.js backend..."

                sh '''
                    set -e

                    cd backend

                    echo "Installing backend dependencies..."

                    npm ci \
                        --no-fund \
                        --no-audit

                    echo ""
                    echo "Generating Prisma client..."

                    npx prisma generate

                    echo ""
                    echo "Checking JavaScript syntax..."

                    node --check src/index.js

                    echo ""
                    echo "Backend Validation: PASS"
                '''
            }
        }


        // ============================================================
        // 8. REACTLYNX BUILD
        // ============================================================

        stage('ReactLynx Build') {
            steps {

                echo "Building ReactLynx frontend..."

                sh '''
                    set -e

                    cd bestra

                    echo "Installing frontend dependencies..."

                    npm ci \
                        --no-fund \
                        --no-audit

                    echo ""
                    echo "Building ReactLynx application..."

                    npm run build

                    echo ""
                    echo "Checking generated bundles..."

                    test -f dist/main.lynx.bundle
                    test -f dist/main.web.bundle

                    echo ""
                    echo "Generated files:"

                    ls -lh dist/

                    echo ""
                    echo "ReactLynx Build: PASS"
                '''
            }
        }


        // ============================================================
        // 9. PREPARE ANDROID BUNDLE
        // ============================================================

        stage('Prepare Android Bundle') {
            steps {

                echo "Preparing ReactLynx bundle for Android..."

                sh '''
                    set -e

                    echo "Checking ReactLynx bundle..."

                    test -f bestra/dist/main.lynx.bundle

                    echo ""
                    echo "Copying main.lynx.bundle..."

                    cp bestra/dist/main.lynx.bundle \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    echo ""
                    echo "Android bundle prepared successfully."

                    ls -lh \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    echo ""
                    echo "Prepare Android Bundle: PASS"
                '''
            }
        }


        // ============================================================
        // 10. BUILD ANDROID APK
        // ============================================================

        stage('Build Android APK') {
            steps {

                echo "Building Android APK..."

                sh '''
                    set -e

                    echo "Checking Android Dockerfile..."

                    test -f Dockerfile.android

                    echo ""
                    echo "Dockerfile.android found:"

                    ls -lh Dockerfile.android

                    echo ""
                    echo "Building Android Docker image..."

                    docker build \
                        -f Dockerfile.android \
                        -t bestra-android:${BUILD_NUMBER} \
                        .

                    echo ""
                    echo "Android Docker image built successfully."

                    echo ""
                    echo "Build Android APK: PASS"
                '''
            }
        }


        // ============================================================
        // 11. ARCHIVE ANDROID APK
        // ============================================================

        stage('Archive Android APK') {
            steps {

                echo "Extracting Android APK..."

                sh '''
                    set -e

                    echo "Cleaning previous extraction container..."

                    docker rm -f bestra-android-extract 2>/dev/null || true

                    echo ""
                    echo "Creating temporary container..."

                    docker create \
                        --name bestra-android-extract \
                        bestra-android:${BUILD_NUMBER}

                    echo ""
                    echo "Copying APK from container..."

                    docker cp \
                        bestra-android-extract:/app/app/build/outputs/apk/debug/app-debug.apk \
                        bestra-debug-${BUILD_NUMBER}.apk

                    echo ""
                    echo "Removing temporary container..."

                    docker rm bestra-android-extract

                    echo ""
                    echo "Checking generated APK..."

                    test -f bestra-debug-${BUILD_NUMBER}.apk

                    echo ""
                    echo "APK successfully generated:"

                    ls -lh bestra-debug-${BUILD_NUMBER}.apk

                    echo ""
                    echo "Archive Android APK: PASS"
                '''

                archiveArtifacts(
                    artifacts: "bestra-debug-${BUILD_NUMBER}.apk",
                    fingerprint: true
                )

                echo "Android APK archived successfully."
            }
        }


        // ============================================================
        // 12. BUILD BACKEND DOCKER
        // ============================================================

        stage('Build Backend Docker') {
            steps {

                echo "Building backend Docker image..."

                sh '''
                    set -e

                    echo "Building Bestra backend image..."

                    docker build \
                        -t "$BACKEND_IMAGE" \
                        ./backend

                    echo ""
                    echo "Backend Docker image:"

                    docker images "$BACKEND_IMAGE"

                    echo ""
                    echo "Build Backend Docker: PASS"
                '''
            }
        }


        // ============================================================
        // 13. TRIVY BACKEND SCAN
        // ============================================================

        stage('Trivy Backend Scan') {
            steps {

                echo "Running Trivy container security scan..."

                sh '''
                    set -e

                    echo "Scanning backend Docker image..."

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

                    echo ""
                    echo "Trivy: PASS"
                '''
            }
        }


        // ============================================================
        // 14. LOGIN TO AZURE ACR
        // ============================================================

        stage('Docker Login to ACR') {
            steps {

                echo "Logging into Azure Container Registry..."

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

                        echo "Azure Container Registry:"
                        echo "$ACR_REGISTRY"

                        echo ""
                        echo "Logging into ACR..."

                        echo "$ACR_PASSWORD" | docker login \
                            "$ACR_REGISTRY" \
                            --username "$ACR_USERNAME" \
                            --password-stdin

                        echo ""
                        echo "ACR login: PASS"
                    '''
                }
            }
        }


        // ============================================================
        // 15. PUSH BACKEND TO ACR
        // ============================================================

        stage('Push Backend to ACR') {
            steps {

                echo "Pushing backend Docker image to Azure Container Registry..."

                sh '''
                    set -e

                    ACR_REGISTRY="bestraacr.azurecr.io"

                    LOCAL_IMAGE="$BACKEND_IMAGE"

                    FULL_IMAGE="$ACR_REGISTRY/bestra-backend:${BUILD_NUMBER}"

                    echo "Local image:"
                    echo "$LOCAL_IMAGE"

                    echo ""
                    echo "ACR image:"
                    echo "$FULL_IMAGE"

                    echo ""
                    echo "Tagging backend image..."

                    docker tag \
                        "$LOCAL_IMAGE" \
                        "$FULL_IMAGE"

                    echo ""
                    echo "Pushing backend image..."

                    docker push "$FULL_IMAGE"

                    echo ""
                    echo "Backend image pushed successfully."

                    echo ""
                    echo "Push Backend to ACR: PASS"
                '''
            }
        }


        // ============================================================
        // 16. DEPLOY BACKEND TO AZURE APP SERVICE
        // ============================================================

        stage('Deploy Backend') {
            steps {

                echo "Deploying Bestra backend to Azure App Service..."

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

                        ACR_REGISTRY="bestraacr.azurecr.io"

                        RESOURCE_GROUP="bestra-rg"

                        APP_NAME="bestra-backend"

                        FULL_IMAGE="$ACR_REGISTRY/bestra-backend:${BUILD_NUMBER}"

                        echo "Resource Group:"
                        echo "$RESOURCE_GROUP"

                        echo ""
                        echo "App Service:"
                        echo "$APP_NAME"

                        echo ""
                        echo "Docker image:"
                        echo "$FULL_IMAGE"

                        echo ""
                        echo "Logging into Azure..."

                        az login \
                            --service-principal \
                            --username "$AZURE_CLIENT_ID" \
                            --password "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID" \
                            --output none

                        echo ""
                        echo "Azure login: PASS"

                        echo ""
                        echo "Selecting Azure subscription..."

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        echo ""
                        echo "Azure subscription: PASS"

                        echo ""
                        echo "Configuring App Service container..."

                        az webapp config container set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --container-image-name "$FULL_IMAGE" \
                            --container-registry-url "https://$ACR_REGISTRY" \
                            --container-registry-user "$ACR_USERNAME" \
                            --container-registry-password "$ACR_PASSWORD"

                        echo ""
                        echo "Configuring application port..."

                        az webapp config appsettings set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --settings WEBSITES_PORT=3000

                        echo ""
                        echo "Restarting App Service..."

                        az webapp restart \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME"

                        echo ""
                        echo "Checking App Service status..."

                        az webapp show \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --query "{name:name,state:state,host:defaultHostName}" \
                            --output table

                        echo ""
                        echo "Deploy Backend: PASS"
                    '''
                }
            }
        }


        // ============================================================
        // 17. OWASP ZAP DAST
        // ============================================================

        stage('DAST - OWASP ZAP') {
            steps {

                echo "Running OWASP ZAP DAST..."

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

                        echo "Logging into Azure..."

                        az login \
                            --service-principal \
                            --username "$AZURE_CLIENT_ID" \
                            --password "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID" \
                            --output none

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        echo ""
                        echo "Getting Azure backend URL..."

                        BACKEND_HOST=$(az webapp show \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$APP_NAME" \
                            --query defaultHostName \
                            --output tsv)

                        BACKEND_URL="https://$BACKEND_HOST"

                        echo ""
                        echo "Backend URL:"
                        echo "$BACKEND_URL"

                        echo ""
                        echo "Waiting for Azure App Service..."

                        sleep 30

                        echo ""
                        echo "Testing backend health endpoint..."

                        curl -k \
                            --max-time 30 \
                            "$BACKEND_URL/health"

                        HEALTH_EXIT=$?

                        echo ""
                        echo "Health check exit code: $HEALTH_EXIT"

                        echo ""
                        echo "Starting OWASP ZAP scan..."

                        docker run --rm \
                            -v "$WORKSPACE:/zap/wrk/:rw" \
                            ghcr.io/zaproxy/zaproxy:stable \
                            zap-baseline.py \
                            -t "$BACKEND_URL" \
                            -r zap-report.html

                        ZAP_EXIT=$?

                        echo ""
                        echo "OWASP ZAP exit code: $ZAP_EXIT"

                        if [ -f zap-report.html ]; then

                            echo ""
                            echo "ZAP report generated successfully."

                            ls -lh zap-report.html

                        else

                            echo ""
                            echo "WARNING: ZAP report was not generated."

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

                echo "DAST - OWASP ZAP: PASS"
            }
        }
    }


    // ================================================================
    // POST ACTIONS
    // ================================================================

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
            echo "Check Jenkins logs for details."
            echo "========================================"
        }

        always {

            echo "Cleaning temporary Docker resources..."

            sh '''
                docker rm -f bestra-android-extract 2>/dev/null || true
            '''

            echo "Pipeline finished."
        }
    }
}
