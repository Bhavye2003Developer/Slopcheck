import type { ParsedPackage } from '../types';

function stripVersion(version: string): string {
  return version.replace(/^[\^~>=<]+/, '').split(' ')[0];
}

export function parsePackageJson(content: string, includeDevDeps = false): ParsedPackage[] {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(content);
  } catch {
    return [];
  }

  const results: ParsedPackage[] = [];

  const deps = (json.dependencies ?? {}) as Record<string, string>;
  for (const [name, version] of Object.entries(deps)) {
    results.push({ name, version: stripVersion(version), ecosystem: 'npm', raw: `${name}@${version}` });
  }

  if (includeDevDeps) {
    const devDeps = (json.devDependencies ?? {}) as Record<string, string>;
    for (const [name, version] of Object.entries(devDeps)) {
      results.push({ name, version: stripVersion(version), ecosystem: 'npm', raw: `${name}@${version}` });
    }
  }

  return results;
}
