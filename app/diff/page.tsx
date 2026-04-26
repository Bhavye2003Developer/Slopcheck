import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import DiffScanner from '@/components/scanner/DiffScanner';

export const metadata: Metadata = {
  title: 'Diff Scanner — Hook Check',
  description: 'Compare two dependency manifests and see what was added, removed, or escalated in risk.',
};

export default function DiffPage() {
  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--muted)' }}>DIFF SCANNER</p>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-8 md:mb-10">
            COMPARE.<br />DETECT CHANGES.
          </h1>
          <DiffScanner />
        </div>
      </main>
      <Footer />
    </>
  );
}
