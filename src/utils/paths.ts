import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function findVaDocsRepo(): string {
  // First check environment variable
  if (process.env.VA_DOCS_PATH && existsSync(process.env.VA_DOCS_PATH)) {
    return resolve(process.env.VA_DOCS_PATH);
  }

  // Check sibling directory (assumes both repos are in same parent)
  const mcpRoot = resolve(__dirname, '..', '..');
  const parentDir = dirname(mcpRoot);
  const siblingPath = join(parentDir, 'va.gov-team');
  
  if (existsSync(siblingPath)) {
    return siblingPath;
  }

  // Check common locations
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const commonPaths = [
    join(homeDir, 'projects', 'va.gov-team'),
    join(homeDir, 'repos', 'va.gov-team'),
    join(homeDir, 'code', 'va.gov-team'),
    join(homeDir, 'va.gov-team')
  ];

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    'Could not find va.gov-team repository. Please ensure it exists as a sibling directory or set VA_DOCS_PATH environment variable.'
  );
}