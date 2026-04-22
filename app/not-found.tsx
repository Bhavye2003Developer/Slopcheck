import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'var(--bg)', fontFamily: 'var(--font-mono)' }}
    >
      <p className="text-xs tracking-widest mb-8" style={{ color: '#333' }}>
        STATUS / <span style={{ color: '#555' }}>404</span>
      </p>
      <h1
        className="text-6xl md:text-8xl font-black leading-none mb-4"
        style={{ color: 'var(--fg)' }}
      >
        NOT FOUND
      </h1>
      <p className="text-sm mb-12 text-center" style={{ color: 'var(--muted)', maxWidth: 360 }}>
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <div className="flex flex-wrap gap-4 justify-center">
        <Link
          href="/"
          className="inline-block px-6 py-3 text-xs font-bold tracking-widest transition-opacity hover:opacity-80"
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          GO HOME →
        </Link>
        <Link
          href="/#scanner"
          className="inline-block px-6 py-3 text-xs font-bold tracking-widest"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          SCAN YOUR DEPS →
        </Link>
      </div>
    </div>
  );
}
