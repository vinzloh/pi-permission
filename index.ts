/**
 * Permission Gate Extension
 *
 * Prompts for confirmation before running potentially dangerous bash commands.
 * Example patterns checked: rm -rf, sudo, chmod/chown 777
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const PROTECTED_BRANCHES = ["main", "master", "production"];

  const dangerousPatterns = [
    // /\brm\b/i,
    /\bgit push\b.*\b(main|master|production)\b/i,
    /\bsudo\b/i,
    /\b\bcurl.*\|.*sh/i,
    /\b(chmod|chown)\b/i
  ];

  // Pattern for bare "git push" without explicit branch
  const bareGitPushPattern = /^\s*git\s+push\s*$/i;

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;
    let isDangerous = dangerousPatterns.some((p) => p.test(command));

    // Check for bare git push - need to verify current branch
    if (!isDangerous && bareGitPushPattern.test(command)) {
      try {
        // Get current git branch
        const result = await pi.exec("git", ["branch", "--show-current"]);
        const currentBranch = result.stdout.trim();

        if (PROTECTED_BRANCHES.includes(currentBranch.toLowerCase())) {
          isDangerous = true;
        }
      } catch {
        // Not a git repo or other error - ignore
      }
    }

    if (isDangerous) {
      if (!ctx.hasUI) {
        // In non-interactive mode, block by default
        return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
      }

      const choice = await ctx.ui.select(`⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`, ["Yes", "No"]);

      if (choice !== "Yes") {
        return { block: true, reason: "Blocked by user" };
      }
    }

    return undefined;
  });
}
