const DEFAULT_ITEMS = [
  'CRYPTO-UTILS NOT FOUND',
  'FLASK-HELPERS NOT FOUND',
  'DATA-FRAME-UTILS 12 DAYS OLD',
  'PIP-UTILS 43 DOWNLOADS',
  'AI-UTILS NOT FOUND',
  'ML-HELPERS NOT FOUND',
  'NODE-FETCH2 87 DOWNLOADS',
  'TORCH-UTILS NOT FOUND',
];

interface TickerProps {
  items?: string[];
}

export default function Ticker({ items = DEFAULT_ITEMS }: TickerProps) {
  const repeated = [...items, ...items];
  const text = repeated.join(' |');

  return (
    <div className="hidden md:block overflow-hidden border-t border-b py-2" style={{ borderColor: 'var(--border)' }}>
      <div className="flex whitespace-nowrap animate-ticker" style={{ width: 'max-content' }}>
        <span className="text-xs tracking-widest px-8" style={{ color: 'var(--critical)' }}>
          {text} |{text}
        </span>
      </div>
    </div>
  );
}
