import { spawn } from "node:child_process";
import { platform } from "node:os";
import prompts from "prompts";

export interface Tool {
  name: string;
  command: string;
  description: string;
  installInstructions: {
    macos?: string[];
    linux?: string[];
    windows?: string[];
  };
  checkCommand?: string;
}

export const UI_TOOLS: Tool[] = [
  {
    name: "playwright",
    command: "npx playwright",
    description: "End-to-end testing framework",
    installInstructions: {
      macos: [
        "npm install @playwright/test",
        "npx playwright install",
        "npx playwright install-deps",
      ],
      linux: [
        "npm install @playwright/test",
        "npx playwright install",
        "npx playwright install-deps",
      ],
    },
  },
];

export const SECURITY_TOOLS: Tool[] = [
  {
    name: "semgrep",
    command: "semgrep",
    description: "Static code analysis",
    installInstructions: {
      macos: ["brew install semgrep"],
      linux: ["pip3 install semgrep"],
    },
  },
  {
    name: "gitleaks",
    command: "gitleaks",
    description: "Secret scanning",
    installInstructions: {
      macos: ["brew install gitleaks"],
      linux: [
        "wget -qO- https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_linux_x64.tar.gz | tar xvz",
        "sudo mv gitleaks /usr/local/bin/",
      ],
    },
  },
  {
    name: "osv-scanner",
    command: "osv-scanner",
    description: "Dependency vulnerability scanning",
    installInstructions: {
      macos: ["brew install osv-scanner"],
      linux: [
        "curl -s https://api.github.com/repos/google/osv-scanner/releases/latest | grep 'browser_download_url.*linux_amd64' | cut -d '\"' -f 4 | xargs wget -O osv-scanner",
        "chmod +x osv-scanner",
        "sudo mv osv-scanner /usr/local/bin/osv-scanner",
      ],
    },
  },
  {
    name: "trivy",
    command: "trivy",
    description: "Container and filesystem vulnerability scanning",
    installInstructions: {
      macos: ["brew install trivy"],
      linux: [
        "sudo apt-get install wget apt-transport-https gnupg lsb-release",
        "wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -",
        'echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list',
        "sudo apt-get update",
        "sudo apt-get install trivy",
      ],
    },
  },
  {
    name: "docker",
    command: "docker",
    description: "Container runtime (for OWASP ZAP)",
    installInstructions: {
      macos: ["brew install --cask docker"],
      linux: [
        "sudo apt-get install -y docker.io",
        "sudo systemctl start docker",
      ],
    },
  },
];

/**
 * Check if a tool is installed by trying to run it
 */
export async function isToolInstalled(tool: Tool): Promise<boolean> {
  return new Promise((resolve) => {
    const checkCmd = tool.checkCommand || tool.command;
    const p = spawn(checkCmd, ["--version"], {
      stdio: "ignore",
      shell: true,
    });

    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}

/**
 * Check and install UI tools (like Playwright)
 */
export async function checkAndInstallUiTools(
  toolNames: string[],
  options: { skipInstall?: boolean; autoInstall?: boolean } = {}
): Promise<void> {
  if (options.skipInstall) {
    console.log("⏭️  Skipping UI tool installation check");
    return;
  }

  const requiredTools = getRequiredUiTools(toolNames);
  const missingTools: Tool[] = [];

  console.log("🔍 Checking UI tools...");
  for (const tool of requiredTools) {
    const installed = await isToolInstalled(tool);
    if (!installed) {
      missingTools.push(tool);
      console.log(`❌ ${tool.name} not found`);
    } else {
      console.log(`✅ ${tool.name} is available`);
    }
  }

  if (missingTools.length === 0) {
    console.log("🎉 All UI tools are available!");
    return;
  }

  // Install missing tools
  if (missingTools.length > 0) {
    for (const tool of missingTools) {
      if (options.autoInstall) {
        console.log(`🚀 Auto-installing ${tool.name}...`);
        await installTool(tool);
      } else {
        const prompts = await import("prompts");
        const response = await prompts.default({
          type: "confirm",
          name: "install",
          message: `Install ${tool.name} (${tool.description})?`,
          initial: true,
        });

        if (response.install) {
          await installTool(tool);
        } else {
          console.log(`⏭️  Skipping ${tool.name} installation`);
        }
      }
    }
  }
}

/**
 * Get required UI tools from names
 */
function getRequiredUiTools(toolNames: string[]): Tool[] {
  return toolNames
    .map((name) => UI_TOOLS.find((tool) => tool.name === name))
    .filter((tool): tool is Tool => tool !== undefined);
}

/**
 * Get the current platform for installation instructions
 */
export function getCurrentPlatform(): keyof Tool["installInstructions"] {
  const os = platform();
  switch (os) {
    case "darwin":
      return "macos";
    case "linux":
      return "linux";
    case "win32":
      return "windows";
    default:
      return "linux"; // Default fallback
  }
}

/**
 * Execute a shell command
 */
export function executeCommand(command: string): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log(`🔧 Executing: ${command}`);

    const p = spawn(command, [], {
      stdio: "inherit",
      shell: true,
    });

    p.on("error", (err) => {
      console.error(`❌ Command failed: ${err.message}`);
      reject(err);
    });

    p.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Command completed successfully`);
      } else {
        console.log(`⚠️  Command exited with code ${code}`);
      }
      resolve(code || 0);
    });
  });
}

/**
 * Install a single tool with automatic patching for common issues
 */
export async function installTool(tool: Tool): Promise<boolean> {
  const currentPlatform = getCurrentPlatform();
  const instructions = tool.installInstructions[currentPlatform];

  if (!instructions || instructions.length === 0) {
    console.log(
      `❌ No installation instructions available for ${tool.name} on ${currentPlatform}`
    );
    return false;
  }

  console.log(`📦 Installing ${tool.name} (${tool.description})...`);

  try {
    for (const command of instructions) {
      const exitCode = await executeCommand(command);
      if (exitCode !== 0) {
        console.log(`⚠️  Installation step failed, attempting auto-patch...`);

        // Try auto-patching for common issues
        const patchApplied = await attemptAutoPatch(tool, command, exitCode);
        if (patchApplied) {
          console.log(`🔧 Auto-patch applied, retrying installation...`);
          const retryCode = await executeCommand(command);
          if (retryCode !== 0) {
            console.log(`⚠️  Retry failed, but continuing...`);
          }
        } else {
          console.log(`⚠️  No auto-patch available, continuing...`);
        }
      }
    }

    // Verify installation
    const isInstalled = await isToolInstalled(tool);
    if (isInstalled) {
      console.log(`✅ ${tool.name} installed successfully!`);
      return true;
    } else {
      console.log(`❌ ${tool.name} installation verification failed`);

      // Try additional fixes for verification failures
      await attemptInstallationFix(tool);

      // Re-verify after fixes
      const isInstalledAfterFix = await isToolInstalled(tool);
      if (isInstalledAfterFix) {
        console.log(`✅ ${tool.name} installed after applying fixes!`);
        return true;
      }

      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to install ${tool.name}:`, error);
    return false;
  }
}

/**
 * Attempt to auto-patch common installation issues
 */
async function attemptAutoPatch(
  tool: Tool,
  failedCommand: string,
  exitCode: number
): Promise<boolean> {
  // OSV-Scanner Homebrew issue (macOS)
  if (tool.name === "osv-scanner" && failedCommand.includes("brew install")) {
    console.log("🔧 Attempting to fix osv-scanner installation...");

    try {
      await executeCommand("brew update");
      console.log("✅ Homebrew updated, retrying osv-scanner installation");
      return true;
    } catch (error) {
      console.log("❌ Failed to update Homebrew automatically");
      return false;
    }
  }

  // Docker daemon not running
  if (tool.name === "docker" && exitCode !== 0) {
    console.log("🔧 Attempting to start Docker daemon...");

    try {
      await executeCommand("open /Applications/Docker.app");
      console.log("✅ Docker Desktop launched - please wait for it to start");

      // Wait a bit for Docker to start
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return true;
    } catch (error) {
      console.log("❌ Failed to start Docker automatically");
      return false;
    }
  }

  // Homebrew issues
  if (failedCommand.includes("brew install")) {
    console.log("🔧 Attempting to fix Homebrew issues...");

    try {
      await executeCommand("brew update");
      console.log("✅ Homebrew updated");
      return true;
    } catch (error) {
      console.log("❌ Failed to update Homebrew");
      return false;
    }
  }

  return false;
}

/**
 * Attempt additional fixes when installation verification fails
 */
async function attemptInstallationFix(tool: Tool): Promise<void> {
  console.log(`🔧 Attempting to fix ${tool.name} installation...`);

  switch (tool.name) {
    case "osv-scanner":
      console.log("💡 OSV-Scanner installation notes:");
      console.log("   • Try: brew install osv-scanner");
      console.log("   • Ensure Homebrew is up to date: brew update");
      console.log("   • Check: osv-scanner --version");
      break;

    case "docker":
      console.log("💡 Docker installation notes:");
      console.log("   • Make sure Docker Desktop is running");
      console.log("   • Check: docker --version");
      console.log("   • If issues persist: brew install --cask docker");
      break;

    default:
      console.log(`💡 Try manual installation: brew install ${tool.name}`);
  }
}

/**
 * Check which tools are missing and prompt user to install them
 */
export async function checkAndInstallTools(
  requiredTools: string[],
  options: { autoInstall?: boolean; skipInstall?: boolean } = {}
): Promise<boolean> {
  const { autoInstall = false, skipInstall = false } = options;
  const tools = SECURITY_TOOLS.filter((tool) =>
    requiredTools.includes(tool.name)
  );

  // Check which tools are missing
  const missingTools: Tool[] = [];

  console.log("🔍 Checking required security tools...");

  for (const tool of tools) {
    const isInstalled = await isToolInstalled(tool);
    if (!isInstalled) {
      missingTools.push(tool);
      console.log(`❌ ${tool.name} not found`);
    } else {
      console.log(`✅ ${tool.name} is available`);
    }
  }

  if (missingTools.length === 0) {
    console.log("🎉 All required tools are installed!");
    return true;
  }

  // Show missing tools
  console.log("");
  console.log(`⚠️  Missing tools (${missingTools.length}/${tools.length}):`);
  missingTools.forEach((tool) => {
    console.log(`   • ${tool.name} - ${tool.description}`);
  });
  console.log("");

  if (skipInstall) {
    console.log(
      "⏭️  Skipping tool installation (--skip-install). Some scans may fail."
    );
    return false;
  }

  if (autoInstall) {
    console.log("🚀 Auto-installing missing tools...");
  } else {
    // Prompt user
    const response = await prompts({
      type: "confirm",
      name: "install",
      message: `Would you like to install the missing tools now?`,
      initial: true,
    });

    if (!response.install) {
      console.log("⏭️  Skipping tool installation. Some scans may fail.");
      return false;
    }
  }

  // Install missing tools
  let allInstalled = true;
  for (const tool of missingTools) {
    const success = await installTool(tool);
    if (!success) {
      allInstalled = false;
    }
  }

  if (allInstalled) {
    console.log("🎉 All tools installed successfully!");
  } else {
    console.log("⚠️  Some tools failed to install. Check the output above.");
  }

  return allInstalled;
}

/**
 * Get required tools for specific scan types
 */
export function getRequiredTools(scanTypes: string[]): string[] {
  const toolMap: Record<string, string[]> = {
    code: ["semgrep"],
    deps: ["osv-scanner", "trivy"],
    secrets: ["gitleaks"],
    zap: ["docker"],
    all: ["semgrep", "osv-scanner", "trivy", "gitleaks", "docker"],
  };

  const requiredTools = new Set<string>();

  for (const scanType of scanTypes) {
    const tools = toolMap[scanType] || [];
    tools.forEach((tool) => requiredTools.add(tool));
  }

  return Array.from(requiredTools);
}
