import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { promises as fs } from "fs";
import path from "path";

// Simple logger that only logs to stderr (won't mess up TUI)
const log = {
  info: (msg: string, ...args: any[]) => {
    console.error(`[Allowlist] ${msg}`, ...args);
  },
  error: (msg: string, ...args: any[]) => {
    console.error(`[Allowlist ERROR] ${msg}`, ...args);
  }
};

/**
 * OpenCode Allowlist Plugin
 * 
 * Automatically allows file access to directories configured in
 * .opencode/opencode-allowlist.json
 * 
 * Configuration example (.opencode/opencode-allowlist.json):
 * {
 *   "allowedDirectories": [
 *     "/Users/username/workspace/projects",
 *     "/path/to/another/workspace"
 *   ]
 * }
 */
export const AllowlistPlugin: Plugin = async ({ directory, worktree }) => {
  // Cache the allowed directories for performance
  let cachedDirs: string[] | null = null;
  
  /**
   * Search for config files matching OpenCode's pattern:
   * 1. Global config (~/.config/opencode/ or ~/.local/share/opencode/config/)
   * 2. From directory up to worktree
   * All found configs are merged together.
   */
  const findConfigFiles = async (): Promise<string[]> => {
    const configFiles: string[] = [];
    
    // 1. Check global config directory first (like OpenCode does)
    const homeDir = process.env.HOME || process.env.USERPROFILE || "~";
    const globalConfigPaths = [
      path.join(homeDir, ".config", "opencode", "opencode-allowlist.json"),
      path.join(homeDir, ".local", "share", "opencode", "config", "opencode-allowlist.json"),
    ];
    
    for (const globalPath of globalConfigPaths) {
      try {
        await fs.access(globalPath);
        configFiles.push(globalPath);
      } catch {
        // File doesn't exist, continue
      }
    }
    
    // 2. Search up from directory to worktree
    let currentDir = directory;
    while (true) {
      const configPath = path.join(currentDir, ".opencode", "opencode-allowlist.json");
      try {
        await fs.access(configPath);
        configFiles.push(configPath);
      } catch {
        // File doesn't exist, continue
      }
      
      // Stop at worktree
      if (currentDir === worktree) break;
      
      // Go up one directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }
    
    return configFiles;
  };
  
  /**
   * Load allowed directories from .opencode/opencode-allowlist.json files.
   * Searches from directory up to worktree and merges all found configs.
   */
  const getAllowedDirectories = async (): Promise<string[]> => {
    if (cachedDirs !== null) return cachedDirs;
    
    const configFiles = await findConfigFiles();
    const allDirs = new Set<string>();
    
    if (configFiles.length === 0) {
      log.info("No .opencode/opencode-allowlist.json config found. Create one to configure allowed directories.");
      cachedDirs = [];
      return cachedDirs;
    }
    
    // Load and merge all configs (closer to directory = higher precedence)
    for (const configPath of configFiles) {
      try {
        const content = await fs.readFile(configPath, "utf-8");
        const config = JSON.parse(content);
        const dirs = config.allowedDirectories || [];
        
        dirs.forEach((dir: string) => allDirs.add(dir));
        
        if (dirs.length > 0) {
          log.info(`Loaded ${dirs.length} allowed directories from ${configPath}`);
        }
      } catch (error) {
        log.error(`Error reading ${configPath}:`, error);
      }
    }
    
    cachedDirs = Array.from(allDirs);
    log.info(`Total ${cachedDirs.length} unique allowed directories configured`);
    return cachedDirs;
  };

  /**
   * Check if a path is within any of the allowed directories
   */
  const isPathAllowed = (requestedPath: string, allowedDirs: string[]): boolean => {
    for (const allowedDir of allowedDirs) {
      // Normalize paths for comparison
      const normalizedAllowed = path.resolve(allowedDir);
      const normalizedRequested = path.resolve(requestedPath);
      
      if (normalizedRequested.startsWith(normalizedAllowed)) {
        return true;
      }
    }
    return false;
  };

  return {
    /**
     * Hook into permission requests to auto-allow configured directories
     */
    "permission.ask": async (input, output) => {
      // Only handle external directory permissions
      log.info(`Permission request type: ${input.type}`);
      if (input.type !== "external_directory") {
        log.info(`Skipping non-external_directory permission: ${input.type}`);
        return;
      }
      
      const requestedDir = input.metadata?.parentDir || input.metadata?.filepath;
      if (!requestedDir) {
        return;
      }
      
      const allowedDirs = await getAllowedDirectories();
      
      // Check if requested directory is within any allowed directory
      if (isPathAllowed(requestedDir, allowedDirs)) {
        log.info(`✓ Auto-allowing: ${requestedDir}`);
        output.status = "allow";
        return;
      }
      
      log.info(`✗ Not in allowed list: ${requestedDir}`);
    },

    /**
     * Provide a tool to list current allowed directories
     */
    tool: {
      listAllowedDirectories: tool({
        description: "List all directories that are configured for automatic access. These directories are defined in .opencode/opencode-allowlist.json",
        args: {},
        async execute() {
          const dirs = await getAllowedDirectories();
          
          if (dirs.length === 0) {
            return `No allowed directories configured.

To configure allowed directories, create .opencode/opencode-allowlist.json:

{
  "allowedDirectories": [
    "/path/to/workspace1",
    "/path/to/workspace2"
  ]
}`;
          }
          
          return `Configured allowed directories (${dirs.length}):

${dirs.map((dir, i) => `${i + 1}. ${dir}`).join('\n')}

These directories will be automatically allowed for file access without permission prompts.`;
        },
      }),
    },
  };
};

export default AllowlistPlugin;

