const rows = [
  { icon: '❌', severity: 'CRITICAL', name: 'crypto-utils',       reason: 'NOT ON PYPI',    color: 'var(--critical)' },
  { icon: '❌', severity: 'CRITICAL', name: 'flask-helpers',      reason: 'NOT ON PYPI',    color: 'var(--critical)' },
  { icon: '⚠️', severity: 'HIGH',     name: 'data-frame-utils',   reason: '12 DAYS OLD',   color: 'var(--warning)'  },
  { icon: '⚠️', severity: 'HIGH',     name: 'pip-utils',          reason: '43 DOWNLOADS',  color: 'var(--warning)'  },
  { icon: '✅', severity: 'CLEAN',    name: 'numpy',              reason: '',              color: 'var(--clean)'    },
  { icon: '✅', severity: 'CLEAN',    name: 'flask',              reason: '',              color: 'var(--clean)'    },
  { icon: '✅', severity: 'CLEAN',    name: 'sqlalchemy',         reason: '+ 8 more…',    color: 'var(--clean)'    },
];

export default function ScanReceipt() {
  return (
    <div
      className="w-full max-w-lg rounded text-xs"
      style={{ border: '1px solid var(--border)', background: '#0f0f0f' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex justify-between mb-1" style={{ color: 'var(--muted)' }}>
          <span>FILE</span><span>requirements.txt</span>
        </div>
        <div className="flex justify-between mb-1" style={{ color: 'var(--muted)' }}>
          <span>PACKAGES</span><span>14 scanned</span>
        </div>
        <div className="flex justify-between" style={{ color: 'var(--muted)' }}>
          <span>TIME</span><span>1.8s</span>
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {rows.map((row, i) => (
          <div key={i} className="px-4 py-2 flex items-center gap-3" style={{ color: row.color }}>
            <span className="w-4 shrink-0">{row.icon}</span>
            <span className="w-16 shrink-0 opacity-70">{row.severity}</span>
            <span className="flex-1">{row.name}</span>
            <span className="opacity-70 text-right">{row.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
