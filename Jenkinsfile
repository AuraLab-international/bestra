pipeline {

    agent any

    options {
        skipDefaultCheckout(true)
        timestamps()
    }

    environment {

        AZURE_ACR = 'bestraacr.azurecr.io'
        RESOURCE_GROUP = 'bestra-rg'

        AKS_NAME = 'bestra-aks'
        AKS_NAMESPACE = 'bestra'

        BACKEND_APP = 'bestra-backend'
        FRONTEND_APP = 'bestra-frontend'

        BACKEND_IMAGE = "bestraacr.azurecr.io/bestra-backend:${BUILD_NUMBER}"
        FRONTEND_IMAGE = "bestra-frontend:${BUILD_NUMBER}"

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
                    kubectl version --client
                    az version

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

                        npx snyk test \
                            --severity-threshold=high

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

                                docker build --pull \
                                    -t "$BACKEND_IMAGE" .
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

                    cp bestra/dist/main.lynx.bundle \
                        "$ASSETS_DIR/main.lynx.bundle"

                    echo "Android bundle prepared."
                '''
            }
        }


        stage('Build Android APK') {

            steps {

                sh '''
                    set -e

                    echo "Building Android APK..."

                    docker build \
                        -f Dockerfile.android \
                        -t bestra-android:${BUILD_NUMBER} .

                    mkdir -p android-output

                    CONTAINER_ID=$(docker create \
                        bestra-android:${BUILD_NUMBER})

                    echo "Copying APK from container..."

                    docker cp \
                        "$CONTAINER_ID:/app/app/build/outputs/apk/debug/app-debug.apk" \
                        android-output/bestra-debug.apk

                    docker rm "$CONTAINER_ID"

                    echo "APK successfully extracted:"

                    ls -lh android-output/bestra-debug.apk
                '''
            }
        }


        stage('Archive Android') {

            steps {

                archiveArtifacts \
                    artifacts: 'android-output/bestra-debug.apk',
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
                            --tenant "$AZURE_TENANT" \
                            --output none

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


        stage('Deploy Backend to AKS') {

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

                        echo "========================================"
                        echo "Deploying Backend to AKS"
                        echo "========================================"

                        echo "Logging into Azure..."

                        az login \
                            --service-principal \
                            -u "$AZURE_CLIENT_ID" \
                            -p "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT" \
                            --output none

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION"

                        echo "Getting AKS credentials..."

                        az aks get-credentials \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$AKS_NAME" \
                            --overwrite-existing

                        echo "Updating backend image..."

                        kubectl -n "$AKS_NAMESPACE" set image \
                            deployment/bestra-backend \
                            backend="$BACKEND_IMAGE"

                        echo "Waiting for backend rollout..."

                        kubectl -n "$AKS_NAMESPACE" rollout status \
                            deployment/bestra-backend \
                            --timeout=5m

                        echo "Backend successfully deployed to AKS."

                        kubectl -n "$AKS_NAMESPACE" get deployment \
                            bestra-backend

                        kubectl -n "$AKS_NAMESPACE" get pods \
                            -l app=bestra-backend
                    '''
                }
            }
        }


        stage('Deploy Frontend to AKS') {

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
                    ),

                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_PASSWORD'
                    )

                ]) {

                    sh '''
                        set -e

                        echo "========================================"
                        echo "Deploying Frontend to AKS"
                        echo "========================================"

                        echo "Logging into Azure..."

                        az login \
                            --service-principal \
                            -u "$AZURE_CLIENT_ID" \
                            -p "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT" \
                            --output none

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION"

                        echo "Getting AKS credentials..."

                        az aks get-credentials \
                            --resource-group "$RESOURCE_GROUP" \
                            --name "$AKS_NAME" \
                            --overwrite-existing

                        FRONTEND_DOCKERHUB_IMAGE="$DOCKERHUB_USERNAME/bestra-frontend:${BUILD_NUMBER}"

                        echo "Frontend image:"
                        echo "$FRONTEND_DOCKERHUB_IMAGE"

                        echo "Updating frontend image..."

                        kubectl -n "$AKS_NAMESPACE" set image \
                            deployment/bestra-frontend \
                            frontend="$FRONTEND_DOCKERHUB_IMAGE"

                        echo "Waiting for frontend rollout..."

                        kubectl -n "$AKS_NAMESPACE" rollout status \
                            deployment/bestra-frontend \
                            --timeout=5m

                        echo "Frontend successfully deployed to AKS."

                        kubectl -n "$AKS_NAMESPACE" get deployment \
                            bestra-frontend

                        kubectl -n "$AKS_NAMESPACE" get pods \
                            -l app=bestra-frontend
                    '''
                }
            }
        }


        stage('Verify AKS Deployment') {

            steps {

                sh '''
                    set -e

                    echo "========================================"
                    echo "AKS DEPLOYMENT VERIFICATION"
                    echo "========================================"

                    echo ""
                    echo "=== AKS Nodes ==="

                    kubectl get nodes

                    echo ""
                    echo "=== Deployments ==="

                    kubectl get deployments \
                        -n "$AKS_NAMESPACE"

                    echo ""
                    echo "=== Pods ==="

                    kubectl get pods \
                        -n "$AKS_NAMESPACE"

                    echo ""
                    echo "=== Services ==="

                    kubectl get services \
                        -n "$AKS_NAMESPACE"

                    echo ""
                    echo "=== Ingress ==="

                    kubectl get ingress \
                        -n "$AKS_NAMESPACE"

                    echo ""
                    echo "=== Backend Health Check ==="

                    kubectl run bestra-health-check \
                        --image=curlimages/curl \
                        --namespace="$AKS_NAMESPACE" \
                        --restart=Never \
                        --rm \
                        -i \
                        -- \
                        curl -f http://bestra-backend:3000/health

                    echo ""
                    echo "========================================"
                    echo "AKS deployment verified successfully."
                    echo "========================================"
                '''
            }
        }


        stage('DAST - OWASP ZAP') {

            steps {

                sh '''
                    set -e

                    echo "========================================"
                    echo "Running OWASP ZAP against AKS HTTPS"
                    echo "========================================"

                    docker run --rm \
                        -t \
                        owasp/zap2docker-stable \
                        zap-baseline.py \
                        -t "https://9.160.154.123" \
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
    }
}
