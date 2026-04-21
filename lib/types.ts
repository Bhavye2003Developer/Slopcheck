export type Ecosystem = 'npm' | 'pypi' | 'rubygems' | 'go' | 'cargo';

export type FlagType =
  | 'nonexistent'
  | 'recently_registered'
  | 'low_downloads'
  | 'suspicious_script'
  | 'clean'
  | 'unsupported';

export type Severity = 'critical' | 'high' | 'medium' | 'clean' | 'unsupported';

export interface ParsedPackage {
  name: string;
  version: string | null;
  ecosystem: Ecosystem;
  raw: string;
}

export interface ScanResult {
  package: ParsedPackage;
  flag: FlagType;
  severity: Severity;
  reason: string;
  registryUrl: string;
  suggestion?: string;
  meta: {
    exists: boolean;
    createdAt?: string;
    monthlyDownloads?: number;
    hasPostInstall?: boolean;
    postInstallScript?: string;
  };
}
