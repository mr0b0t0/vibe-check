import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { AiConfig, AiContextPack } from "./types.js";

export class ContextPacker {
  constructor(private config: AiConfig) {}

  async packContext(
    specExcerpt: object,
    options: {
      domSnapshot?: string;
      scannerFindings?: object;
      moduleId?: string;
    } = {}
  ): Promise<AiContextPack> {
    const codeChunks = await this.getCodeChunks(options.moduleId);

    return {
      specExcerpt,
      codeChunks,
      domSnapshot: options.domSnapshot,
      scannerFindings: options.scannerFindings,
    };
  }

  private async getCodeChunks(
    moduleId?: string
  ): Promise<Array<{ path: string; startLine: number; text: string }>> {
    if (!this.config.include?.globs) {
      return [];
    }

    const chunks: Array<{ path: string; startLine: number; text: string }> = [];
    let totalChars = 0;
    let fileCount = 0;

    for (const globPattern of this.config.include.globs) {
      try {
        const files = await glob(globPattern, {
          ignore: this.config.redact?.globs || [],
          absolute: false,
        });

        for (const file of files) {
          if (fileCount >= (this.config.limits?.maxFiles || 800)) {
            break;
          }

          if (!fs.existsSync(file)) continue;

          const content = fs.readFileSync(file, "utf-8");
          const redactedContent = this.redactContent(content);

          if (
            totalChars + redactedContent.length >
            (this.config.limits?.maxTotalChars || 3000000)
          ) {
            break;
          }

          const fileChunks = this.chunkContent(file, redactedContent);
          chunks.push(...fileChunks);

          totalChars += redactedContent.length;
          fileCount++;
        }
      } catch (error) {
        console.warn(
          `[vibe][ai] Failed to process glob ${globPattern}:`,
          error
        );
      }
    }

    return chunks.slice(
      0,
      Math.floor((this.config.limits?.maxFiles || 800) * 1.5)
    ); // Allow some overhead
  }

  private redactContent(content: string): string {
    let redacted = content;

    // Apply pattern-based redaction
    if (this.config.redact?.patterns) {
      for (const pattern of this.config.redact.patterns) {
        const regex = new RegExp(pattern, "g");
        redacted = redacted.replace(regex, "[REDACTED]");
      }
    }

    return redacted;
  }

  private chunkContent(
    filePath: string,
    content: string
  ): Array<{ path: string; startLine: number; text: string }> {
    const maxChars = this.config.chunking?.maxCharsPerChunk || 20000;
    const overlap = this.config.chunking?.overlap || 512;

    if (content.length <= maxChars) {
      return [{ path: filePath, startLine: 1, text: content }];
    }

    const chunks: Array<{ path: string; startLine: number; text: string }> = [];
    const lines = content.split("\n");
    let currentChunk = "";
    let currentStartLine = 1;
    let currentLineNum = 1;

    for (const line of lines) {
      if (
        currentChunk.length + line.length + 1 > maxChars &&
        currentChunk.length > 0
      ) {
        // Save current chunk
        chunks.push({
          path: filePath,
          startLine: currentStartLine,
          text: currentChunk,
        });

        // Start new chunk with overlap
        const overlapLines = Math.floor(
          overlap / (currentChunk.length / (currentLineNum - currentStartLine))
        );
        const startOverlap = Math.max(0, currentLineNum - overlapLines - 1);

        currentChunk =
          lines.slice(startOverlap, currentLineNum).join("\n") + "\n" + line;
        currentStartLine = startOverlap + 1;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
      currentLineNum++;
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push({
        path: filePath,
        startLine: currentStartLine,
        text: currentChunk,
      });
    }

    return chunks;
  }
}
