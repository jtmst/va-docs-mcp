import { readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

export interface Document {
  path: string;
  relativePath: string;
  title: string;
  content: string;
  frontmatter: Record<string, any>;
  category?: string;
  summary?: string;
  keySections?: string[];
  estimatedReadTime?: number;
  documentType?: string;
  lastModified?: Date;
}

export async function findDocuments(docsPath: string, pattern: string = '**/*.md'): Promise<string[]> {
  const files = await glob(pattern, {
    cwd: docsPath,
    ignore: ['node_modules/**', '**/node_modules/**', '.git/**'],
    absolute: true
  });
  return files;
}

export function parseDocument(filePath: string, basePath: string): Document | null {
  try {
    // Check if it's a file (not a directory)
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      return null;
    }
    
    const content = readFileSync(filePath, 'utf-8');
    
    // Try to parse frontmatter, but handle errors gracefully
    let data: Record<string, any> = {};
    let markdownContent = content;
    
    try {
      const parsed = matter(content);
      data = parsed.data;
      markdownContent = parsed.content;
    } catch (yamlError) {
      // If YAML parsing fails, treat entire content as markdown
      console.error(`YAML parse error in ${filePath}:`, yamlError);
    }
    
    const relativePath = relative(basePath, filePath);
    const title = data.title || extractTitleFromContent(markdownContent) || relativePath;
    
    // Try to determine category from path
    const pathParts = relativePath.split('/');
    const category = pathParts[0] || 'general';
    
    // Extract metadata and create summary
    const metadata = extractDocumentMetadata(markdownContent, filePath, data);
    
    return {
      path: filePath,
      relativePath,
      title,
      content: markdownContent,
      frontmatter: data,
      category,
      ...metadata
    };
  } catch (error) {
    console.error(`Error parsing document ${filePath}:`, error);
    return null;
  }
}

function extractTitleFromContent(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

export function searchDocuments(
  documents: Document[], 
  query: string, 
  options: { category?: string; limit?: number } = {}
): Document[] {
  const lowerQuery = query.toLowerCase();
  
  let results = documents.filter(doc => {
    // Filter by category if specified
    if (options.category && doc.category !== options.category) {
      return false;
    }
    
    // Search in title, content, and frontmatter
    const searchText = [
      doc.title,
      doc.content,
      JSON.stringify(doc.frontmatter)
    ].join(' ').toLowerCase();
    
    return searchText.includes(lowerQuery);
  });
  
  // Sort by relevance (title matches first)
  results.sort((a, b) => {
    const aInTitle = a.title.toLowerCase().includes(lowerQuery);
    const bInTitle = b.title.toLowerCase().includes(lowerQuery);
    
    if (aInTitle && !bInTitle) return -1;
    if (!aInTitle && bInTitle) return 1;
    return 0;
  });
  
  // Apply limit if specified
  if (options.limit) {
    results = results.slice(0, options.limit);
  }
  
  return results;
}

function extractDocumentMetadata(content: string, filePath: string, frontmatter: Record<string, any>) {
  // Extract key sections from headers
  const keySections = extractSections(content);
  
  // Estimate read time (average 200 words per minute)
  const wordCount = content.split(/\s+/).length;
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200));
  
  // Determine document type
  const documentType = determineDocumentType(content, filePath, frontmatter);
  
  // Create summary
  const summary = createSummary(content, keySections, documentType);
  
  // Get file modification time
  let lastModified: Date | undefined;
  try {
    const stats = statSync(filePath);
    lastModified = stats.mtime;
  } catch (error) {
    // Ignore stat errors
  }
  
  return {
    summary,
    keySections,
    estimatedReadTime,
    documentType,
    lastModified
  };
}

function extractSections(content: string): string[] {
  const headers = content.match(/^#{1,3}\s+(.+)$/gm);
  return headers ? headers.map(h => h.replace(/^#+\s+/, '').trim()) : [];
}

function determineDocumentType(content: string, filePath: string, frontmatter: Record<string, any>): string {
  const fileName = filePath.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Check frontmatter first
  if (frontmatter.type) return frontmatter.type;
  
  // Determine by filename patterns
  if (fileName.includes('readme')) return 'guide';
  if (fileName.includes('rfc')) return 'rfc';
  if (fileName.includes('api')) return 'api-docs';
  if (fileName.includes('setup') || fileName.includes('install')) return 'setup-guide';
  if (fileName.includes('test')) return 'testing';
  
  // Determine by content patterns
  if (contentLower.includes('## api') || contentLower.includes('endpoint')) return 'api-docs';
  if (contentLower.includes('## installation') || contentLower.includes('## setup')) return 'setup-guide';
  if (contentLower.includes('## background') && contentLower.includes('## proposal')) return 'rfc';
  if (contentLower.includes('## getting started') || contentLower.includes('## prerequisites')) return 'guide';
  if (contentLower.includes('## test') || contentLower.includes('testing')) return 'testing';
  
  return 'documentation';
}

function createSummary(content: string, keySections: string[], documentType: string): string {
  // Extract first paragraph as base summary
  const paragraphs = content.split('\n\n').filter(p => p.trim() && !p.trim().startsWith('#'));
  const firstParagraph = paragraphs[0]?.trim() || '';
  
  // Create a concise summary
  let summary = firstParagraph.substring(0, 200);
  if (firstParagraph.length > 200) {
    summary += '...';
  }
  
  // If no good first paragraph, create summary from sections
  if (!summary || summary.length < 50) {
    if (keySections.length > 0) {
      summary = `${documentType} covering: ${keySections.slice(0, 3).join(', ')}`;
      if (keySections.length > 3) {
        summary += ` and ${keySections.length - 3} more topics`;
      }
    } else {
      summary = `${documentType} document`;
    }
  }
  
  return summary;
}