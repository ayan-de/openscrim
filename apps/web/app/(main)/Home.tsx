'use client';

import Hero from '../components/Hero';
import PlaygroundCards from '../components/playgroundCards/PlaygroundCards';

export default function Home() {
  return (
    <>
      <Hero />

      {/* Create Playgrounds Section */}
      <section className="py-16 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Create Playgrounds
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Coding playgrounds videos on Tantrica are powered by VS Code IDE
              and start within a few seconds. Practice coding while learning for
              free.
            </p>
          </div>

          <PlaygroundCards />
        </div>
      </section>
    </>
  );
}