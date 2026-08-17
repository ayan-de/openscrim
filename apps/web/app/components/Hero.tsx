'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import SloganText from './SloganText';
import PlaygroundModal from './playgroundCards/PlaygroundModal';
import { useRecordingCount } from '@/hooks/useRecordingCount';

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
      <header className="flex-grow flex items-center justify-center text-center px-4 pt-12 pb-12 md:px-6">
        <div className="mb-8 max-w-4xl flex flex-col gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-4 leading-tight drop-shadow-lg">
              Open<span className="text-primary">Scrim</span>
            </h1>
          </div>

          <div>
            <SloganText />
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

            <Link href="/editor" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-2 border-border bg-transparent backdrop-blur-sm text-foreground hover:bg-accent hover:text-accent-foreground hover:border-foreground/70 font-semibold px-6 sm:px-8 md:px-12 py-3 md:py-4 text-base md:text-lg shadow-lg transition-all duration-300 h-12 md:h-14 cursor-pointer"
              >
                Open Editor
              </Button>
            </Link>

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
      </header>

      <PlaygroundModal
        open={open}
        onOpenChange={setOpen}
        onStartRecording={handleConfirmRecording}
      />
    </>
  );
}
