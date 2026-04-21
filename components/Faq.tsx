'use client';

import { useState } from 'react';

const faqs = [
  {
    q: 'DOES THIS SEND MY FILE ANYWHERE?',
    a: 'No. Your manifest never leaves your browser. We query npm and PyPI registries directly from your machine using their public APIs. No server, no logs, no telemetry.',
  },
  {
    q: 'WHAT FILE FORMATS ARE SUPPORTED?',
    a: 'package.json (npm), requirements.txt, pyproject.toml (PyPI), Gemfile (RubyGems), go.mod (Go), and Cargo.toml (Rust). Registry checks are live for npm and PyPI. Others are parsed but marked as coming soon.',
  },
  {
    q: 'HOW IS THE DOWNLOAD THRESHOLD DETERMINED?',
    a: 'npm: packages below 500 downloads/month are flagged. PyPI: below 200/month. These thresholds reflect the floor below which a package is statistically unlikely to be a legitimate dependency.',
  },
  {
    q: 'CAN THIS CATCH MALICIOUS PACKAGES THAT DO EXIST?',
    a: 'Partially. We flag suspicious post-install scripts (curl, wget, eval) in npm packages. We do not scan source code or compare against CVE databases - that\'s out of scope for v1.',
  },
  {
    q: 'IS THIS OPEN SOURCE?',
    a: 'Yes. MIT license. Source on GitHub. PRs welcome.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 md:py-24 px-4 md:px-6" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-7xl mx-auto">
        <p className="text-xs tracking-widest mb-4" style={{ color: 'var(--muted)' }}>[04] FAQ</p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-16">
          COMMON<br />QUESTIONS.
        </h2>

        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {faqs.map((faq, i) => (
            <div key={i}>
              <button
                className="w-full text-left py-6 flex justify-between items-center gap-4 text-xs tracking-widest transition-colors"
                style={{ color: open === i ? 'var(--fg)' : 'var(--muted)' }}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {faq.q}
                <span className="shrink-0 text-base">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && (
                <p className="pb-6 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
