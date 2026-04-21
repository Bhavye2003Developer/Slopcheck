interface ScanProgressProps {
  done: number;
  total: number;
}

export default function ScanProgress({ done, total }: ScanProgressProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return (
    <div className="py-4 text-xs tracking-widest" style={{ color: 'var(--muted)' }}>
      <span style={{ color: 'var(--warning)' }}>SCANNING</span>
      {' | '}
      <span style={{ color: 'var(--fg)' }}>{done} / {total}</span>
      {' packages checked '}
      <span style={{ color: 'var(--warning)', letterSpacing: '0' }}>{bar}</span>
      {'  '}
      <span style={{ color: 'var(--fg)' }}>{pct}%</span>
    </div>
  );
}
