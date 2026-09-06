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

        // =========================================================
        // 1. START
        // =========================================================
        stage('Start') {
            steps {
                echo '🚀 Démarrage du pipeline DevSecOps Bestra'
                echo "Build #${BUILD_NUMBER}"
            }
        }

        // =========================================================
        // 2. CLONE
        // =========================================================
        stage('Clone from GitHub') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/AuraLab-international/bestra.git',
                    credentialsId: 'github-final'

                echo '✅ Code cloné depuis GitHub'
            }
        }

        // =========================================================
        // 3. PREPARE
        // =========================================================
        stage('Prepare') {
            steps {
                sh '''
                    echo "📦 Backend image: ${BACKEND_IMAGE}:${BUILD_NUMBER}"
                    echo "📱 Application: Bestra Mobile"
                    echo "📅 $(date)"

                    echo "Node:"
                    node --version

                    echo "NPM:"
                    npm --version

                    echo "Docker:"
                    docker --version
                '''
            }
        }

        // =========================================================
        // 4. GITLEAKS
        // =========================================================
        stage('GitLeaks Secret Scan') {
            steps {
                sh '''
                    echo "🔐 Scan des secrets avec GitLeaks"

                    docker run --rm \
                        -v "$(pwd):/path" \
                        zricethezav/gitleaks \
                        detect \
                        --source=/path \
                        --verbose

                    echo "✅ GitLeaks terminé"
                '''
            }
        }

        // =========================================================
        // 5. SONARQUBE
        // =========================================================
        stage('SAST - SonarQube') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'sonar-token',
                        variable: 'SONAR_TOKEN'
                    )
                ]) {
                    sh '''
                        echo "🔍 Analyse SAST avec SonarQube"

                        cd backend

                        npx sonar-scanner \
                            -Dsonar.projectKey=bestra-backend \
                            -Dsonar.sources=. \
                            -Dsonar.host.url=http://localhost:9000 \
                            -Dsonar.token="$SONAR_TOKEN"

                        echo "✅ Analyse SonarQube terminée"
                    '''
                }
            }
        }

        // =========================================================
        // 6. SNYK
        // =========================================================
        stage('Snyk Dependency Scan') {
            steps {
                sh '''
                    echo "🛡️ Analyse des dépendances avec Snyk"

                    cd backend

                    npm install -g snyk

                    snyk test \
                        --severity-threshold=high

                    echo "✅ Snyk terminé"
                '''
            }
        }

        // =========================================================
        // 7. BACKEND VALIDATION
        // =========================================================
        stage('Backend Validation') {
            steps {
                dir('backend') {
                    sh '''
                        echo "⚙️ Installation des dépendances Backend"

                        npm ci --no-fund --no-audit

                        echo "🔎 Génération Prisma"

                        npx prisma generate

                        echo "✅ Backend validé"
                    '''
                }
            }
        }

        // =========================================================
        // 8. REACTLYNX BUILD
        // =========================================================
        stage('ReactLynx Build') {
            steps {
                dir('bestra') {
                    sh '''
                        echo "📱 Build de l'application ReactLynx"

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

        // =========================================================
        // 9. PREPARE ANDROID
        // =========================================================
        stage('Prepare Android Bundle') {
            steps {
                sh '''
                    echo "📲 Copie du bundle ReactLynx vers Android"

                    cp \
                        bestra/dist/main.lynx.bundle \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    echo "📦 Bundle Android :"

                    ls -lh \
                        integrating-lynx/android/KotlinEmptyProject/app/src/main/assets/main.lynx.bundle

                    echo "✅ Bundle Android préparé"
                '''
            }
        }

        // =========================================================
        // 10. BUILD ANDROID APK
        // =========================================================
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

                    echo "📱 APK généré :"

                    ls -lh ./bestra-debug.apk

                    echo "✅ APK Android généré"
                '''
            }
        }

        // =========================================================
        // 11. ARCHIVE APK
        // =========================================================
        stage('Archive Android APK') {
            steps {
                archiveArtifacts artifacts: 'bestra-debug.apk',
                    fingerprint: true

                echo '📦 APK archivé dans Jenkins'
            }
        }

        // =========================================================
        // 12. BUILD BACKEND DOCKER
        // =========================================================
        stage('Build Backend Docker') {
            steps {
                sh '''
                    echo "🐳 Build de l'image Docker Backend"

                    docker build \
                        -f backend/Dockerfile \
                        -t ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                        backend/

                    docker tag \
                        ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                        ${BACKEND_IMAGE}:latest

                    echo "✅ Image Backend créée"
                '''
            }
        }

        // =========================================================
        // 13. TRIVY
        // =========================================================
        stage('Trivy Backend Scan') {
            steps {
                sh '''
                    echo "🔐 Scan de sécurité Docker avec Trivy"

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

        // =========================================================
        // 14. LOGIN ACR
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
                        echo "$ACR_PASSWORD" | docker login \
                            ${AZURE_ACR_NAME}.azurecr.io \
                            -u "$ACR_USERNAME" \
                            --password-stdin

                        echo "✅ Login Azure Container Registry réussi"
                    '''
                }
            }
        }

        // =========================================================
        // 15. PUSH BACKEND ACR
        // =========================================================
        stage('Push Backend to ACR') {
            steps {
                sh '''
                    echo "📤 Push Backend vers Azure Container Registry"

                    docker push \
                        ${BACKEND_IMAGE}:${BUILD_NUMBER}

                    docker push \
                        ${BACKEND_IMAGE}:latest

                    echo "✅ Backend poussé vers ACR"
                '''
            }
        }

        // =========================================================
        // 16. DEPLOY BACKEND AZURE
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
                        echo "☁️ Connexion à Azure"

                        az login \
                            --service-principal \
                            -u "$AZURE_CLIENT_ID" \
                            -p "$AZURE_CLIENT_SECRET" \
                            --tenant "$AZURE_TENANT_ID"

                        az account set \
                            --subscription "$AZURE_SUBSCRIPTION_ID"

                        echo "🚀 Déploiement du Backend"

                        az webapp config container set \
                            --name ${AZURE_APP_SERVICE_BACKEND} \
                            --resource-group ${AZURE_RESOURCE_GROUP} \
                            --container-image-name ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                            --container-registry-url https://${AZURE_ACR_NAME}.azurecr.io

                        echo "🔄 Redémarrage de l'App Service"

                        az webapp restart \
                            --name ${AZURE_APP_SERVICE_BACKEND} \
                            --resource-group ${AZURE_RESOURCE_GROUP}

                        echo "✅ Backend déployé sur Azure"
                    '''
                }
            }
        }

        // =========================================================
        // 17. DAST OWASP ZAP
        // =========================================================
        stage('DAST - OWASP ZAP') {
            steps {
                sh '''
                    echo "🕷️ Analyse DAST avec OWASP ZAP"

                    BACKEND_URL="https://${AZURE_APP_SERVICE_BACKEND}.azurewebsites.net"

                    docker run --rm \
                        -t \
                        owasp/zap2docker-stable \
                        zap-baseline.py \
                        -t "${BACKEND_URL}/health" \
                        -r zap-report.html

                    echo "✅ OWASP ZAP terminé"
                '''

                archiveArtifacts artifacts: 'zap-report.html',
                    allowEmptyArchive: true
            }
        }
    }

    // =============================================================
    // POST
    // =============================================================
    post {

        success {
            echo '======================================'
            echo '✅ PIPELINE BESTRA RÉUSSI'
            echo '======================================'

            echo "📱 APK : bestra-debug.apk"

            echo "⚙️ Backend : https://${AZURE_APP_SERVICE_BACKEND}.azurewebsites.net"

            echo '======================================'
        }

        failure {
            echo '======================================'
            echo '❌ PIPELINE BESTRA ÉCHOUÉ'
            echo '======================================'

            echo "⚠️ Vérifier le stage en erreur"

            echo '======================================'
        }

        always {
            echo "📊 Durée du pipeline : ${currentBuild.durationString}"
        }
    }
}
