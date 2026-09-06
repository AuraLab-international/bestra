pipeline {
    agent any

    environment {
        AZURE_RESOURCE_GROUP = 'bestra-rg'
        AZURE_APP_SERVICE_BACKEND = 'bestra-backend'
        AZURE_ACR_NAME = 'bestraacr'

        BACKEND_IMAGE = "${AZURE_ACR_NAME}.azurecr.io/bestra-backend"

        TRIVY_SKIP_DB_UPDATE = 'true'
    }

    stages {

        stage('Start') {
            steps {
                echo '🚀 Démarrage du pipeline DevSecOps Bestra'
                echo "Build #${BUILD_NUMBER}"
            }
        }

        stage('Clone from GitHub') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/AuraLab-international/bestra.git',
                    credentialsId: 'github-final'

                echo '✅ Code cloné'
            }
        }

        stage('Prepare') {
            steps {
                sh '''
                    echo "📦 Backend image: ${BACKEND_IMAGE}:${BUILD_NUMBER}"
                    echo "📱 Application: Bestra Mobile"
                    echo "📅 $(date)"

                    node --version
                    npm --version
                    docker --version
                '''
            }
        }

        stage('GitLeaks Secret Scan') {
            steps {
                sh '''
                    docker run --rm \
                        -v "$(pwd):/path" \
                        zricethezav/gitleaks \
                        detect --source=/path --verbose
                '''
            }
        }

        stage('SAST - SonarQube') {
            steps {
                sh '''
                    cd backend

                    npx sonar-scanner \
                        -Dsonar.projectKey=bestra-backend \
                        -Dsonar.sources=. \
                        -Dsonar.host.url=http://localhost:9000
                '''
            }
        }

        stage('Snyk Dependency Scan') {
            steps {
                sh '''
                    cd backend

                    npm install -g snyk

                    snyk test \
                        --severity-threshold=high
                '''
            }
        }

        stage('Backend Validation') {
            steps {
                dir('backend') {
                    sh '''
                        echo "⚙️ Installation des dépendances Backend"

                        npm ci --no-fund --no-audit

                        echo "🔎 Vérification du projet Backend"

                        npx prisma generate

                        echo "✅ Backend validé"
                    '''
                }
            }
        }

        stage('ReactLynx Build') {
            steps {
                dir('bestra') {
                    sh '''
                        echo "📱 Build ReactLynx"

                        npm ci --no-fund --no-audit

                        npm run build

                        echo "📦 Vérification du bundle Android"

                        test -f dist/main.lynx.bundle

                        ls -lh dist/main.lynx.bundle

                        echo "✅ ReactLynx build réussi"
                    '''
                }
            }
        }

        stage('Prepare Android Bundle') {
            steps {
                sh '''
                    echo "📲 Copie du bundle ReactLynx vers Android"

                    cp \
                        bestra/dist/main.lynx.bundle \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    ls -lh \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    echo "✅ Bundle Android préparé"
                '''
            }
        }

        stage('Build Android APK') {
            steps {
                sh '''
                    echo "🐳 Construction de l'image Android"

                    docker build \
                        -f Dockerfile.android \
                        -t bestra-android:${BUILD_NUMBER} \
                        .

                    echo "📦 Création du container Android"

                    CONTAINER_ID=$(docker create bestra-android:${BUILD_NUMBER})

                    echo "📥 Extraction de l'APK"

                    docker cp \
                        ${CONTAINER_ID}:/app/app/build/outputs/apk/debug/app-debug.apk \
                        ./bestra-debug.apk

                    docker rm ${CONTAINER_ID}

                    ls -lh ./bestra-debug.apk

                    echo "✅ APK Android généré"
                '''
            }
        }

        stage('Archive Android APK') {
            steps {
                archiveArtifacts artifacts: 'bestra-debug.apk',
                    fingerprint: true

                echo '📦 APK archivé dans Jenkins'
            }
        }

        stage('Build Backend Docker') {
            steps {
                sh '''
                    echo "🐳 Build Docker Backend"

                    docker build \
                        -f backend/Dockerfile \
                        -t ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                        backend/

                    docker tag \
                        ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                        ${BACKEND_IMAGE}:latest

                    echo "✅ Backend Docker image créée"
                '''
            }
        }

        stage('Trivy Backend Scan') {
            steps {
                sh '''
                    echo "🔐 Scan Trivy Backend"

                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        aquasec/trivy:latest \
                        image \
                        --severity HIGH,CRITICAL \
                        --ignore-unfixed \
                        ${BACKEND_IMAGE}:${BUILD_NUMBER}

                    echo "✅ Trivy terminé"
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
                        echo "$ACR_PASSWORD" | docker login \
                            ${AZURE_ACR_NAME}.azurecr.io \
                            -u "$ACR_USERNAME" \
                            --password-stdin

                        echo "✅ Login ACR réussi"
                    '''
                }
            }
        }

        stage('Push Backend to ACR') {
            steps {
                sh '''
                    echo "📤 Push Backend vers Azure Container Registry"

                    docker push ${BACKEND_IMAGE}:${BUILD_NUMBER}

                    docker push ${BACKEND_IMAGE}:latest

                    echo "✅ Backend poussé vers ACR"
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
                        echo "☁️ Connexion Azure"

                        az login \
                            --service-principal \
                            -u "$AZURE_CLIENT_ID" \
                            -p "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID"

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        echo "🚀 Déploiement Backend"

                        az webapp config container set \
                            --name ${AZURE_APP_SERVICE_BACKEND} \
                            --resource-group ${AZURE_RESOURCE_GROUP} \
                            --container-image-name ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                            --container-registry-url https://${AZURE_ACR_NAME}.azurecr.io

                        az webapp restart \
                            --name ${AZURE_APP_SERVICE_BACKEND} \
                            --resource-group ${AZURE_RESOURCE_GROUP}

                        echo "✅ Backend déployé"

                        echo "🌐 https://${AZURE_APP_SERVICE_BACKEND}.azurewebsites.net"
                    '''
                }
            }
        }

        stage('DAST - OWASP ZAP') {
            steps {
                sh '''
                    BACKEND_URL="https://${AZURE_APP_SERVICE_BACKEND}.azurewebsites.net"

                    echo "🔎 OWASP ZAP sur ${BACKEND_URL}/health"

                    docker run --rm \
                        -t \
                        owasp/zap2docker-stable \
                        zap-baseline.py \
                        -t "${BACKEND_URL}/health" \
                        -r zap-report.html
                '''

                archiveArtifacts artifacts: 'zap-report.html',
                    allowEmptyArchive: true
            }
        }
    }

    post {

        success {
            echo '======================================'
            echo '✅ PIPELINE BEStra RÉUSSI'
            echo '======================================'

            echo "📱 APK: bestra-debug.apk"
            echo "⚙️ Backend: https://${AZURE_APP_SERVICE_BACKEND}.azurewebsites.net"
        }

        failure {
            echo '======================================'
            echo '❌ PIPELINE BEStra ÉCHOUÉ'
            echo '======================================'
        }

        always {
            echo "📊 Durée: ${currentBuild.durationString}"
        }
    }
}
