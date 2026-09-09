pipeline {

    agent any

    environment {

        // Azure
        AZURE_ACR = 'bestraacr.azurecr.io'
        RESOURCE_GROUP = 'bestra-rg'

        BACKEND_APP = 'bestra-backend'
        FRONTEND_APP = 'bestra-frontend'

        // Docker images
        BACKEND_IMAGE = "${AZURE_ACR}/bestra-backend:${BUILD_NUMBER}"
        FRONTEND_IMAGE = "bestra-frontend:${BUILD_NUMBER}"

        // DockerHub
        DOCKERHUB_CREDENTIALS = 'dockerhub-creds'

        // Azure credentials
        AZURE_CREDENTIALS = 'azure-service-principal'

        // Snyk
        SNYK_CREDENTIALS = 'snyk-token'
    }

    stages {

        // =========================================================
        // 1 - CLONE
        // =========================================================

        stage('Clone from GitHub') {
            steps {
                checkout scm
            }
        }


        // =========================================================
        // 2 - PREPARE
        // =========================================================

        stage('Prepare') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Preparing Bestra CI/CD environment"
                    echo "======================================"

                    node --version
                    npm --version
                    docker --version
                    java -version

                    echo "Workspace:"
                    pwd

                    echo "Project:"
                    ls -la
                '''
            }
        }


        // =========================================================
        // 3 - GITLEAKS
        // =========================================================

        stage('GitLeaks Secret Scan') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "GitLeaks Secret Scan"
                    echo "======================================"

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


        // =========================================================
        // 4 - SAST SONARQUBE
        // =========================================================

        stage('SAST - SonarQube') {
            steps {
                script {

                    echo "======================================"
                    echo "SAST - SonarQube"
                    echo "======================================"

                    catchError(
                        buildResult: 'SUCCESS',
                        stageResult: 'UNSTABLE'
                    ) {
                        withSonarQubeEnv('SonarQube') {

                            sh '''
                                set -e

                                if command -v sonar-scanner >/dev/null 2>&1; then

                                    sonar-scanner \
                                        -Dsonar.projectKey=bestra \
                                        -Dsonar.projectName=Bestra \
                                        -Dsonar.sources=backend,bestra

                                else

                                    echo "SonarScanner not installed."
                                    echo "SonarQube stage skipped."

                                fi
                            '''
                        }
                    }
                }
            }
        }


        // =========================================================
        // 5 - SNYK
        // =========================================================

        stage('Snyk Dependency Scan') {
            steps {
                withCredentials([
                    string(
                        credentialsId: "${SNYK_CREDENTIALS}",
                        variable: 'SNYK_TOKEN'
                    )
                ]) {

                    sh '''
                        set -e

                        echo "======================================"
                        echo "Snyk Dependency Scan"
                        echo "======================================"

                        cd backend

                        npm ci --no-fund --no-audit

                        npx snyk test \
                            --severity-threshold=high

                        echo "Snyk: PASS"
                    '''
                }
            }
        }


        // =========================================================
        // 6 - PARALLEL BUILD & SCAN
        // =========================================================

        stage('Parallel Build & Scan') {

            parallel {

                // -------------------------------------------------
                // BACKEND
                // -------------------------------------------------

                stage('Backend Build + Trivy') {

                    stages {

                        stage('Backend Validation') {
                            steps {
                                sh '''
                                    set -e

                                    echo "======================================"
                                    echo "Backend Validation"
                                    echo "======================================"

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

                                    echo "======================================"
                                    echo "Backend Docker Build"
                                    echo "======================================"

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

                                    echo "======================================"
                                    echo "Backend Trivy Scan"
                                    echo "======================================"

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


                // -------------------------------------------------
                // FRONTEND
                // -------------------------------------------------

                stage('Frontend Build + Trivy') {

                    stages {

                        stage('ReactLynx Build') {
                            steps {
                                sh '''
                                    set -e

                                    echo "======================================"
                                    echo "ReactLynx Build"
                                    echo "======================================"

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

                                    echo "======================================"
                                    echo "Frontend Docker Build"
                                    echo "======================================"

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

                                    echo "======================================"
                                    echo "Frontend Trivy Scan"
                                    echo "======================================"

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


        // =========================================================
        // 7 - ANDROID BUNDLE
        // =========================================================

        stage('Prepare Android Bundle') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Prepare Android Bundle"
                    echo "======================================"

                    test -f bestra/dist/main.lynx.bundle

                    cp bestra/dist/main.lynx.bundle \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/

                    echo "Android bundle prepared."
                '''
            }
        }


        // =========================================================
        // 8 - BUILD ANDROID APK
        // =========================================================

        stage('Build Android APK') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Build Android APK"
                    echo "======================================"

                    docker build \
                        -f Dockerfile.android \
                        -t bestra-android:${BUILD_NUMBER} \
                        .

                    docker create \
                        --name bestra-android-${BUILD_NUMBER} \
                        bestra-android:${BUILD_NUMBER}

                    docker cp \
                        bestra-android-${BUILD_NUMBER}:/app/app/build/outputs/apk/debug/app-debug.apk \
                        ./bestra-${BUILD_NUMBER}.apk

                    docker rm \
                        bestra-android-${BUILD_NUMBER}

                    test -f ./bestra-${BUILD_NUMBER}.apk

                    echo "Android APK build: PASS"
                '''
            }
        }


        // =========================================================
        // 9 - ARCHIVE APK
        // =========================================================

        stage('Archive Android') {
            steps {
                archiveArtifacts artifacts: 'bestra-*.apk',
                                 fingerprint: true

                echo "Android APK archived."
            }
        }


        // =========================================================
        // 10 - LOGIN ACR
        // =========================================================

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

                        echo "======================================"
                        echo "Docker Login to Azure ACR"
                        echo "======================================"

                        echo "$ACR_PASSWORD" | docker login \
                            "$AZURE_ACR" \
                            -u "$ACR_USERNAME" \
                            --password-stdin

                        echo "ACR Login: PASS"
                    '''
                }
            }
        }


        // =========================================================
        // 11 - PUSH BACKEND ACR
        // =========================================================

        stage('Push Backend to ACR') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Push Backend to ACR"
                    echo "======================================"

                    docker push "$BACKEND_IMAGE"

                    echo "Backend pushed to ACR."
                '''
            }
        }


        // =========================================================
        // 12 - LOGIN DOCKERHUB
        // =========================================================

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

                        echo "======================================"
                        echo "Docker Login to DockerHub"
                        echo "======================================"

                        echo "$DOCKERHUB_PASSWORD" | docker login \
                            -u "$DOCKERHUB_USERNAME" \
                            --password-stdin

                        echo "DockerHub Login: PASS"
                    '''
                }
            }
        }


        // =========================================================
        // 13 - PUSH FRONTEND DOCKERHUB
        // =========================================================

        stage('Push Frontend to DockerHub') {
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

                        echo "======================================"
                        echo "Push Frontend to DockerHub"
                        echo "======================================"

                        FULL_FRONTEND_IMAGE="$DOCKERHUB_USERNAME/bestra-frontend:${BUILD_NUMBER}"

                        docker tag \
                            "$FRONTEND_IMAGE" \
                            "$FULL_FRONTEND_IMAGE"

                        docker push "$FULL_FRONTEND_IMAGE"

                        echo "Frontend pushed to DockerHub:"
                        echo "$FULL_FRONTEND_IMAGE"
                    '''
                }
            }
        }


        // =========================================================
        // 14 - DEPLOY BACKEND
        // =========================================================

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
                        set -e

                        echo "======================================"
                        echo "Deploy Backend to Azure"
                        echo "======================================"

                        az login \
                            --service-principal \
                            -u "$AZURE_CLIENT_ID" \
                            -p "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID"

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        az webapp config container set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$BACKEND_APP" \
                            --container-image-name "$BACKEND_IMAGE" \
                            --container-registry-url "https://$AZURE_ACR"

                        az webapp restart \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$BACKEND_APP"

                        echo "Backend deployment: PASS"
                    '''
                }
            }
        }


        // =========================================================
        // 15 - DEPLOY FRONTEND WEBAPP
        // =========================================================

        stage('Deploy Frontend WebApp') {
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

                        echo "======================================"
                        echo "Deploy Frontend WebApp"
                        echo "======================================"

                        FULL_FRONTEND_IMAGE="$DOCKERHUB_USERNAME/bestra-frontend:${BUILD_NUMBER}"

                        az webapp config container set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$FRONTEND_APP" \
                            --container-image-name "$FULL_FRONTEND_IMAGE" \
                            --container-registry-url "https://index.docker.io"

                        az webapp restart \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$FRONTEND_APP"

                        echo "Frontend WebApp deployment: PASS"
                    '''
                }
            }
        }


        // =========================================================
        // 16 - DAST OWASP ZAP
        // =========================================================

        stage('DAST - OWASP ZAP') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "DAST - OWASP ZAP"
                    echo "======================================"

                    docker run --rm \
                        -t \
                        owasp/zap2docker-stable \
                        zap-baseline.py \
                        -t "https://${BACKEND_APP}.azurewebsites.net/health" \
                        -r zap-report.html \
                        || true

                    echo "OWASP ZAP scan completed."
                '''
            }
        }


        // =========================================================
        // 17 - END
        // =========================================================

        stage('End') {
            steps {
                echo "======================================"
                echo "Pipeline finished."
                echo "======================================"
            }
        }
    }


    // =============================================================
    // POST
    // =============================================================

    post {

        success {
            echo '''
========================================
        B E S T R A
     PIPELINE SUCCESS
========================================
'''
        }

        failure {
            echo '''
========================================
        B E S T R A
     PIPELINE FAILED
========================================
'''
        }

        always {
            sh '''
                docker logout "$AZURE_ACR" || true
                docker logout || true
            '''

            echo "Jenkins pipeline finished."
        }
    }
}
