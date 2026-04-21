import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import ScannerSection from '@/components/ScannerSection';
import ProblemSection from '@/components/ProblemSection';
import ChecksGrid from '@/components/ChecksGrid';
import HowItWorks from '@/components/HowItWorks';
import Faq from '@/components/Faq';
import Footer from '@/components/Footer';
import AnimatedSection from '@/components/AnimatedSection';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <AnimatedSection><ScannerSection /></AnimatedSection>
        <AnimatedSection><ProblemSection /></AnimatedSection>
        <AnimatedSection><ChecksGrid /></AnimatedSection>
        <AnimatedSection><HowItWorks /></AnimatedSection>
        <AnimatedSection><Faq /></AnimatedSection>
      </main>
      <Footer />
    </>
  );
}
