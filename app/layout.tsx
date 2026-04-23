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
    "Paste a package.json or requirements.txt. Slop Check hits npm and PyPI directly from your browser and returns a risk-ranked report in seconds.",
  verification: {
    google: ['R5nqWVB34piX3YudumT-Jp24Rzi8aJ5ISOUsyP8Njcw', '-OdPoSk_I5iBT_FYTWcE3w1tL1E-FubgUHX6mELy5to'],
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
