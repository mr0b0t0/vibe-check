# Vibe CLI

🛡️ AI-powered security and testing CLI for web applications. Automated security scanning, UI testing, and intelligent analysis.

## Features

- **🔒 Comprehensive Security Scanning**
  - Static code analysis with Semgrep
  - Dependency vulnerability scanning with Trivy & OSV-Scanner
  - Secret detection with Gitleaks
  - Web security testing with OWASP ZAP

- **🎭 AI-Powered UI Testing**
  - Automatic Playwright test generation
  - AI-enhanced test scenarios
  - Real-time test execution with streaming output

- **🤖 Intelligent Analysis**
  - AI-driven security insights
  - Priority-based issue classification
  - Executive summary and recommendations
  - Token usage tracking

- **📊 Comprehensive Reporting**
  - Markdown and JSON reports
  - SARIF compatibility
  - Real-time progress indicators
  - Integrated scoring system

## Installation

```bash
npm install -g vibe-cli
```

## Quick Start

1. **Create a vibe.yaml configuration:**

```yaml
name: "my-web-app"
version: "1.0.0"
description: "My web application"

ai:
  enabled: true
  provider: "openai"  # openai | anthropic | google | xai
  model: "gpt-4"
  temperature: 0.2

modules:
  - id: "auth"
    description: "User authentication system"
    pages:
      - path: "/login"
        flows:
          - name: "successful-login"
            steps:
              - goto: "/login"
              - fill: { "[name=email]": "test@example.com", "[name=password]": "password123" }
              - click: "button[type=submit]"
              - expectUrl: "/dashboard"

  - id: "contacts"
    description: "Contact management"
    pages:
      - path: "/contacts"
        flows:
          - name: "create-contact"
            steps:
              - goto: "/contacts"
              - click: "#new-contact"
              - fill: { "#name": "John Doe", "#email": "john@example.com" }
              - click: "#save"
              - expectText: "Contact created"

app:
  start: "npm start"
  healthCheck: "http://localhost:3000/health"
  stopCommand: "pkill -f 'node.*server'"

security:
  tools:
    - semgrep
    - trivy
    - osv-scanner
    - gitleaks
    - zap

api:
  openapi: "./openapi.yaml"
  baseURL: "http://localhost:3000/api"
```

2. **Set up your AI provider (optional but recommended):**

Create a `.env` file:
```bash
# For OpenAI
OPENAI_API_KEY=your_api_key_here

# For Anthropic
ANTHROPIC_API_KEY=your_api_key_here

# For Google
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

# For XAI (Grok)
XAI_API_KEY=your_api_key_here
```

3. **Run comprehensive analysis:**

```bash
# Full analysis with AI
vibe

# Skip AI features
vibe --no-ai

# Auto-install missing tools
vibe --auto-install

# Skip tool installation
vibe --skip-install
```

## Commands

### Comprehensive Analysis
```bash
vibe                           # Run all scans + UI tests + AI analysis
vibe --no-ai                   # Skip AI features
vibe --auto-install            # Auto-install missing tools
```

### Security Scanning
```bash
vibe scan                      # All security scans
vibe scan code                 # Static code analysis only
vibe scan deps                 # Dependency scanning only
vibe scan secrets              # Secret detection only
vibe scan zap                  # Web security testing only
```

### UI Testing
```bash
vibe ui test                   # Generate and run UI tests
vibe ui run                    # Run existing tests
```

### Application Lifecycle
```bash
vibe app up                    # Start your application
vibe app down                  # Stop your application
```

### Configuration
```bash
vibe spec lint                 # Validate vibe.yaml configuration
```

## Configuration Reference

### AI Configuration

```yaml
ai:
  enabled: true                # Enable/disable AI features
  provider: "openai"           # openai | anthropic | google | xai | custom
  model: "gpt-4"              # Provider-specific model ID
  temperature: 0.2            # Response randomness (0-2)
  maxTokens: 4000             # Maximum tokens per request
  include:
    globs: ["src/**/*.ts"]    # Files to include in analysis
  redact:
    patterns: ["API_KEY"]     # Patterns to redact from code
  limits:
    maxFiles: 800             # Maximum files to analyze
    maxTotalChars: 3000000    # Maximum total characters
```

### Security Tools Configuration

```yaml
security:
  tools:
    - semgrep      # Static code analysis
    - trivy        # Container/dependency scanning
    - osv-scanner  # Open source vulnerability database
    - gitleaks     # Secret detection
    - zap          # Web application security testing
```

### API Testing

```yaml
api:
  openapi: "./openapi.yaml"           # OpenAPI specification
  baseURL: "http://localhost:3000/api"
  tools:
    - dredd        # API contract testing
    - schemathesis # Property-based API testing
```

## Tool Installation

Vibe CLI automatically detects and can install required security tools:

### macOS (via Homebrew)
```bash
brew install semgrep gitleaks trivy osv-scanner
```

### Linux
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install trivy

# Install others via direct download or language-specific package managers
pip install semgrep
go install github.com/google/osv-scanner/cmd/osv-scanner@latest
```

### Docker
All tools can also run via Docker containers.

## Reports

Vibe generates comprehensive reports:

- **📋 `security-report.md`**: Human-readable security analysis
- **📊 `security-summary.json`**: Structured data for integrations
- **🎭 `playwright-results.json`**: UI test results
- **🤖 `ai/`**: AI analysis artifacts and metadata

### Sample Report Structure

```
.vibe/
├── security-report.md      # Main report
├── security-summary.json   # JSON summary
├── playwright-results.json # UI test results
├── ai/
│   ├── summary.md          # AI analysis
│   ├── total-usage.json    # Token usage
│   └── *.json              # AI artifacts
├── semgrep.json           # Tool outputs
├── trivy.sarif
├── gitleaks.json
└── osv.json
```

## AI Providers

### Supported Providers

- **OpenAI**: GPT-4, GPT-3.5-turbo
- **Anthropic**: Claude-3, Claude-2
- **Google**: Gemini Pro, Gemini 2.0 Flash
- **XAI**: Grok models
- **Custom**: Any OpenAI-compatible API

### Environment Variables

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
XAI_API_KEY=xai-...
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g vibe-cli
      - run: vibe --auto-install --no-ai
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Examples

### Basic Web App Analysis
```bash
cd my-web-app
vibe --auto-install
```

### API-Only Project
```yaml
# vibe.yaml
name: "my-api"
api:
  openapi: "./api-spec.yaml"
  baseURL: "http://localhost:3000"
security:
  tools: [semgrep, trivy, gitleaks]
```

### Advanced Configuration with Custom AI
```yaml
ai:
  provider: "custom"
  model: "my-model"
  baseURL: "https://my-ai-api.com/v1"
  include:
    globs: ["src/**/*.{ts,js}", "tests/**/*.ts"]
  redact:
    patterns: ["password", "secret", "key"]
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/yourusername/vibe-check)
- 🐛 [Report Issues](https://github.com/yourusername/vibe-check/issues)
- 💬 [Discussions](https://github.com/yourusername/vibe-check/discussions)

---

Made with ❤️ for secure web development
