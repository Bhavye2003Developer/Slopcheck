import LiveStats from './LiveStats';

export default function ProblemSection() {
  return (
    <section id="problem" className="py-16 md:py-24 px-4 md:px-6" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 mb-12 md:mb-16">
          <div>
            <p className="text-xs tracking-widest mb-4" style={{ color: 'var(--muted)' }}>[01] PROBLEM</p>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
              THE SLOPSQUATTING<br />THREAT
            </h2>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              Slopsquatting is a documented, active threat. AI models suggest package names that don&apos;t exist —
              threat actors register those names on public registries within hours, load them with malicious install
              scripts, and wait. Slop Check cross-checks every dependency in your manifest against live registry data,
              download history, and the OSV vulnerability database before a single byte executes.
            </p>
          </div>
        </div>

        <LiveStats />
      </div>
    </section>
  );
}
