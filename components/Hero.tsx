'use client';

import ScanReceipt from './ScanReceipt';
import Ticker from './Ticker';

const badges = [
  { label: 'ID/', value: 'SLC-0X1' },
  { label: 'STATUS |', value: 'LIVE' },
  { label: 'PKG-CHECKS/', value: '5' },
  { label: 'LATENCY/', value: '~2S' },
  { label: 'SOURCE/', value: 'NPM x PYPI' },
];

export default function Hero() {
  return (
    <div>
      <section className="relative pt-24 md:pt-32 pb-0 px-4 md:px-6 scanline-overlay overflow-hidden">
        {/* Badge row */}
        <div className="max-w-7xl mx-auto mb-8 md:mb-12 flex flex-wrap gap-4 md:gap-6">
          {badges.map(b => (
            <span key={b.label} className="text-xs" style={{ color: 'var(--muted)' }}>
              <span>{b.label}</span>{' '}
              <span style={{ color: 'var(--fg)' }}>{b.value}</span>
            </span>
          ))}
        </div>

        {/* Headline + receipt */}
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-start pb-12 md:pb-20">
          <div>
            <h1
              className="text-4xl md:text-8xl font-black leading-none mb-6 md:mb-8"
              style={{ color: 'var(--fg)' }}
            >
              THIS IS WHAT AI<br />GAVE YOU. →
            </h1>
            <p className="text-sm leading-relaxed mb-10 max-w-sm" style={{ color: 'var(--muted)' }}>
              AI coding assistants hallucinate package names.<br />
              Attackers register the names. You install the malware.<br />
              Paste your manifest. Find out in 2 seconds.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#scanner"
                className="inline-block px-6 py-3 text-xs font-bold tracking-widest transition-opacity hover:opacity-80"
                style={{ background: 'var(--fg)', color: 'var(--bg)' }}
              >
                SCAN NOW →
              </a>
              <a
                href="https://github.com/Bhavye2003Developer/Slopcheck"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 text-xs font-bold tracking-widest transition-colors"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
              >
                VIEW ON GITHUB [^]
              </a>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <ScanReceipt />
          </div>
        </div>
      </section>

      <Ticker />
    </div>
  );
}
