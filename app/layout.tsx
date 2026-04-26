import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://hookcheck.dev'),
  title: "Hook Check - Scan dependency manifests for malicious packages and install hooks",
  description:
    "Paste a package.json or requirements.txt. Hook Check audits every package for suspicious install scripts, typosquats, newly registered packages, low downloads, and known CVEs — entirely in your browser.",
  keywords: ['dependency scanner', 'supply chain security', 'npm audit', 'malicious packages', 'install hook scanner', 'CVE scanner', 'package security'],
  openGraph: {
    type: 'website',
    url: 'https://hookcheck.dev',
    title: 'Hook Check — Scan dependency manifests for malicious packages and install hooks',
    description:
      'Paste any dependency manifest. Hook Check audits every package for suspicious install scripts, typosquats, malicious hooks, and known CVEs — entirely in your browser.',
    siteName: 'Hook Check',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hook Check — Scan dependency manifests for malicious packages and install hooks',
    description:
      'Paste any dependency manifest. Hook Check audits every package for suspicious install scripts, typosquats, malicious hooks, and known CVEs — entirely in your browser.',
  },
  verification: {
    google: '-OdPoSk_I5iBT_FYTWcE3w1tL1E-FubgUHX6mELy5to',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
