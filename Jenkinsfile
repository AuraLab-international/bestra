pipeline {

    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
    }

    environment {

        // Azure
        AZURE_ACR = 'bestraacr.azurecr.io'
        RESOURCE_GROUP = 'bestra-rg'

        BACKEND_APP = 'bestra-backend'
        FRONTEND_APP = 'bestra-frontend'

        // Docker images
        BACKEND_IMAGE = "bestraacr.azurecr.io/bestra-backend:${BUILD_NUMBER}"
        FRONTEND_IMAGE = "bestra-frontend:${BUILD_NUMBER}"

        // Credentials
        DOCKERHUB_CREDENTIALS = 'dockerhub-creds'
        AZURE_CREDENTIALS = 'azure-service-principal'
        SNYK_CREDENTIALS = 'snyk-token'
    }

    stages {

        stage('Start') {
            steps {
                echo 'Starting Bestra DevSecOps Pipeline'
                echo "Build: ${BUILD_NUMBER}"
            }
        }

        stage('Clone from GitHub') {
            steps {
                checkout scm
            }
        }

        stage('Prepare') {
            steps {
                sh '''
                    set -e

                    echo "Preparing environment..."

                    node --version
                    npm --version
                    docker --version
                    git --version

                    echo "Environment ready."
                '''
            }
        }

        stage('GitLeaks Secret Scan') {
            steps {
                sh '''
                    set -e

                    echo "Running GitLeaks..."

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
                script {
                    if (env.SONAR_HOST_URL?.trim()) {
                        sh '''
                            set -e

                            echo "Running SonarQube SAST..."

                            docker run --rm \
                                -v "$WORKSPACE:/usr/src" \
                                sonarsource/sonar-scanner-cli:latest \
                                sonar-scanner \
                                -Dsonar.projectKey=bestra \
                                -Dsonar.sources=/usr/src/backend,/usr/src/bestra

                            echo "SonarQube: PASS"
                        '''
                    } else {
                        echo "SONAR_HOST_URL is not configured. SAST stage skipped."
                    }
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

                        echo "Running Snyk Dependency Scan..."

                        cd backend

                        npm ci --no-fund --no-audit

                        npx snyk auth "$SNYK_TOKEN"
                        npx snyk test --severity-threshold=high

                        echo "Snyk: PASS"
                    '''
                }
            }
        }

        stage('Parallel Build & Scan') {
    parallel {

        stage('Backend Build + Trivy') {
            steps {

                    dir('backend') {

                        echo "=== Backend Validation ==="

                        sh '''
                            set -e
                            npm ci --no-fund --no-audit
                            npx prisma generate
                            node --check src/index.js
                        '''

                        echo "Backend validation: PASS"

                        sh '''
                            set -e
                            docker build --pull -t "$BACKEND_IMAGE" .
                        '''

                        echo "Backend Docker Build: PASS"

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
                        '''

                        echo "Backend Build + Trivy: PASS"
                    }
                }

        }

        stage('Frontend Build + Trivy') {
            steps {

                    dir('bestra') {

                        echo "=== Frontend Build ==="

                        sh '''
                            set -e
                            npm ci
                            npm run build
                        '''

                        echo "ReactLynx Build: PASS"

                        sh '''
                            set -e
                            docker build --pull \
                                --build-arg PUBLIC_SERVER_IP="$PUBLIC_SERVER_IP" \
                                -t "$FRONTEND_IMAGE" .
                        '''

                        echo "Frontend Docker Build: PASS"

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
                        '''

                        echo "Frontend Build + Trivy: PASS"
                    }
                }

        }
    }
}

       stage('Prepare Android Bundle') {
            steps {
                sh '''
                    set -e

                    echo "Preparing Android bundle..."

                    test -f bestra/dist/main.lynx.bundle

                    ASSETS_DIR=$(find \
                        integrating-lynx/android/KotlinEmptyProject \
                        -type d \
                        -path "*/src/main/assets" \
                        -print -quit)

                    if [ -z "$ASSETS_DIR" ]; then
                        echo "Android assets directory not found."
                        exit 1
                    fi

                    cp bestra/dist/main.lynx.bundle "$ASSETS_DIR/main.lynx.bundle"

                    echo "Android bundle prepared."
                '''
            }
        }

        stage('Build Android APK') {
    steps {
        sh '''
            docker build -f Dockerfile.android -t bestra-android:${BUILD_NUMBER} .

            mkdir -p android-output

            CONTAINER_ID=$(docker create bestra-android:${BUILD_NUMBER})

            echo "Recherche de l'APK dans le container..."

            APK_PATH=$(docker exec "$CONTAINER_ID" sh -c \
                'find /app -type f -name "app-debug.apk" | head -n 1')

            if [ -z "$APK_PATH" ]; then
                echo "ERREUR: APK introuvable"
                docker rm "$CONTAINER_ID"
                exit 1
            fi

            echo "APK trouvé: $APK_PATH"

            docker cp "$CONTAINER_ID:$APK_PATH" \
                android-output/bestra-debug.apk

            docker rm "$CONTAINER_ID"

            ls -lh android-output/bestra-debug.apk
        '''
    }
}

                  

        stage('Archive Android') {
            steps {
                archiveArtifacts artifacts: 'android-output/bestra-debug.apk',
                    fingerprint: true
            }
        }

        stage('Docker Login to ACR') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'azure-service-principal',
                        usernameVariable: 'AZURE_CLIENT_ID',
                        passwordVariable: 'AZURE_CLIENT_SECRET'
                    ),
                    string(
                        credentialsId: 'azure-tenant-id',
                        variable: 'AZURE_TENANT'
                    ),
                    string(
                        credentialsId: 'azure-subscription-id',
                        variable: 'AZURE_SUBSCRIPTION'
                    )
                ]) {
                    sh '''
                        set -e

                        echo "Login to Azure..."

                        az login \
                            --service-principal \
                            -u "$AZURE_CLIENT_ID" \
                            -p "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT"

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION"

                        echo "Login to ACR..."

                        az acr login \
                            --name bestraacr

                        echo "ACR login: PASS"
                    '''
                }
            }
        }

        stage('Push Backend to ACR') {
            steps {
                sh '''
                    set -e

                    echo "Pushing backend to Azure Container Registry..."

                    docker push "$BACKEND_IMAGE"

                    docker tag \
                        "$BACKEND_IMAGE" \
                        "$AZURE_ACR/bestra-backend:latest"

                    docker push \
                        "$AZURE_ACR/bestra-backend:latest"

                    echo "Backend pushed to ACR."
                '''
            }
        }

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

                        echo "$DOCKERHUB_PASSWORD" | docker login \
                            -u "$DOCKERHUB_USERNAME" \
                            --password-stdin

                        echo "DockerHub login: PASS"
                    '''
                }
            }
        }

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

                        FRONTEND_DOCKERHUB_IMAGE="$DOCKERHUB_USERNAME/bestra-frontend:${BUILD_NUMBER}"

                        docker tag \
                            "$FRONTEND_IMAGE" \
                            "$FRONTEND_DOCKERHUB_IMAGE"

                        docker push \
                            "$FRONTEND_DOCKERHUB_IMAGE"

                        docker tag \
                            "$FRONTEND_IMAGE" \
                            "$DOCKERHUB_USERNAME/bestra-frontend:latest"

                        docker push \
                            "$DOCKERHUB_USERNAME/bestra-frontend:latest"

                        echo "Frontend pushed to DockerHub."
                    '''
                }
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
                        variable: 'AZURE_TENANT'
                    ),
                    string(
                        credentialsId: 'azure-subscription-id',
                        variable: 'AZURE_SUBSCRIPTION'
                    )
                ]) {
                    sh '''
                        set -e

                        echo "Deploying backend to Azure WebApp..."

                        az login \
                            --service-principal \
                            -u "$AZURE_CLIENT_ID" \
                            -p "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT"

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION"

                        az webapp config container set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$BACKEND_APP" \
                            --docker-custom-image-name "$BACKEND_IMAGE" \
                            --docker-registry-server-url "https://$AZURE_ACR"

                        az webapp restart \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$BACKEND_APP"

                        echo "Backend deployment completed."
                    '''
                }
            }
        }

        stage('Deploy Frontend WebApp') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_PASSWORD'
                    ),
                    usernamePassword(
                        credentialsId: 'azure-service-principal',
                        usernameVariable: 'AZURE_CLIENT_ID',
                        passwordVariable: 'AZURE_CLIENT_SECRET'
                    ),
                    string(
                        credentialsId: 'azure-tenant-id',
                        variable: 'AZURE_TENANT'
                    ),
                    string(
                        credentialsId: 'azure-subscription-id',
                        variable: 'AZURE_SUBSCRIPTION'
                    )
                ]) {
                    sh '''
                        set -e

                        FRONTEND_DOCKERHUB_IMAGE="$DOCKERHUB_USERNAME/bestra-frontend:${BUILD_NUMBER}"

                        echo "Deploying frontend to Azure WebApp..."

                        az login \
                            --service-principal \
                            -u "$AZURE_CLIENT_ID" \
                            -p "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT"

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION"

                        az webapp config container set \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$FRONTEND_APP" \
                            --docker-custom-image-name "$FRONTEND_DOCKERHUB_IMAGE" \
                            --docker-registry-server-url "https://index.docker.io/v1/" \
                            --docker-registry-server-user "$DOCKERHUB_USERNAME" \
                            --docker-registry-server-password "$DOCKERHUB_PASSWORD"

                        az webapp restart \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$FRONTEND_APP"

                        echo "Frontend deployment completed."
                    '''
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                sh '''
                    set -e

                    echo "Running OWASP ZAP..."

                    docker run --rm \
                        -t owasp/zap2docker-stable \
                        zap-baseline.py \
                        -t "https://$BACKEND_APP.azurewebsites.net/health" \
                        -r zap-report.html \
                        || true

                    echo "OWASP ZAP completed."
                '''
            }
        }

        stage('End') {
            steps {
                echo '========================================'
                echo 'Bestra DevSecOps Pipeline finished.'
                echo "Build: ${BUILD_NUMBER}"
                echo '========================================'
            }
        }
    }

    post {

        success {
            echo 'PIPELINE SUCCESS'
        }

        failure {
            echo 'PIPELINE FAILED'
        }

        always {
            echo 'Pipeline finished.'
        }
    }
}
