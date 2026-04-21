export type Ecosystem = 'npm' | 'pypi' | 'rubygems' | 'go' | 'cargo';

export interface NetworkEvent {
  pkg: string;
  label: string;
  url: string;
  status?: number;
  ok?: boolean;
  ms?: number;
  cached?: boolean;
}

export type NetworkLogger = (event: NetworkEvent) => void;

export type FlagType =
  | 'nonexistent'
  | 'recently_registered'
  | 'low_downloads'
  | 'suspicious_script'
  | 'outdated'
  | 'low_adoption_latest'
  | 'clean'
  | 'unsupported';

export type Severity = 'critical' | 'high' | 'medium' | 'clean' | 'unsupported';

export interface ParsedPackage {
  name: string;
  version: string | null;
  ecosystem: Ecosystem;
  raw: string;
  isDev?: boolean;
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
    updatedAt?: string;
    latestVersion?: string;
    monthlyDownloads?: number;
    hasPostInstall?: boolean;
    postInstallScript?: string;
  };
}
