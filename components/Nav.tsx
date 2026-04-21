'use client';

import { useEffect, useState } from 'react';

const links = [
  { label: '[01] PROBLEM', href: '#problem' },
  { label: '[02] CHECKS', href: '#checks' },
  { label: '[03] HOW', href: '#how' },
  { label: '[04] FAQ', href: '#faq' },
];

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
        background: scrolled || menuOpen ? 'rgba(10,10,10,0.97)' : 'transparent',
        backdropFilter: scrolled || menuOpen ? 'blur(8px)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
        <span className="text-sm font-bold tracking-widest" style={{ color: 'var(--fg)' }}>
          SLOPCHECK.
        </span>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-xs tracking-wider transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
              {l.label}
            </a>
          ))}
          <a href="https://github.com/Bhavye2003Developer/Slopcheck" target="_blank" rel="noopener noreferrer"
            className="text-xs tracking-wider transition-colors" style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}>
            GITHUB {'->'}
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

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t px-4 pb-4 flex flex-col gap-4" style={{ borderColor: 'var(--border)' }}>
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-xs tracking-wider pt-3" style={{ color: 'var(--muted)' }}
              onClick={() => setMenuOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="https://github.com/Bhavye2003Developer/Slopcheck" target="_blank" rel="noopener noreferrer"
            className="text-xs tracking-wider" style={{ color: 'var(--muted)' }}
            onClick={() => setMenuOpen(false)}>
            GITHUB {'->'}
          </a>
        </div>
      )}
    </nav>
  );
}
