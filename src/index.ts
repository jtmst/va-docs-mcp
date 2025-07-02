#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema
} from '@modelcontextprotocol/sdk/types.js';
import { findVaDocsRepo } from './utils/paths.js';
import { findDocuments, parseDocument, searchDocuments, Document } from './utils/docs.js';

class VaDocsMcpServer {
  private server: Server;
  private docsPath: string;
  private documents: Document[] = [];
  private documentsLoaded = false;

  constructor() {
    this.server = new Server(
      {
        name: 'va-docs-mcp',
        version: '1.0.0',
        description: 'MCP server for VA.gov documentation'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Find the docs repository
    try {
      this.docsPath = findVaDocsRepo();
      console.error(`Found VA docs at: ${this.docsPath}`);
    } catch (error) {
      console.error('Error finding VA docs repository:', error);
      process.exit(1);
    }

    this.setupHandlers();
  }

  private async loadDocuments() {
    if (this.documentsLoaded) return;
    
    console.error('Loading documents...');
    const files = await findDocuments(this.docsPath);
    this.documents = files
      .map(file => parseDocument(file, this.docsPath))
      .filter((doc): doc is Document => doc !== null);
    this.documentsLoaded = true;
    console.error(`Loaded ${this.documents.length} documents`);
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_docs',
          description: 'Search VA.gov documentation by query',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              category: {
                type: 'string',
                description: 'Optional category filter (e.g., "products", "platform", "design")'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (default: 10)'
              },
              include_full_content: {
                type: 'boolean',
                description: 'Include full document content in results (default: false)'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_document',
          description: 'Get the full content of a specific document',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Relative path to the document (e.g., "products/health-care/appointments/README.md")'
              }
            },
            required: ['path']
          }
        },
        {
          name: 'list_categories',
          description: 'List all available documentation categories',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.loadDocuments();

      switch (request.params.name) {
        case 'search_docs': {
          const { query, category, limit = 10, include_full_content = false } = request.params.arguments as any;
          const results = searchDocuments(this.documents, query, { category, limit });
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                query,
                count: results.length,
                results: results.map(doc => ({
                  path: doc.relativePath,
                  title: doc.title,
                  category: doc.category,
                  summary: doc.summary,
                  documentType: doc.documentType,
                  keySections: doc.keySections,
                  estimatedReadTime: doc.estimatedReadTime,
                  lastModified: doc.lastModified,
                  excerpt: include_full_content ? undefined : doc.content.substring(0, 200) + '...',
                  content: include_full_content ? doc.content : undefined,
                  frontmatter: include_full_content ? doc.frontmatter : undefined
                }))
              }, null, 2)
            }]
          };
        }

        case 'get_document': {
          const { path } = request.params.arguments as any;
          const doc = this.documents.find(d => d.relativePath === path);
          
          if (!doc) {
            throw new Error(`Document not found: ${path}`);
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                path: doc.relativePath,
                title: doc.title,
                category: doc.category,
                summary: doc.summary,
                documentType: doc.documentType,
                keySections: doc.keySections,
                estimatedReadTime: doc.estimatedReadTime,
                lastModified: doc.lastModified,
                frontmatter: doc.frontmatter,
                content: doc.content
              }, null, 2)
            }]
          };
        }

        case 'list_categories': {
          const categories = new Set(this.documents.map(doc => doc.category).filter(Boolean));
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                categories: Array.from(categories).sort()
              }, null, 2)
            }]
          };
        }

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('VA Docs MCP Server started');
  }
}

// Start the server
const server = new VaDocsMcpServer();
server.start().catch(console.error);