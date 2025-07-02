# VA Docs MCP Server

An intelligent MCP (Model Context Protocol) server that provides AI assistants with enhanced access to VA.gov documentation. Features relationship detection, content-aware search, and smart document discovery.

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

## Key Features

### 🔍 **Intelligent Search**
- **Content-aware search** with context understanding ("new developer", "API integration", "troubleshooting")
- **Document type filtering** (guides, API docs, setup guides, etc.)
- **Relevance scoring** based on title, content, and context matches
- **Freshness detection** to exclude outdated documentation

### 🔗 **Relationship Detection**
- **Automatic link analysis** between documents
- **Learning path discovery** (prerequisites → guides → follow-ups)
- **Cross-reference mapping** to show document dependencies
- **Bidirectional relationships** (what links to what)

### 📖 **Enhanced Document Retrieval**
- **Rich metadata** including summaries, reading time, and document types
- **Related documents** automatically included when requested
- **Content classification** (setup guides, API docs, testing, etc.)
- **Section extraction** from markdown headers

## Available Tools

### **search_docs** - Intelligent Documentation Search
```typescript
// Basic search
"Search VA docs for appointment scheduling"

// Context-aware search
"I'm a new developer - show me setup guides for frontend development"

// Advanced filtering
"Find current API documentation, excluding deprecated content"
```

**Parameters:**
- `query` (required) - Search terms
- `context` - Search context ("new developer", "API integration", "troubleshooting")
- `document_types` - Filter by type (["guide", "api-docs", "setup-guide"])
- `category` - Filter by category ("products", "platform", "teams")
- `exclude_outdated` - Skip potentially stale documentation
- `include_full_content` - Return complete document content
- `limit` - Maximum results (default: 10)

### **get_document** - Retrieve Specific Documents
```typescript
// Basic document retrieval
"Get the content of products/health-care/appointments/README.md"

// Include related documents
"Get the frontend setup guide and show me related documentation"
```

**Parameters:**
- `path` (required) - Relative path to document
- `include_related` - Include prerequisites, follow-ups, and related docs

### **list_categories** - Browse Documentation Structure
Lists all available documentation categories (products, platform, teams, etc.)

## Example Use Cases

### 📚 **New Developer Onboarding**
```
"I'm a new developer joining VA.gov. Show me setup guides and what I should read next."
```
*Uses context-aware search and relationship detection to build learning paths*

### 🔧 **API Integration**
```
"Find Claims API documentation and show me prerequisites and related guides."
```
*Leverages document relationships to provide comprehensive integration guidance*

### 🐛 **Troubleshooting**
```
"I'm having environment issues. Find troubleshooting guides, excluding outdated docs."
```
*Uses freshness detection and context scoring for relevant, current solutions*

### 🎯 **Targeted Research**
```
"Show me only setup guides for platform services with related documentation."
```
*Combines document type filtering with relationship resolution*

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

## Architecture

This MCP server provides:

- **In-memory document indexing** for fast search and retrieval
- **Intelligent relationship mapping** between documents
- **Context-aware relevance scoring** for better search results  
- **Automatic content analysis** for metadata extraction
- **Freshness detection** to identify potentially outdated content

Documents are loaded once on startup and relationships are built automatically by analyzing:
- Markdown links between documents
- Explicit relationship sections ("Prerequisites:", "See also:")
- Implicit relationships based on document types and content patterns

## Troubleshooting

- **"Could not find va.gov-team repository"**: Ensure the va.gov-team repo exists as a sibling directory or set VA_DOCS_PATH
- **Tools not appearing in Claude**: Restart Claude Desktop after updating configuration
- **Search results seem limited**: Try using context parameters and document type filters for better results
- **No related documents showing**: Relationships are built automatically - some documents may not have detectable relationships
- **Check server logs**: Errors are logged to stderr and visible in Claude's MCP logs

## Contributing

This MCP server transforms static documentation into an intelligent knowledge base. The relationship detection and content-aware search make it easier for AI assistants to provide comprehensive, contextual answers about VA.gov development.