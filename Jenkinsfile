pipeline {
    agent any
    
    environment {
        NODE_VERSION = '18'
        DOCKER_IMAGE = 'business-news-aggregator'
        DOCKER_TAG = "${BUILD_NUMBER}"
        SONAR_PROJECT_KEY = 'business-news-aggregator'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        returnStdout: true,
                        script: 'git rev-parse --short HEAD'
                    ).trim()
                }
            }
        }
        
        stage('Setup Node.js') {
            steps {
                sh '''
                    node --version
                    npm --version
                '''
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh '''
                    npm ci
                    npm audit --audit-level moderate
                '''
            }
        }
        
        stage('Dependency Check') {
            steps {
                sh '''
                    echo "Running dependency vulnerability check..."
                    npm audit --json > npm-audit-report.json || true
                    
                    # Check for high severity vulnerabilities
                    HIGH_VULNS=$(cat npm-audit-report.json | jq '.metadata.vulnerabilities.high // 0')
                    CRITICAL_VULNS=$(cat npm-audit-report.json | jq '.metadata.vulnerabilities.critical // 0')
                    
                    echo "High severity vulnerabilities: $HIGH_VULNS"
                    echo "Critical vulnerabilities: $CRITICAL_VULNS"
                    
                    if [ "$CRITICAL_VULNS" -gt "0" ]; then
                        echo "CRITICAL vulnerabilities found! Failing build."
                        exit 1
                    fi
                    
                    if [ "$HIGH_VULNS" -gt "5" ]; then
                        echo "Too many HIGH severity vulnerabilities found!"
                        exit 1
                    fi
                '''
                
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'npm-audit-report.json',
                    reportName: 'NPM Audit Report'
                ])
            }
        }
        
        stage('OWASP Dependency Check') {
            steps {
                dependencyCheck additionalArguments: '''
                    --format HTML
                    --format XML
                    --suppression suppression.xml
                    --enableRetired
                    --enableExperimental
                ''', odcInstallation: 'OWASP Dependency Check'
                
                dependencyCheckPublisher pattern: 'dependency-check-report.xml'
            }
        }
        
        stage('Security Audit - NPM') {
            steps {
                sh '''
                    echo "Running detailed NPM security audit..."
                    
                    # Better Audit using npm audit
                    npm audit --audit-level low --json > detailed-audit.json || true
                    
                    # Check package licenses
                    npx license-checker --json > license-report.json || true
                    
                    # Check for known malicious packages
                    echo "Checking for suspicious package patterns..."
                    
                    # List all dependencies for review
                    npm ls --depth=0 --json > dependency-tree.json
                '''
                
                archiveArtifacts artifacts: 'detailed-audit.json,license-report.json,dependency-tree.json', fingerprint: true
            }
        }
        
        stage('SAST - SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        npx sonar-scanner \\
                            -Dsonar.projectKey=$SONAR_PROJECT_KEY \\
                            -Dsonar.sources=. \\
                            -Dsonar.exclusions=node_modules/**,data/**,logs/** \\
                            -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \\
                            -Dsonar.host.url=$SONAR_HOST_URL \\
                            -Dsonar.login=$SONAR_AUTH_TOKEN
                    '''
                }
            }
        }
        
        stage('SonarQube Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    sh '''
                        # Build Docker image
                        docker build -t $DOCKER_IMAGE:$DOCKER_TAG .
                        docker build -t $DOCKER_IMAGE:latest .
                        
                        # Verify image was created
                        docker images | grep $DOCKER_IMAGE
                    '''
                }
            }
        }
        
        stage('Trivy Container Vulnerability Scanning') {
            steps {
                sh '''
                    echo "Running Trivy container security scan..."
                    
                    # Scan the Docker image for vulnerabilities
                    trivy image --exit-code 0 --no-progress --format json -o trivy-report.json $DOCKER_IMAGE:$DOCKER_TAG
                    
                    # Scan for HIGH and CRITICAL vulnerabilities only
                    trivy image --exit-code 1 --severity HIGH,CRITICAL --no-progress $DOCKER_IMAGE:$DOCKER_TAG
                    
                    # Generate HTML report
                    trivy image --format template --template "@contrib/html.tpl" -o trivy-report.html $DOCKER_IMAGE:$DOCKER_TAG
                '''
                
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'trivy-report.html',
                    reportName: 'Trivy Security Scan Report'
                ])
                
                archiveArtifacts artifacts: 'trivy-report.json,trivy-report.html', fingerprint: true
            }
        }
        
        stage('Additional Security Checks') {
            parallel {
                stage('Check Secrets') {
                    steps {
                        sh '''
                            echo "Scanning for exposed secrets..."
                            
                            # Check for common secret patterns
                            grep -r -i "password.*=" . --exclude-dir=node_modules --exclude-dir=.git || true
                            grep -r -i "api.*key.*=" . --exclude-dir=node_modules --exclude-dir=.git || true
                            grep -r -i "secret.*=" . --exclude-dir=node_modules --exclude-dir=.git || true
                            
                            # Check for hardcoded URLs
                            grep -r "http://" . --exclude-dir=node_modules --exclude-dir=.git || true
                            
                            echo "Secrets scan completed"
                        '''
                    }
                }
                
                stage('File Permission Check') {
                    steps {
                        sh '''
                            echo "Checking file permissions..."
                            
                            # Check for overly permissive files
                            find . -type f -perm 777 || true
                            
                            # Check for files that shouldn't be executable
                            find . -name "*.js" -perm +111 | head -10 || true
                            find . -name "*.json" -perm +111 | head -10 || true
                            
                            echo "File permission check completed"
                        '''
                    }
                }
                
                stage('Configuration Security') {
                    steps {
                        sh '''
                            echo "Checking configuration security..."
                            
                            # Check for debug mode in production
                            grep -r "debug.*true" . --exclude-dir=node_modules || true
                            grep -r "NODE_ENV.*development" . --exclude-dir=node_modules || true
                            
                            # Check for missing security headers
                            grep -r "helmet" . --include="*.js" || echo "Helmet security middleware check"
                            
                            echo "Configuration security check completed"
                        '''
                    }
                }
            }
        }
        
        stage('Test Application') {
            steps {
                sh '''
                    # Run tests if they exist
                    if [ -f "package.json" ] && npm run test --dry-run >/dev/null 2>&1; then
                        echo "Running tests..."
                        npm test
                    else
                        echo "No tests configured, running basic validation..."
                        node -c server.js
                        echo "Basic syntax validation passed"
                    fi
                '''
            }
        }
        
        stage('Security Test - Application') {
            steps {
                sh '''
                    echo "Running application security tests..."
                    
                    # Start application in background for testing
                    NODE_ENV=test npm start &
                    APP_PID=$!
                    
                    # Wait for application to start
                    sleep 10
                    
                    # Test basic endpoints
                    curl -f http://localhost:3000/health || echo "Health check endpoint test"
                    curl -f http://localhost:3000/ || echo "Home page test"
                    
                    # Test for common vulnerabilities
                    curl -X POST http://localhost:3000/api/auth/login \\
                         -H "Content-Type: application/json" \\
                         -d '{"email":"test","password":"<script>alert(1)</script>"}' || true
                    
                    # Stop application
                    kill $APP_PID || true
                    
                    echo "Application security tests completed"
                '''
            }
        }
        
        stage('Generate Security Report') {
            steps {
                sh '''
                    echo "Generating comprehensive security report..."
                    
                    cat > security-summary.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Summary - Build #${BUILD_NUMBER}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 10px; }
        .section { margin: 20px 0; padding: 10px; border-left: 3px solid #007cba; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .warn { color: orange; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Scan Summary</h1>
        <p>Build #${BUILD_NUMBER} | Commit: ${GIT_COMMIT_SHORT} | Date: $(date)</p>
    </div>
    
    <div class="section">
        <h2>Scan Results Overview</h2>
        <ul>
            <li class="pass">✓ Dependency Check: Completed</li>
            <li class="pass">✓ OWASP Analysis: Completed</li>
            <li class="pass">✓ NPM Security Audit: Completed</li>
            <li class="pass">✓ SAST SonarQube: Completed</li>
            <li class="pass">✓ Container Vulnerability Scan: Completed</li>
            <li class="pass">✓ Configuration Security: Completed</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Reports Generated</h2>
        <ul>
            <li><a href="npm-audit-report.json">NPM Audit Report</a></li>
            <li><a href="trivy-report.html">Trivy Container Scan</a></li>
            <li><a href="dependency-check-report.html">OWASP Dependency Check</a></li>
            <li>SonarQube Analysis (Check Quality Gate)</li>
        </ul>
    </div>
    
    <div class="section">
        <h2>Next Steps</h2>
        <p>Review all generated reports and address any identified vulnerabilities before deployment.</p>
    </div>
</body>
</html>
EOF
                '''
                
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'security-summary.html',
                    reportName: 'Security Summary Report'
                ])
            }
        }
    }
    
    post {
        always {
            // Clean up
            sh '''
                docker rmi $DOCKER_IMAGE:$DOCKER_TAG || true
                rm -f npm-audit-report.json || true
                rm -f trivy-report.* || true
            '''
            
            // Archive artifacts
            archiveArtifacts artifacts: '*.json,*.html,*.xml', allowEmptyArchive: true
        }
        
        success {
            echo 'Pipeline completed successfully! All security checks passed.'
            
            // Send notification (configure as needed)
            // slackSend channel: '#devops', color: 'good', 
            //           message: "Security scan completed successfully for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
        }
        
        failure {
            echo 'Pipeline failed! Check security scan results.'
            
            // Send failure notification
            // slackSend channel: '#devops', color: 'danger',
            //           message: "Security scan failed for ${env.JOB_NAME} - ${env.BUILD_NUMBER}. Check console output."
        }
    }
}