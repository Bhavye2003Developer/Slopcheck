const checks = [
  {
    icon: '❌',
    name: 'NONEXISTENT',
    desc: 'Package returns 404 on registry',
    example: 'e.g. crypto-utils',
    color: 'var(--critical)',
  },
  {
    icon: '⚠️',
    name: 'NEWLY REGISTERED',
    desc: 'Created less than 30 days ago',
    example: 'e.g. ml-utils-py',
    color: 'var(--warning)',
  },
  {
    icon: '⚠️',
    name: 'LOW DOWNLOADS',
    desc: 'Below ecosystem download floor',
    example: 'npm <500/mo · PyPI <200/mo',
    color: 'var(--warning)',
  },
  {
    icon: '⚠️',
    name: 'POST-INSTALL SCRIPT',
    desc: 'Script calls curl, wget, or eval',
    example: 'e.g. postinstall: curl | sh',
    color: 'var(--warning)',
  },
  {
    icon: '✅',
    name: 'LEGIT',
    desc: 'Exists, old enough, trusted volume',
    example: 'e.g. numpy, flask, express',
    color: 'var(--clean)',
  },
];

export default function ChecksGrid() {
  return (
    <section id="checks" className="py-16 md:py-24 px-4 md:px-6" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto">
        <p className="text-xs tracking-widest mb-4" style={{ color: 'var(--muted)' }}>[02] WHAT WE CHECK</p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-16">
          FIVE FLAGS.<br />ZERO ACCOUNTS.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ background: 'var(--border)' }}>
          {checks.map((c, i) => (
            <div key={c.name} className={`p-8 flex flex-col gap-3${i === checks.length - 1 && checks.length % 3 !== 0 ? ' lg:col-span-2' : ''}`} style={{ background: 'var(--bg)' }}>
              <span className="text-2xl">{c.icon}</span>
              <span className="text-xs font-bold tracking-widest" style={{ color: c.color }}>{c.name}</span>
              <span className="text-sm" style={{ color: 'var(--fg)' }}>{c.desc}</span>
              <span className="text-xs mt-auto pt-4" style={{ color: 'var(--muted)' }}>{c.example}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
