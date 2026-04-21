import type { ParsedPackage } from '../types';

export function parseGoMod(content: string): ParsedPackage[] {
  const results: ParsedPackage[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Single-line: require github.com/foo/bar v1.2.3
    if (trimmed.startsWith('require ')) {
      const parts = trimmed.replace('require ', '').trim().split(/\s+/);
      if (parts.length >= 2 && parts[1].startsWith('v')) {
        results.push({ name: parts[0], version: parts[1], ecosystem: 'go', raw: trimmed });
      }
    }
  }

  // Block: require ( \n name version \n )
  const blockMatch = content.match(/require\s*\(([\s\S]*?)\)/);
  if (blockMatch) {
    for (const line of blockMatch[1].split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1].startsWith('v')) {
        results.push({ name: parts[0], version: parts[1], ecosystem: 'go', raw: line.trim() });
      }
    }
  }

  return results;
}
