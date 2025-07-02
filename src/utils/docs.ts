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
    
    return {
      path: filePath,
      relativePath,
      title,
      content: markdownContent,
      frontmatter: data,
      category
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