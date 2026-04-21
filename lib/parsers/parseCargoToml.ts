import type { ParsedPackage } from '../types';

export function parseCargoToml(content: string): ParsedPackage[] {
  const results: ParsedPackage[] = [];

  const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/m);
  if (!depsMatch) return results;

  const lines = depsMatch[1].split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  for (const line of lines) {
    // name = "1.0" or name = { version = "1.0", ... }
    const simple = line.match(/^([\w-]+)\s*=\s*"([^"]+)"/);
    if (simple) {
      results.push({ name: simple[1], version: simple[2].replace(/^[\^~>=]+/, ''), ecosystem: 'cargo', raw: line.trim() });
      continue;
    }
    const inline = line.match(/^([\w-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"/);
    if (inline) {
      results.push({ name: inline[1], version: inline[2].replace(/^[\^~>=]+/, ''), ecosystem: 'cargo', raw: line.trim() });
    }
  }

  return results;
}
