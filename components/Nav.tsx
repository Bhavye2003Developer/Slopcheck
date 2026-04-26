'use client';

import { useEffect, useState, startTransition } from 'react';

const links = [
  { label: '[01] PROBLEM', href: '#problem' },
  { label: '[02] CHECKS', href: '#checks' },
  { label: '[03] HOW', href: '#how' },
  { label: '[04] FAQ', href: '#faq' },
];

const toolLinks = [
  { label: 'PKG', href: '/pkg' },
  { label: 'GH SCAN', href: '/github' },
  { label: 'DIFF', href: '/diff' },
];

interface NetInfo { online: boolean }

function NetworkMeter() {
  const [info, setInfo] = useState<NetInfo | null>(null);

  useEffect(() => {
    function read() {
      startTransition(() => setInfo({ online: navigator.onLine }));
    }
    read();
    window.addEventListener('online', read);
    window.addEventListener('offline', read);
    return () => {
      window.removeEventListener('online', read);
      window.removeEventListener('offline', read);
    };
  }, []);

  if (!info) return null;

  const dotColor = info.online ? 'var(--live)' : 'var(--critical)';

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          boxShadow: info.online ? '0 0 6px var(--live)' : 'none',
          flexShrink: 0,
        }}
      />
      <span className="font-bold" style={{ color: dotColor, letterSpacing: '0.05em' }}>
        {info.online ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      style={{
        borderBottom: scrolled || menuOpen ? '1px solid var(--border)' : 'none',
        background: scrolled || menuOpen ? 'var(--nav-bg)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(8px)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-4">
        {/* Brand + live indicator grouped together */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold tracking-widest" style={{ color: 'var(--fg)' }}>
            HOOKCHECK.
          </span>
          <NetworkMeter />
        </div>

        {/* Desktop links + mobile hamburger */}
        <div className="flex items-center">
          <div className="hidden md:flex items-center gap-6">
            {links.map(l => (
              <a key={l.href} href={l.href} className="text-xs tracking-wider transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                {l.label}
              </a>
            ))}
            <span style={{ color: 'var(--border)', padding: '0 2px' }}>|</span>
            {toolLinks.map(l => (
              <a key={l.href} href={l.href} className="text-xs tracking-wider transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
                {l.label}
              </a>
            ))}
            <a href="https://github.com/Bhavye2003Developer/hookcheck" target="_blank" rel="noopener noreferrer"
              className="text-xs tracking-wider transition-colors ml-2" style={{ color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
              GITHUB →
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-xs tracking-widest p-2"
            style={{ color: 'var(--muted)' }}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen ? '✕ CLOSE' : '☰ MENU'}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t px-4 pb-4 flex flex-col gap-4" style={{ borderColor: 'var(--border)' }}>
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-xs tracking-wider pt-3" style={{ color: 'var(--muted)' }}
              onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
          <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--dim-lo)' }}>TOOLS</p>
            {toolLinks.map(l => (
              <a key={l.href} href={l.href} className="block text-xs tracking-wider mb-3" style={{ color: 'var(--muted)' }}
                onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
          </div>
          <a href="https://github.com/Bhavye2003Developer/hookcheck" target="_blank" rel="noopener noreferrer"
            className="text-xs tracking-wider" style={{ color: 'var(--muted)' }}
            onClick={() => setMenuOpen(false)}>
            GITHUB →
          </a>
        </div>
      )}
    </nav>
  );
}
