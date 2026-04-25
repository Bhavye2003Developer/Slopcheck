import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import GithubScanner from '@/components/scanner/GithubScanner';

export const metadata: Metadata = {
  title: 'GitHub Scan — Slop Check',
  description: 'Paste a GitHub repo URL and scan its dependency manifest for hallucinated, malicious, or vulnerable packages.',
};

export default function GithubPage() {
  return (
    <>
      <Nav />
      <main className="pt-24 pb-16 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-widest mb-3" style={{ color: 'var(--muted)' }}>GITHUB SCAN</p>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-8 md:mb-10">
            PASTE URL.<br />SCAN REPO.
          </h1>
          <GithubScanner />
        </div>
      </main>
      <Footer />
    </>
  );
}
