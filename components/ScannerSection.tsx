'use client';

import { useState, useCallback } from 'react';
import ScanInput from './scanner/ScanInput';
import ScanProgress from './scanner/ScanProgress';
import ResultsTable from './scanner/ResultsTable';
import { detectAndParse } from '@/lib/parsers';
import { runScan } from '@/lib/scanner';
import type { ScanResult } from '@/lib/types';
import type { EcosystemHint } from '@/lib/parsers';

export default function ScannerSection() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ScanResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async (
    content: string,
    ecosystem: EcosystemHint,
    includeDevDeps: boolean
  ) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setProgress(null);

    try {
      const packages = detectAndParse(content, ecosystem, includeDevDeps);
      if (packages.length === 0) {
        setError('No packages found. Check the format or try a different file type.');
        return;
      }
      setProgress({ done: 0, total: packages.length });
      const scanResults = await runScan(packages, (done, total) => {
        setProgress({ done, total });
      });
      setResults(scanResults);
    } catch {
      setError('Scan failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section
      id="scanner"
      className="py-24 px-6"
      style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="max-w-7xl mx-auto">
        <p className="text-xs tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
          SCAN YOUR MANIFEST
        </p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-10">
          PASTE. SCAN.<br />FIND OUT.
        </h2>

        <ScanInput onScan={handleScan} loading={loading} />

        {loading && progress && (
          <ScanProgress done={progress.done} total={progress.total} />
        )}

        {error && (
          <p className="mt-4 text-xs tracking-widest" style={{ color: 'var(--critical)' }}>
            {error}
          </p>
        )}

        {results && <ResultsTable results={results} />}
      </div>
    </section>
  );
}
