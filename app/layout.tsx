import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://slopcheck.com'),
  title: "Slop Check - Scan AI-generated manifests for hallucinated packages",
  description:
    "Paste a package.json or requirements.txt. Slop Check audits every package for hallucinated names, typosquats, malicious install scripts, and known CVEs — entirely in your browser.",
  keywords: ['dependency scanner', 'slopsquatting', 'supply chain security', 'npm audit', 'hallucinated packages', 'AI security', 'CVE scanner'],
  openGraph: {
    type: 'website',
    url: 'https://slopcheck.com',
    title: 'Slop Check — Scan AI-generated manifests for hallucinated packages',
    description:
      'Paste any dependency manifest. Slop Check audits every package for hallucinated names, typosquats, malicious scripts, and known CVEs — entirely in your browser.',
    siteName: 'Slop Check',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Slop Check — Scan AI-generated manifests for hallucinated packages',
    description:
      'Paste any dependency manifest. Slop Check audits every package for hallucinated names, typosquats, malicious scripts, and known CVEs — entirely in your browser.',
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
