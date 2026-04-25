import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import PkgInspector from '@/components/PkgInspector';

export const metadata: Metadata = {
  title: 'Package Inspector — Slop Check',
  description: 'Look up any npm, PyPI, Cargo, Go, or RubyGems package. See security flags, CVEs, download stats, maintainers, and install command in one card.',
};

export default function PkgPage() {
  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--muted)' }}>PACKAGE INSPECTOR</p>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-8 md:mb-10">
            LOOK UP.<br />AUDIT. DECIDE.
          </h1>
          <PkgInspector />
        </div>
      </main>
      <Footer />
    </>
  );
}
