pipeline {
    agent any
    
    stages {
        stage('Hello World') {
            steps {
                echo 'Hello from Jenkins!'
                sh 'pwd'
                sh 'ls -la'
            }
        }
        
        stage('Check Node') {
            steps {
                sh 'node --version || echo "Node not installed"'
                sh 'npm --version || echo "npm not installed"'
            }
        }
        
        stage('Check Docker') {
            steps {
                sh 'docker --version || echo "Docker not installed"'
            }
        }
    }
    
    post {
        success {
            echo '✅ Pipeline réussi !'
        }
        failure {
            echo '❌ Pipeline échoué !'
        }
    }
}
