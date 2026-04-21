import type { ParsedPackage } from '../types';

const VERSION_SPECIFIERS = /([=!<>~^]+[\w.*]+(\s*,\s*[=!<>~^]+[\w.*]+)*)/g;

export function parseRequirementsTxt(content: string): ParsedPackage[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('-'))
    .map(line => {
      const raw = line;
      // Strip extras like flask[async] -> flask
      const withoutExtras = line.replace(/\[.*?\]/, '');
      // Strip version specifiers
      const name = withoutExtras.split(/[=!<>~^;]/)[0].trim();
      const versionMatch = line.match(/[=!<>~^]+([\w.*]+)/);
      const version = versionMatch ? versionMatch[1] : null;
      return { name, version, ecosystem: 'pypi' as const, raw };
    })
    .filter(pkg => pkg.name.length > 0);
}
