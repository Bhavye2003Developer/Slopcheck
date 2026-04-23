interface ScanProgressProps {
  done: number;
  total: number;
}

export default function ScanProgress({ done, total }: ScanProgressProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const filledFull = Math.round(pct / 5);
  const barFull = '█'.repeat(filledFull) + '░'.repeat(20 - filledFull);
  const filledShort = Math.round(pct / 10);
  const barShort = '█'.repeat(filledShort) + '░'.repeat(10 - filledShort);

  return (
    <div className="py-4 text-xs tracking-widest flex flex-wrap items-center gap-x-1 gap-y-1" style={{ color: 'var(--muted)' }}>
      <span style={{ color: 'var(--warning)' }}>SCANNING</span>
      <span>|</span>
      <span style={{ color: 'var(--fg)' }}>{done} / {total}</span>
      <span>pkgs</span>
      <span className="hidden sm:inline" style={{ color: 'var(--warning)', letterSpacing: '0' }}>{barFull}</span>
      <span className="sm:hidden" style={{ color: 'var(--warning)', letterSpacing: '0' }}>{barShort}</span>
      <span style={{ color: 'var(--fg)' }}>{pct}%</span>
    </div>
  );
}
