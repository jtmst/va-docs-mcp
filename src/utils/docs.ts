import { readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';
import { glob } from 'glob';

export interface DocumentRelationships {
  prerequisites?: string[];    // Docs that should be read first
  followUps?: string[];       // Next recommended docs
  seeAlso?: string[];         // Related/similar docs
  dependents?: string[];      // Docs that reference this one
}

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
  relationships?: DocumentRelationships;
  internalLinks?: string[];     // All markdown links to other docs
  externalReferences?: string[]; // External links mentioned in content
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
    
    // Extract links and relationships
    const links = extractMarkdownLinks(markdownContent, relativePath);
    const explicitRelationships = extractExplicitRelationships(markdownContent);
    
    return {
      path: filePath,
      relativePath,
      title,
      content: markdownContent,
      frontmatter: data,
      category,
      internalLinks: links.internal,
      externalReferences: links.external,
      relationships: explicitRelationships,
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

export interface SearchOptions {
  category?: string;
  limit?: number;
  context?: string;
  documentTypes?: string[];
  excludeOutdated?: boolean;
}

export function searchDocuments(
  documents: Document[], 
  query: string, 
  options: SearchOptions = {}
): Document[] {
  const lowerQuery = query.toLowerCase();
  
  let results = documents.filter(doc => {
    // Filter by category if specified
    if (options.category && doc.category !== options.category) {
      return false;
    }
    
    // Filter by document types if specified
    if (options.documentTypes && options.documentTypes.length > 0) {
      if (!doc.documentType || !options.documentTypes.includes(doc.documentType)) {
        return false;
      }
    }
    
    // Exclude outdated documents if requested
    if (options.excludeOutdated) {
      const freshnessCheck = assessDocumentFreshness(doc);
      if (freshnessCheck.isOutdated) {
        return false;
      }
    }
    
    // Search in title, content, and frontmatter
    const searchText = [
      doc.title,
      doc.content,
      JSON.stringify(doc.frontmatter)
    ].join(' ').toLowerCase();
    
    return searchText.includes(lowerQuery);
  });
  
  // Sort by relevance
  results.sort((a, b) => {
    // Calculate relevance scores
    const aScore = calculateRelevanceScore(a, lowerQuery, options.context);
    const bScore = calculateRelevanceScore(b, lowerQuery, options.context);
    
    return bScore - aScore; // Higher score first
  });
  
  // Apply limit if specified
  if (options.limit) {
    results = results.slice(0, options.limit);
  }
  
  return results;
}

function calculateRelevanceScore(doc: Document, query: string, context?: string): number {
  let score = 0;
  const lowerTitle = doc.title.toLowerCase();
  const lowerContent = doc.content.toLowerCase();
  
  // Title match is highest priority
  if (lowerTitle.includes(query)) {
    score += 100;
    // Exact title match gets bonus
    if (lowerTitle === query) {
      score += 50;
    }
  }
  
  // Summary match
  if (doc.summary?.toLowerCase().includes(query)) {
    score += 50;
  }
  
  // Content matches
  const contentMatches = (lowerContent.match(new RegExp(query, 'g')) || []).length;
  score += contentMatches * 5;
  
  // Context-based scoring
  if (context) {
    score += getContextualRelevance(doc, context);
  }
  
  // Document type relevance
  if (doc.documentType) {
    // Prefer guides and setup documents for general queries
    if (['guide', 'setup-guide'].includes(doc.documentType)) {
      score += 10;
    }
  }
  
  // Freshness bonus (newer docs get slight preference)
  if (doc.lastModified) {
    const daysSinceModified = (Date.now() - new Date(doc.lastModified).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified < 30) score += 20;
    else if (daysSinceModified < 90) score += 10;
    else if (daysSinceModified < 180) score += 5;
  }
  
  return score;
}

function getContextualRelevance(doc: Document, context: string): number {
  let score = 0;
  const contextLower = context.toLowerCase();
  const titleLower = doc.title.toLowerCase();
  const contentLower = doc.content.toLowerCase();
  
  // Context-specific scoring
  if (contextLower.includes('new developer') || contextLower.includes('getting started')) {
    if (doc.documentType === 'setup-guide') score += 30;
    if (doc.documentType === 'guide') score += 20;
    if (titleLower.includes('setup') || titleLower.includes('getting started')) score += 25;
    if (titleLower.includes('introduction') || titleLower.includes('overview')) score += 15;
  }
  
  if (contextLower.includes('api') || contextLower.includes('integration')) {
    if (doc.documentType === 'api-docs') score += 30;
    if (titleLower.includes('api') || titleLower.includes('endpoint')) score += 25;
    if (titleLower.includes('integration') || titleLower.includes('contract')) score += 20;
  }
  
  if (contextLower.includes('troubleshoot') || contextLower.includes('debug') || contextLower.includes('error')) {
    if (doc.documentType === 'testing') score += 20;
    if (titleLower.includes('troubleshoot') || titleLower.includes('error')) score += 25;
    if (titleLower.includes('debug') || titleLower.includes('fix')) score += 20;
    if (contentLower.includes('common issues') || contentLower.includes('known issues')) score += 15;
  }
  
  if (contextLower.includes('deploy') || contextLower.includes('release')) {
    if (titleLower.includes('deploy') || titleLower.includes('release')) score += 25;
    if (titleLower.includes('ci/cd') || titleLower.includes('pipeline')) score += 20;
  }
  
  return score;
}

function assessDocumentFreshness(doc: Document): { isOutdated: boolean; reasons?: string[] } {
  const reasons: string[] = [];
  
  // Check age
  if (doc.lastModified) {
    const daysSinceModified = (Date.now() - new Date(doc.lastModified).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified > 365) {
      reasons.push('Document is over 1 year old');
    }
  }
  
  // Check for outdated markers in content
  const contentLower = doc.content.toLowerCase();
  const outdatedMarkers = [
    'deprecated',
    'outdated',
    'no longer maintained',
    'archive',
    'legacy',
    'obsolete',
    'old version'
  ];
  
  for (const marker of outdatedMarkers) {
    if (contentLower.includes(marker)) {
      reasons.push(`Contains "${marker}" marker`);
    }
  }
  
  // Check for old version references
  const oldVersionPatterns = [
    /node\s*(version)?\s*1[0-2]/i,  // Node 12 or older
    /ruby\s*(version)?\s*2\.[0-5]/i,  // Ruby 2.5 or older
    /react\s*(version)?\s*1[0-5]/i,   // React 15 or older
  ];
  
  for (const pattern of oldVersionPatterns) {
    if (pattern.test(contentLower)) {
      reasons.push('References outdated software versions');
    }
  }
  
  return {
    isOutdated: reasons.length > 0,
    reasons: reasons.length > 0 ? reasons : undefined
  };
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

function extractMarkdownLinks(content: string, documentPath: string): { internal: string[], external: string[] } {
  // Match markdown links: [text](url) and [text]: url
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  const refLinkRegex = /\[([^\]]*)\]:\s*([^\s]+)/g;
  
  const internal: string[] = [];
  const external: string[] = [];
  
  let match;
  
  // Extract inline links [text](url)
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[2].trim();
    categorizeLink(url, documentPath, internal, external);
  }
  
  // Extract reference links [text]: url
  while ((match = refLinkRegex.exec(content)) !== null) {
    const url = match[2].trim();
    categorizeLink(url, documentPath, internal, external);
  }
  
  return { internal: [...new Set(internal)], external: [...new Set(external)] };
}

function categorizeLink(url: string, documentPath: string, internal: string[], external: string[]) {
  // Skip anchors and empty links
  if (!url || url.startsWith('#')) return;
  
  // Check if it's an internal link to another doc
  if (url.endsWith('.md') || url.includes('va.gov-team')) {
    // Resolve relative paths
    let resolvedPath = url;
    
    // Handle relative paths like ../other-doc.md
    if (url.startsWith('./') || url.startsWith('../')) {
      const docDir = documentPath.split('/').slice(0, -1).join('/');
      resolvedPath = resolvePath(docDir, url);
    }
    
    // Remove .md extension and normalize
    resolvedPath = resolvedPath.replace(/\.md$/, '').replace(/^\/+/, '');
    
    // Only add if it looks like a valid internal path
    if (resolvedPath && !resolvedPath.startsWith('http')) {
      internal.push(resolvedPath);
    }
  } else if (url.startsWith('http')) {
    external.push(url);
  }
}

function resolvePath(basePath: string, relativePath: string): string {
  // Simple path resolution for relative links
  const baseSegments = basePath.split('/').filter(Boolean);
  const relativeSegments = relativePath.split('/').filter(Boolean);
  
  for (const segment of relativeSegments) {
    if (segment === '..') {
      baseSegments.pop();
    } else if (segment !== '.') {
      baseSegments.push(segment);
    }
  }
  
  return baseSegments.join('/');
}

function extractExplicitRelationships(content: string): Partial<DocumentRelationships> {
  const relationships: Partial<DocumentRelationships> = {};
  
  // Look for explicit relationship sections
  const prereqMatches = content.match(/(?:prerequisite|prereq)s?:?\s*\n((?:- .*\n?)*)/gi);
  const seeAlsoMatches = content.match(/(?:see also|related):?\s*\n((?:- .*\n?)*)/gi);
  const nextMatches = content.match(/(?:next|follow.?up):?\s*\n((?:- .*\n?)*)/gi);
  
  if (prereqMatches) {
    relationships.prerequisites = extractListItems(prereqMatches[0]);
  }
  
  if (seeAlsoMatches) {
    relationships.seeAlso = extractListItems(seeAlsoMatches[0]);
  }
  
  if (nextMatches) {
    relationships.followUps = extractListItems(nextMatches[0]);
  }
  
  return relationships;
}

function extractListItems(text: string): string[] {
  const items = text.match(/- (.+)/g);
  return items ? items.map(item => item.replace(/^- /, '').trim()) : [];
}

export function buildRelationshipIndex(documents: Document[]): void {
  // Create a map for fast document lookup by path
  const docMap = new Map<string, Document>();
  documents.forEach(doc => {
    docMap.set(doc.relativePath, doc);
    // Also index without .md extension for easier matching
    const pathWithoutExt = doc.relativePath.replace(/\.md$/, '');
    docMap.set(pathWithoutExt, doc);
  });
  
  // Build bidirectional relationships
  documents.forEach(doc => {
    if (!doc.relationships) {
      doc.relationships = {};
    }
    
    // For each internal link, add this document as a dependent
    doc.internalLinks?.forEach(linkedPath => {
      const linkedDoc = findDocumentByPath(linkedPath, docMap);
      if (linkedDoc) {
        if (!linkedDoc.relationships) {
          linkedDoc.relationships = {};
        }
        if (!linkedDoc.relationships.dependents) {
          linkedDoc.relationships.dependents = [];
        }
        
        // Add this document as a dependent if not already present
        if (!linkedDoc.relationships.dependents.includes(doc.relativePath)) {
          linkedDoc.relationships.dependents.push(doc.relativePath);
        }
      }
    });
    
    // Infer relationships from link patterns and content
    inferImplicitRelationships(doc, docMap);
  });
}

function findDocumentByPath(path: string, docMap: Map<string, Document>): Document | undefined {
  // Try exact match first
  let doc = docMap.get(path);
  if (doc) return doc;
  
  // Try with .md extension
  doc = docMap.get(path + '.md');
  if (doc) return doc;
  
  // Try without .md extension
  doc = docMap.get(path.replace(/\.md$/, ''));
  if (doc) return doc;
  
  // Try fuzzy matching for partial paths
  for (const [docPath, document] of docMap.entries()) {
    if (docPath.endsWith(path) || docPath.includes(path)) {
      return document;
    }
  }
  
  return undefined;
}

function inferImplicitRelationships(doc: Document, docMap: Map<string, Document>): void {
  const content = doc.content.toLowerCase();
  const title = doc.title.toLowerCase();
  
  // Infer prerequisites from content patterns
  if (content.includes('before') || content.includes('first') || content.includes('prerequisite')) {
    // Look for documents that this one might depend on
    const setupKeywords = ['setup', 'install', 'configure', 'getting started'];
    if (!setupKeywords.some(keyword => title.includes(keyword))) {
      // This doc might have prerequisites - look for setup docs in same category
      const setupDocs = Array.from(docMap.values()).filter(otherDoc => 
        otherDoc.category === doc.category &&
        otherDoc.documentType === 'setup-guide' &&
        otherDoc.relativePath !== doc.relativePath
      );
      
      if (setupDocs.length > 0 && !doc.relationships?.prerequisites?.length) {
        if (!doc.relationships) doc.relationships = {};
        doc.relationships.prerequisites = setupDocs.slice(0, 2).map(d => d.relativePath);
      }
    }
  }
  
  // Infer follow-ups for setup/getting-started docs
  if (doc.documentType === 'setup-guide' || title.includes('getting started')) {
    const followUpDocs = Array.from(docMap.values()).filter(otherDoc =>
      otherDoc.category === doc.category &&
      otherDoc.documentType !== 'setup-guide' &&
      otherDoc.relativePath !== doc.relativePath &&
      (otherDoc.documentType === 'guide' || otherDoc.documentType === 'testing')
    );
    
    if (followUpDocs.length > 0 && !doc.relationships?.followUps?.length) {
      if (!doc.relationships) doc.relationships = {};
      doc.relationships.followUps = followUpDocs.slice(0, 3).map(d => d.relativePath);
    }
  }
}

export interface RelatedDocuments {
  prerequisites?: DocumentSummary[];
  followUps?: DocumentSummary[];
  seeAlso?: DocumentSummary[];
  dependents?: DocumentSummary[];
}

export interface DocumentSummary {
  path: string;
  title: string;
  summary?: string;
  documentType?: string;
  estimatedReadTime?: number;
  category?: string;
}

export function resolveRelatedDocuments(
  doc: Document, 
  allDocuments: Document[], 
  maxPerType: number = 3
): RelatedDocuments {
  const docMap = new Map<string, Document>();
  allDocuments.forEach(d => {
    docMap.set(d.relativePath, d);
    // Also index without .md extension for easier matching
    const pathWithoutExt = d.relativePath.replace(/\.md$/, '');
    docMap.set(pathWithoutExt, d);
  });

  const related: RelatedDocuments = {};

  if (!doc.relationships) {
    return related;
  }

  // Resolve prerequisites
  if (doc.relationships.prerequisites && doc.relationships.prerequisites.length > 0) {
    related.prerequisites = doc.relationships.prerequisites
      .slice(0, maxPerType)
      .map(path => findDocumentByPath(path, docMap))
      .filter((d): d is Document => d !== null)
      .map(d => createDocumentSummary(d));
  }

  // Resolve follow-ups
  if (doc.relationships.followUps && doc.relationships.followUps.length > 0) {
    related.followUps = doc.relationships.followUps
      .slice(0, maxPerType)
      .map(path => findDocumentByPath(path, docMap))
      .filter((d): d is Document => d !== null)
      .map(d => createDocumentSummary(d));
  }

  // Resolve see-also
  if (doc.relationships.seeAlso && doc.relationships.seeAlso.length > 0) {
    related.seeAlso = doc.relationships.seeAlso
      .slice(0, maxPerType)
      .map(path => findDocumentByPath(path, docMap))
      .filter((d): d is Document => d !== null)
      .map(d => createDocumentSummary(d));
  }

  // Resolve dependents (documents that reference this one)
  if (doc.relationships.dependents && doc.relationships.dependents.length > 0) {
    related.dependents = doc.relationships.dependents
      .slice(0, maxPerType)
      .map(path => findDocumentByPath(path, docMap))
      .filter((d): d is Document => d !== null)
      .map(d => createDocumentSummary(d));
  }

  return related;
}

function createDocumentSummary(doc: Document): DocumentSummary {
  return {
    path: doc.relativePath,
    title: doc.title,
    summary: doc.summary,
    documentType: doc.documentType,
    estimatedReadTime: doc.estimatedReadTime,
    category: doc.category
  };
}