# VA Docs MCP Server

An MCP (Model Context Protocol) server that provides AI assistants with efficient access to VA.gov documentation.

## Prerequisites

- Node.js 18+ 
- The `va.gov-team` repository cloned locally
- Claude Desktop or other MCP-compatible client

## Setup

1. **Clone this repository** alongside your `va.gov-team` repo:
   ```bash
   parent-directory/
   ├── va.gov-team/       # Your existing VA docs repo
   └── va-docs-mcp/       # This MCP server
   ```

2. **Install dependencies and build**:
   ```bash
   cd va-docs-mcp
   npm install
   npm run build
   ```

3. **Configure Claude Desktop**:
   
   Add to your Claude configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "va-docs": {
         "command": "node",
         "args": ["/absolute/path/to/va-docs-mcp/build/index.js"]
       }
     }
   }
   ```

4. **Restart Claude Desktop** to load the MCP server

## Available Tools

Once configured, you can ask Claude to use these tools:

- **search_docs** - Search VA documentation by keyword
  - Example: "Search VA docs for appointment scheduling"
  
- **get_document** - Retrieve a specific document
  - Example: "Get the content of products/health-care/appointments/README.md"
  
- **list_categories** - See all documentation categories
  - Example: "List all VA doc categories"

## Custom Repository Location

If your `va.gov-team` repo is not in the sibling directory, set the `VA_DOCS_PATH` environment variable:

```json
{
  "mcpServers": {
    "va-docs": {
      "command": "node",
      "args": ["/path/to/va-docs-mcp/build/index.js"],
      "env": {
        "VA_DOCS_PATH": "/custom/path/to/va.gov-team"
      }
    }
  }
}
```

## Development

Run in development mode:
```bash
npm run dev
```

## Troubleshooting

- **"Could not find va.gov-team repository"**: Ensure the va.gov-team repo exists as a sibling directory or set VA_DOCS_PATH
- **Tools not appearing in Claude**: Restart Claude Desktop after updating configuration
- **Check server logs**: Errors are logged to stderr and visible in Claude's MCP logs