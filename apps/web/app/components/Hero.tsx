'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, GitFork, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import SloganText from './SloganText';
import PlaygroundModal from './playgroundCards/PlaygroundModal';
import Grainient from './Grainient';
import Navbar from './Navbar';
import { useRecordingCount } from '@/hooks/useRecordingCount';

const TRUST_CHIPS = [
  { icon: Film, label: 'Scrub like a video' },
  { icon: GitFork, label: 'Fork any moment' },
  { icon: Sparkles, label: 'Structured, AI-readable data' },
];

export default function Hero() {
  const recordingCount = useRecordingCount();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleStartRecording = () => {
    setOpen(true);
  };

  const handleConfirmRecording = (title: string) => {
    const params = new URLSearchParams({ title });
    router.push(`/record?${params.toString()}`);
  };

  return (
    <>
      <header className="relative z-0 flex-grow flex flex-col overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 bottom-0 -z-20"
          style={{
            left: 'var(--content-offset)',
            right: 'var(--content-offset)',
          }}
        >
          <Grainient
            color1="var(--grainient-1)"
            color2="var(--grainient-2)"
            color3="var(--grainient-3)"
            timeSpeed={0.25}
            colorBalance={0}
            warpStrength={1}
            warpFrequency={5}
            warpSpeed={2}
            warpAmplitude={50}
            blendAngle={0}
            blendSoftness={0.05}
            rotationAmount={500}
            noiseScale={2}
            grainAmount={0.1}
            grainScale={2}
            grainAnimated={false}
            contrast={1.5}
            gamma={1}
            saturation={1}
            centerX={0}
            centerY={0}
            zoom={0.9}
          />
        </div>
        <div
          aria-hidden
          className="hero-grid absolute top-0 bottom-0 -z-10"
          style={{
            left: 'var(--content-offset)',
            right: 'var(--content-offset)',
          }}
        />

        <Navbar mainText="OpenScrim" />

        <div className="flex-1 flex items-center justify-center text-center px-4 pt-8 pb-16 md:px-6">
          <div className="mb-8 max-w-4xl flex flex-col items-center gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur-sm px-4 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Open source · DOM-level session recorder
            </div>

            <div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 leading-[1.1] tracking-tight text-foreground">
                Open<span className="text-primary">Scrim</span>
              </h1>
            </div>

            <div>
              <SloganText />
            </div>

            {/* Trust chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {TRUST_CHIPS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/40 px-3 py-1 text-xs sm:text-sm text-muted-foreground"
                >
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {label}
                </span>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mt-6 md:mt-8 px-4">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-6 sm:px-8 md:px-12 py-3 md:py-4 text-base md:text-lg shadow-lg hover:shadow-xl transition-all duration-300 border-0 h-12 md:h-14 cursor-pointer"
                onClick={handleStartRecording}
              >
                Start Recording
              </Button>
              {/* 
            <Link href="/editor" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-2 border-border bg-transparent backdrop-blur-sm text-foreground hover:bg-accent hover:text-accent-foreground hover:border-foreground/70 font-semibold px-6 sm:px-8 md:px-12 py-3 md:py-4 text-base md:text-lg shadow-lg transition-all duration-300 h-12 md:h-14 cursor-pointer"
              >
                Open Editor
              </Button>
            </Link> */}

              <Link href="/view" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto border-2 border-border bg-transparent backdrop-blur-sm text-foreground hover:bg-accent hover:text-accent-foreground hover:border-foreground/70 font-semibold px-6 sm:px-8 md:px-12 py-3 md:py-4 text-base md:text-lg shadow-lg transition-all duration-300 h-12 md:h-14 cursor-pointer"
                >
                  <span className="hidden sm:inline">View Recordings</span>
                  <span className="sm:hidden">
                    View ({recordingCount > 0 ? recordingCount : 0})
                  </span>
                  <span className="hidden sm:inline">
                    {recordingCount > 0 && ` (${recordingCount})`}
                  </span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <PlaygroundModal
        open={open}
        onOpenChange={setOpen}
        onStartRecording={handleConfirmRecording}
      />
    </>
  );
}
