import type { ParsedPackage, ScanResult, NetworkLogger } from '../types';
import { checkNpm } from './checkNpm';
import { checkPypi } from './checkPypi';

export async function checkPackage(pkg: ParsedPackage, log?: NetworkLogger): Promise<ScanResult> {
  switch (pkg.ecosystem) {
    case 'npm':  return checkNpm(pkg, log);
    case 'pypi': return checkPypi(pkg, log);
    default:
      return { package: pkg, flag: 'unsupported', severity: 'unsupported', reason: `Registry checks for ${pkg.ecosystem} coming in v2`, registryUrl: '', meta: { exists: true } };
  }
}
