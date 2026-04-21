import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { checkNpm } from './checkNpm';
import { checkPypi } from './checkPypi';
import { checkRubyGems } from './checkRubyGems';
import { checkCargo } from './checkCargo';
import { checkGo } from './checkGo';

export async function checkPackage(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  switch (pkg.ecosystem) {
    case 'npm':      return checkNpm(pkg, log);
    case 'pypi':     return checkPypi(pkg, log);
    case 'rubygems': return checkRubyGems(pkg, log);
    case 'cargo':    return checkCargo(pkg, log);
    case 'go':       return checkGo(pkg, log);
    default:
      return { package: pkg, flag: 'unsupported', severity: 'unsupported', reason: `Registry checks for ${pkg.ecosystem} not yet supported`, registryUrl: '', meta: { exists: true } };
  }
}
