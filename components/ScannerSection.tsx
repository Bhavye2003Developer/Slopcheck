'use client';

import { useState, useCallback } from 'react';
import ScanInput from './scanner/ScanInput';
import ScanProgress from './scanner/ScanProgress';
import ResultsTable from './scanner/ResultsTable';
import NetworkTrail from './scanner/NetworkTrail';
import { detectAndParse } from '@/lib/parsers';
import { runScan } from '@/lib/scanner';
import type { ScanResult, NetworkEvent, Severity } from '@/lib/types';
import type { EcosystemHint } from '@/lib/parsers';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, clean: 3, unsupported: 4 };

export default function ScannerSection() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [networkEvents, setNetworkEvents] = useState<NetworkEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(async (
    content: string,
    ecosystem: EcosystemHint,
    includeDevDeps: boolean
  ) => {
    setError(null);
    setResults([]);
    setNetworkEvents([]);
    setProgress(null);

    const packages = detectAndParse(content, ecosystem, includeDevDeps);
    if (packages.length === 0) {
      setError('No packages found. Check the format or try a different file type.');
      return;
    }

    setLoading(true);
    setScanning(true);
    setProgress({ done: 0, total: packages.length });

    try {
      await runScan(packages, {
        onResult: (result, done, total) => {
          setProgress({ done, total });
          setResults(prev => [...prev, result].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]));
        },
        onNetworkEvent: event => {
          setNetworkEvents(prev => [...prev, event]);
        },
        onOsvResult: updated => {
          setResults(prev =>
            prev.map(r =>
              r.package.name === updated.package.name && r.package.ecosystem === updated.package.ecosystem
                ? updated
                : r
            )
          );
        },
      });
    } catch {
      setError('Scan failed. Check your connection and try again.');
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, []);

  return (
    <section
      id="scanner"
      className="py-16 md:py-24 px-4 md:px-6"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-7xl mx-auto">
        <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--muted)' }}>
          SCAN YOUR MANIFEST
        </p>
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-8 md:mb-10">
          PASTE. SCAN.<br />FIND OUT.
        </h2>

        <ScanInput onScan={handleScan} loading={loading} />

        {scanning && progress && (
          <ScanProgress done={progress.done} total={progress.total} />
        )}

        {error && (
          <p className="mt-4 text-xs tracking-widest" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}

        {results.length > 0 && (
          <ResultsTable results={results} scanning={scanning} />
        )}

        <NetworkTrail events={networkEvents} />
      </div>
    </section>
  );
}
