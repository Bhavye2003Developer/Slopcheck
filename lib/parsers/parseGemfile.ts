import type { ParsedPackage } from '../types';

export function parseGemfile(content: string): ParsedPackage[] {
  const results: ParsedPackage[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('gem ')) continue;
    const match = trimmed.match(/^gem\s+['"]([^'"]+)['"]/);
    if (!match) continue;
    const name = match[1];
    const versionMatch = trimmed.match(/,\s*['"]([^'"]+)['"]/);
    const version = versionMatch ? versionMatch[1].replace(/^[\^~>=]+/, '') : null;
    results.push({ name, version, ecosystem: 'rubygems', raw: trimmed });
  }
  return results;
}
