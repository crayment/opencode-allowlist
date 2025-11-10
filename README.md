# OpenCode Allowlist Plugin

Automatically allows OpenCode agents to access files in configured directories without permission prompts.

## Problem

By default, OpenCode restricts file access to the directory where it's launched. When agents try to access files outside this directory, they trigger permission prompts. This can be tedious in multi-project workspaces.

## Solution

This plugin reads allowed directories from `.opencode/opencode-allowlist.json` config files and automatically approves file access requests to those locations.

## Installation

### From npm (Recommended)

```bash
# Add to your opencode.json
{
  "plugin": [
    "opencode-allowlist@latest"
  ]
}
```

Then create `.opencode/opencode-allowlist.json`:

```json
{
  "allowedDirectories": [
    "/Users/username/workspace/projects"
  ]
}
```

### From Source

1. Clone and install dependencies:

```bash
git clone https://github.com/crayment/opencode-allowlist.git
cd opencode-allowlist
npm install
```

2. Add the plugin to your `opencode.json`:

```json
{
  "plugin": [
    "file://{env:HOME}/path/to/opencode-allowlist/src/index.ts"
  ]
}
```

3. Create `.opencode/opencode-allowlist.json` to configure allowed directories:

```json
{
  "allowedDirectories": [
    "/Users/username/workspace/projects"
  ]
}
```

## Configuration

Create a `.opencode/opencode-allowlist.json` file. The plugin searches from your current directory up to the git worktree root (matching OpenCode's pattern):

```json
{
  "allowedDirectories": [
    "/Users/username/workspace/projects",
    "/Users/username/other-workspace",
    "/path/to/shared/libraries"
  ]
}
```

**Multiple configs**: You can have configs at different levels (e.g., workspace root and project level). All found configs are merged together.

**Why a separate file?** OpenCode's `opencode.json` has strict schema validation and won't accept custom fields. This separate config file gives us flexibility without breaking OpenCode's validation.

### Config Search Pattern

The plugin follows OpenCode's config search pattern:

1. **Global config**: Checks `~/.config/opencode/opencode-allowlist.json` and `~/.local/share/opencode/config/opencode-allowlist.json`
2. **Workspace configs**: Searches from current directory up to git worktree root
3. **Merges all found configs**: All allowedDirectories from all levels are combined

**Example:**

```
~/.config/opencode/opencode-allowlist.json                                    ← Global (all projects)
/Users/username/workspace/.opencode/opencode-allowlist.json                   ← Workspace level
/Users/username/workspace/projects/my-project/.opencode/opencode-allowlist.json  ← Project level
```

All three configs are loaded and merged! This matches how OpenCode loads plugins and configs.

### Path Matching

- Paths are matched using `startsWith` after normalization
- All subdirectories of an allowed directory are automatically included
- Supports absolute paths only (for security and clarity)

### Examples

If you configure (in `.opencode/opencode-allowlist.json`):

```json
{
  "allowedDirectories": ["/Users/username/workspace/projects"]
}
```

Then these paths are auto-allowed:

- ✅ `/Users/username/workspace/projects/project-a/file.ts`
- ✅ `/Users/username/workspace/projects/project-b/src/main.ts`
- ✅ `/Users/username/workspace/projects/nested/deep/file.md`

But these are NOT:

- ❌ `/Users/username/workspace/other-folder/file.ts`
- ❌ `/Users/username/other-repo/file.ts`

## Usage

Once configured, the plugin works automatically. No manual intervention needed.

### Checking Configuration

The plugin provides a tool that agents can use:

```
listAllowedDirectories
```

This will show the currently configured allowed directories.

## Security

### Why No Add/Remove Tools?

This plugin intentionally does NOT provide tools for the agent to add or remove directories. This is a security feature:

- **Without tools**: Only you (the human) can modify allowed directories via config
- **With tools**: An agent could grant itself access to any directory on your system

### Manual Configuration Only

To change allowed directories:

1. Edit `.opencode/opencode-allowlist.json` manually
2. Add or remove paths from the `allowedDirectories` array
3. Restart your OpenCode session (config is cached)

## How It Works

1. Plugin loads on OpenCode startup
2. Searches for `.opencode/opencode-allowlist.json` files from current directory up to worktree root
3. Merges all found configs and caches in memory
4. Hooks into `permission.ask` events
5. When agent requests external directory access:
   - Checks if path matches any allowed directory
   - Auto-approves if match found
   - Otherwise, normal permission prompt appears

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build for production
bun run build

# Run tests
bun test
```

## Troubleshooting

### Plugin not loading

Check console output for `[Allowlist]` messages:

```
[Allowlist] Loaded 1 allowed directories from /path/to/.opencode/opencode-allowlist.json
[Allowlist] Total 1 unique allowed directories configured
```

### Directories not being allowed

1. Check paths are absolute (not relative)
2. Verify `.opencode/opencode-allowlist.json` syntax is valid JSON
3. Ensure `.opencode/opencode-allowlist.json` exists somewhere between your current directory and worktree root
4. Check console for `[Allowlist] ✗ Not in allowed list: /path`

### Config changes not taking effect

The config is cached in memory. Restart your OpenCode session after changing `.opencode/opencode-allowlist.json`.

## License

MIT
