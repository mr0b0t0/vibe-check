# vibe-check (starter)

Monorepo for the spec-driven validator CLI. Quick start:

```bash
pnpm i
pnpm -r build
pnpm dev:app # starts example web app on :3000
pnpm vibe -- spec lint -c ./specs/vibe.yaml
pnpm vibe -- app up -c ./specs/vibe.yaml
pnpm vibe -- ui test -c ./specs/vibe.yaml
pnpm vibe -- scan code -c ./specs/vibe.yaml
pnpm vibe -- report -c ./specs/vibe.yaml
```

## Overview

`vibe-check` is a comprehensive spec-driven validation tool for AI agent-generated applications. It provides:

- **Spec validation**: Validates your `vibe.yaml` configuration against a strict schema
- **App lifecycle management**: Starts apps and waits for health checks
- **UI testing**: Generates and runs Playwright tests from specifications
- **Security scanning**: Integrates with multiple security tools (Semgrep, Trivy, OSV-Scanner, Gitleaks, OWASP ZAP)
- **API testing**: Contract and fuzz testing with Dredd and Schemathesis
- **Unified reporting**: Merges all results into SARIF format with markdown summaries
- **🤖 AI Integration**: AI-powered analysis, test generation, and intelligent recommendations

## Architecture

This is a pnpm monorepo with the following packages:

- **@vibe/cli**: Main CLI with all commands
- **@vibe/spec**: Zod schema and TypeScript types for vibe.yaml
- **@vibe/generators**: Playwright test generation from specs
- **@vibe/adapters**: Security tool integrations
- **@vibe/reporter**: SARIF merging and report generation
- **@vibe/ai**: AI integration layer using Vercel AI SDK with multi-provider support

## Commands

### Spec Management

```bash
pnpm vibe -- spec lint -c ./specs/vibe.yaml
```

### App Lifecycle

```bash
pnpm vibe -- app up -c ./specs/vibe.yaml
pnpm vibe -- app down
```

### Testing

```bash
pnpm vibe -- ui test -c ./specs/vibe.yaml
pnpm vibe -- api test -c ./specs/vibe.yaml
```

### Security Scanning

**🔍 Comprehensive Security Scan (NEW!):**

```bash
pnpm vibe -- scan -c ./specs/vibe.yaml           # All scans + AI analysis
pnpm vibe -- scan --no-ai                        # All scans, no AI
pnpm vibe -- scan --auto-install                 # Auto-install missing tools
pnpm vibe -- scan --skip-install                 # Skip tool installation
```

**Individual Security Scans:**

```bash
pnpm vibe -- scan code -c ./specs/vibe.yaml      # Semgrep only
pnpm vibe -- scan deps -c ./specs/vibe.yaml      # OSV-Scanner only
pnpm vibe -- scan secrets -c ./specs/vibe.yaml   # Gitleaks only
pnpm vibe -- scan zap -c ./specs/vibe.yaml       # OWASP ZAP only
```

**📦 Installing Security Tools:**

```bash
# Easy installation (macOS/Linux)
./install-tools.sh

# Manual installation (macOS)
brew install semgrep gitleaks trivy
go install github.com/google/osv-scanner/cmd/osv-scanner@latest
```

**🛠️ Tool Installation Options:**

- **Default**: Prompts user to install missing tools
- **`--auto-install`**: Automatically installs missing tools (perfect for CI/CD)
- **`--skip-install`**: Skips installation and proceeds with available tools

The comprehensive scan automatically:

- ✅ Handles missing tools gracefully with helpful installation instructions
- ✅ Runs all security scans in sequence
- ✅ Generates AI-powered analysis and recommendations
- ✅ Creates merged SARIF reports for CI/CD integration

### Reporting

```bash
pnpm vibe -- report -c ./specs/vibe.yaml
```

## Configuration

Create a `vibe.yaml` file to define your application specification. See `specs/vibe.yaml` for a complete example.

### AI Configuration

Add AI capabilities to your `vibe.yaml`:

```yaml
ai:
  enabled: true # Enable/disable AI features
  provider: openai # openai | anthropic | google | xai | custom
  model: gpt-4 # Provider-specific model ID
  temperature: 0.2 # AI temperature (0-2)
  maxTokens: 4000 # Max tokens per request
  thresholds:
    aiCriticalToFail: true # Fail on critical AI findings
    treatLowConfidenceAsInfo: true # Downgrade low confidence findings
```

**Supported AI Providers:**

- **OpenAI**: Set `OPENAI_API_KEY`
- **Anthropic**: Set `ANTHROPIC_API_KEY`
- **Google**: Set `GOOGLE_GENERATIVE_AI_API_KEY`
- **XAI (Grok)**: Set `XAI_API_KEY`
- **Custom**: Set `CUSTOM_API_KEY` + specify baseURL

### AI Features

- **Spec Clarity Review**: Identifies ambiguous or incomplete specifications
- **Security Analysis**: AI-powered security reviews with context awareness
- **Test Generation**: Generates additional test cases for better coverage
- **Selector Healing**: Automatically fixes failing UI selectors
- **Executive Summaries**: AI-generated reports with priority recommendations

## Requirements

External tools must be installed separately:

- **Semgrep**: `pip install semgrep`
- **Trivy**: [Installation guide](https://aquasecurity.github.io/trivy/latest/getting-started/installation/)
- **OSV-Scanner**: [Installation guide](https://google.github.io/osv-scanner/installation/)
- **Gitleaks**: [Installation guide](https://github.com/gitleaks/gitleaks#installing)
- **Docker**: For OWASP ZAP scanning
- **Playwright**: Installed automatically via the generators package

## Exit Codes

- `0`: Success
- `2`: Spec validation error
- `3`: App boot failed
- `4`: Health check timeout
- `5`: UI test failures
- `6`: SAST findings over threshold
- `7`: Dependency vulnerabilities over threshold
- `8`: Secrets found
- `9`: DAST findings over threshold
- `10`: API test failures
- `11`: Report generation error
- `12`: App teardown error

### AI Command Flags

All commands support additional AI flags:

- `--no-ai`: Disable AI features for this command
- `--ai-model <id>`: Override the AI model (e.g., `gpt-4`, `claude-3-opus`)
- `--ai-temp <n>`: Override AI temperature (0-2)
- `--ai-budget-tokens <n>`: Override token budget

## Development

```bash
# Install dependencies
pnpm i

# Build all packages
pnpm -r build

# Start the example app
pnpm dev:app

# Run the CLI in development
pnpm vibe -- --help
```
