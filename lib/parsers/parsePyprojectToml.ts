import type { ParsedPackage } from '../types';

function stripPyVersion(dep: string): { name: string; version: string | null } {
  const withoutExtras = dep.replace(/\[.*?\]/, '');
  const name = withoutExtras.split(/[=!<>~^;]/)[0].trim();
  const versionMatch = dep.match(/[=!<>~^]+([\w.*]+)/);
  return { name, version: versionMatch ? versionMatch[1] : null };
}

export function parsePyprojectToml(content: string): ParsedPackage[] {
  const results: ParsedPackage[] = [];

  // [project] dependencies = ["flask>=2.0", ...]
  const projectDepsMatch = content.match(/\[project\][\s\S]*?^dependencies\s*=\s*\[([\s\S]*?)\]/m);
  if (projectDepsMatch) {
    const items = projectDepsMatch[1].match(/"([^"]+)"|'([^']+)'/g) ?? [];
    for (const item of items) {
      const raw = item.replace(/['"]/g, '');
      const { name, version } = stripPyVersion(raw);
      if (name) results.push({ name, version, ecosystem: 'pypi', raw });
    }
  }

  // [tool.poetry.dependencies] name = "^1.0"
  const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\[|$)/m);
  if (poetryMatch) {
    const block = poetryMatch[1];
    const lines = block.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    for (const line of lines) {
      const match = line.match(/^(\w[\w-]*)\s*=\s*["']([^"']+)["']/);
      if (match && match[1].toLowerCase() !== 'python') {
        results.push({ name: match[1], version: match[2].replace(/^[\^~>=]+/, ''), ecosystem: 'pypi', raw: line.trim() });
      }
    }
  }

  return results;
}
