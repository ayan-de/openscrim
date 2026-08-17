'use client';

import Hero from '../components/Hero';
import FeaturesSection from '../components/FeaturesSection';
import LiveDemoSection from '../components/LiveDemoSection';
import PlaygroundSection from '../components/PlaygroundSection';

export default function Home() {
  return (
    <>
      <Hero />
      <LiveDemoSection />
      <FeaturesSection />
      <PlaygroundSection />
    </>
  );
}
