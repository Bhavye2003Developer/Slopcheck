import type { Ecosystem, ParsedPackage } from '../types';
import { parsePackageJson } from './parsePackageJson';
import { parseRequirementsTxt } from './parseRequirementsTxt';
import { parsePyprojectToml } from './parsePyprojectToml';
import { parseGemfile } from './parseGemfile';
import { parseGoMod } from './parseGoMod';
import { parseCargoToml } from './parseCargoToml';

export type EcosystemHint = Ecosystem | 'auto';

function detectEcosystem(content: string): Ecosystem {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.includes('"dependencies"')) return 'npm';
  if (trimmed.includes('[project]') || trimmed.includes('[tool.poetry]')) return 'pypi';
  if (trimmed.match(/^module\s+\S+/m) || trimmed.includes('go ')) return 'go';
  if (trimmed.includes('[package]') && trimmed.includes('[dependencies]')) return 'cargo';
  if (trimmed.match(/^gem\s+['"]/m) || trimmed.match(/^source\s+['"]/m)) return 'rubygems';
  // Default: requirements.txt style
  return 'pypi';
}

export function detectAndParse(
  content: string,
  hint: EcosystemHint = 'auto',
  includeDevDeps = false
): ParsedPackage[] {
  const ecosystem = hint === 'auto' ? detectEcosystem(content) : hint;

  switch (ecosystem) {
    case 'npm':      return parsePackageJson(content, includeDevDeps);
    case 'pypi':     return content.trim().startsWith('{') || content.includes('[project]') || content.includes('[tool.poetry]')
                       ? parsePyprojectToml(content)
                       : parseRequirementsTxt(content);
    case 'rubygems': return parseGemfile(content);
    case 'go':       return parseGoMod(content);
    case 'cargo':    return parseCargoToml(content);
  }
}
