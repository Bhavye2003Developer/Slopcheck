const steps = [
  {
    num: '01 /',
    title: 'PASTE',
    lines: ['Drop your package.json or', 'requirements.txt into the box.'],
  },
  {
    num: '02 /',
    title: 'SCAN',
    lines: ['We hit npm + PyPI directly', 'from your browser.', 'No server. No logs.'],
  },
  {
    num: '03 /',
    title: 'REVIEW',
    lines: ['Results ranked by severity.', 'Export or fix.'],
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="py-24 px-6" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto">
        <p className="text-xs tracking-widest mb-4" style={{ color: 'var(--muted)' }}>[03] HOW IT WORKS</p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-16">
          THREE STEPS.<br />TWO SECONDS.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: 'var(--border)' }}>
          {steps.map(s => (
            <div key={s.num} className="px-8 py-10" style={{ background: 'var(--bg)' }}>
              <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{s.num}</p>
              <p className="text-2xl font-bold tracking-tight mb-6">{s.title}</p>
              {s.lines.map((l, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{l}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
