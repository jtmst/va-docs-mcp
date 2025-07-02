# Claude Code Setup

For Claude Code users, add this to your `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "va-docs": {
      "command": "node",
      "args": ["../va-docs-mcp/build/index.js"]
    }
  }
}
```

Note: Claude Code supports relative paths, so if you're working in the `va.gov-team` directory, the above path will work automatically.

You can also use an absolute path if preferred:
```json
{
  "mcpServers": {
    "va-docs": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/projects/va-docs-mcp/build/index.js"]
    }
  }
}
```

After adding this configuration, the MCP server will start automatically when you use Claude Code.