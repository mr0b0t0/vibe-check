#!/bin/bash

# Vibe Security Tools Installation Script
# This script installs the external security tools used by vibe-cli

echo "🛠️  Installing Vibe Security Tools..."
echo ""

# Check if running on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS installation using Homebrew
    echo "📦 Installing tools via Homebrew..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    echo "🔍 Installing semgrep..."
    brew install semgrep
    
    echo "🔐 Installing gitleaks..."
    brew install gitleaks
    
    echo "🛡️  Installing trivy..."
    brew install trivy
    
    echo "📦 Installing osv-scanner..."
    brew install osv-scanner
    
    echo "🐳 Checking Docker..."
    if ! command -v docker &> /dev/null; then
        echo "⚠️  Docker not found. Installing Docker Desktop..."
        brew install --cask docker
        echo "📝 Note: You'll need to start Docker Desktop manually after installation"
    fi

elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux installation
    echo "🐧 Installing tools on Linux..."
    
    # Detect package manager
    if command -v apt-get &> /dev/null; then
        # Debian/Ubuntu
        echo "Using apt-get..."
        
        # Update package lists
        sudo apt-get update
        
        # Install Python and pip for semgrep
        sudo apt-get install -y python3 python3-pip
        pip3 install semgrep
        
        # Install osv-scanner (binary download)
        echo "📦 Installing osv-scanner..."
        curl -s https://api.github.com/repos/google/osv-scanner/releases/latest | grep 'browser_download_url.*linux_amd64' | cut -d '"' -f 4 | xargs wget -O osv-scanner
        chmod +x osv-scanner
        sudo mv osv-scanner /usr/local/bin/osv-scanner
        
        # Install other tools
        wget -qO- https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_linux_x64.tar.gz | tar xvz
        sudo mv gitleaks /usr/local/bin/
        
        # Install trivy
        sudo apt-get install wget apt-transport-https gnupg lsb-release
        wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
        echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
        sudo apt-get update
        sudo apt-get install trivy
        
        # Install Docker
        sudo apt-get install -y docker.io
        sudo systemctl start docker
        sudo systemctl enable docker
        
    elif command -v yum &> /dev/null; then
        # RedHat/CentOS/Fedora
        echo "Using yum..."
        echo "⚠️  Please refer to the manual installation instructions for your distribution"
        exit 1
    fi

else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "Please install the following tools manually:"
    echo "  - semgrep: pip install semgrep"
    echo "  - gitleaks: https://github.com/gitleaks/gitleaks"
    echo "  - trivy: https://github.com/aquasecurity/trivy"
    echo "  - osv-scanner: download binary from GitHub releases"
    echo "  - docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "🧪 Test your installation with:"
echo "   vibe scan --no-ai"
echo ""
echo "📚 For more information:"
echo "   - Semgrep: https://semgrep.dev/"
echo "   - Gitleaks: https://github.com/gitleaks/gitleaks"
echo "   - Trivy: https://trivy.dev/"
echo "   - OSV-Scanner: https://github.com/google/osv-scanner"
echo "   - Docker: https://docs.docker.com/"
