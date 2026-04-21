import type { ParsedPackage, ScanResult } from '../types';
import { checkNpm } from './checkNpm';
import { checkPypi } from './checkPypi';

export async function checkPackage(pkg: ParsedPackage): Promise<ScanResult> {
  switch (pkg.ecosystem) {
    case 'npm':   return checkNpm(pkg);
    case 'pypi':  return checkPypi(pkg);
    default:
      return {
        package: pkg,
        flag: 'unsupported',
        severity: 'unsupported',
        reason: `Registry checks for ${pkg.ecosystem} coming in v2`,
        registryUrl: '',
        meta: { exists: true },
      };
  }
}
