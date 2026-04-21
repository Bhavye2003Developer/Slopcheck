import type { ParsedPackage } from '../types';

export function parseCargoToml(content: string): ParsedPackage[] {
  const results: ParsedPackage[] = [];
  const lines = content.split('\n');

  let inDeps = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    // Section header
    if (line.startsWith('[')) {
      // [dependencies] or [dependencies.foo] both count
      inDeps = line === '[dependencies]' || line.startsWith('[dependencies.');
      continue;
    }

    if (!inDeps) continue;

    // name = "1.2.3"  or  name = "^1.2"
    const simple = line.match(/^([\w-]+)\s*=\s*"([^"]*)"/);
    if (simple) {
      results.push({ name: simple[1], version: simple[2].replace(/^[\^~>=<* ]+/, ''), ecosystem: 'cargo', raw: line });
      continue;
    }

    // name = { version = "1.2.3", ... }
    const inlineVer = line.match(/^([\w-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]*)"/);
    if (inlineVer) {
      results.push({ name: inlineVer[1], version: inlineVer[2].replace(/^[\^~>=<* ]+/, ''), ecosystem: 'cargo', raw: line });
      continue;
    }

    // name = { git = "...", ... }  — no version, still track it
    const inlineNoVer = line.match(/^([\w-]+)\s*=\s*\{/);
    if (inlineNoVer) {
      results.push({ name: inlineNoVer[1], version: null, ecosystem: 'cargo', raw: line });
    }
  }

  return results;
}
