const stats = [
  { value: '19.7%', label: "of AI pkgs\ndon't exist" },
  { value: '~20MIN', label: 'to register\na fake name' },
  { value: '30,000+', label: 'downloads\nhuggingface-cli\ngot before takedown' },
];

export default function ProblemSection() {
  return (
    <section id="problem" className="py-24 px-6" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 mb-16">
          <div>
            <p className="text-xs tracking-widest mb-4" style={{ color: 'var(--muted)' }}>[01] PROBLEM</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
              THE SLOPSQUATTING<br />THREAT
            </h2>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              AI coding assistants hallucinate package names at a rate of ~20% across all models.
              Attackers monitor these hallucinations, register the invented names on npm and PyPI, and wait.
              Every <span style={{ color: 'var(--fg)' }}>`npm install`</span> from an AI-generated file is a potential supply chain attack.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: 'var(--border)' }}>
          {stats.map(s => (
            <div key={s.value} className="px-8 py-10" style={{ background: 'var(--bg)' }}>
              <div className="text-5xl font-bold mb-3 tracking-tight" style={{ color: 'var(--warning)' }}>
                {s.value}
              </div>
              <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--muted)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
