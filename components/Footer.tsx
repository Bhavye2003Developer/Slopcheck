'use client';

export default function Footer() {
  return (
    <footer
      className="py-10 md:py-12 px-4 md:px-6 mt-auto"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6">
        <div className="text-xs leading-loose" style={{ color: 'var(--muted)' }}>
          <p>HOOKCHECK | FREE | OPEN SOURCE | MIT LICENSE</p>
          <p>NO ACCOUNT | NO SERVER | NO TRACKING</p>
        </div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          <a
            href="https://github.com/Bhavye2003Developer/hookcheck"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          >
            GITHUB →
          </a>
        </div>
      </div>
    </footer>
  );
}
