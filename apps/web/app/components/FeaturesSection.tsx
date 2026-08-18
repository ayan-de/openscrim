import { Check, X } from 'lucide-react';

interface Row {
  label: string;
  scrim: string;
  video: string;
  scrimGood: boolean;
}

const ROWS: Row[] = [
  {
    label: '1 hr video, file size',
    scrim: '~1 MB',
    video: '1–2 GB depending on quality',
    scrimGood: true,
  },
  {
    label: 'On a 2G connection',
    scrim: 'Same quality, every time',
    video: 'Quality degrades to stay watchable',
    scrimGood: true,
  },
  {
    label: 'Loading & playback',
    scrim: 'No buffering — events stream in instantly',
    video: 'Buffering happens, especially on slow networks',
    scrimGood: true,
  },
  {
    label: 'Interaction',
    scrim: 'Interactive — toggle between video and editor without leaving the page',
    video: 'Watch only, 100× context switches to keep coding',
    scrimGood: true,
  },
  {
    label: 'Teacher vs. student',
    scrim: 'Same codebase — what they saw is what you can edit',
    video: 'Two codebases — yours and the one they recorded',
    scrimGood: true,
  },
  {
    label: 'Time spent',
    scrim: 'Less time wasted on context switching',
    video: 'More time wasted rewinding and retyping',
    scrimGood: true,
  },
  {
    label: 'Sharing one session',
    scrim: 'Drop a link, done',
    video: 'Upload, wait, share, hope the format works',
    scrimGood: true,
  },
  {
    label: 'Whole playlist (100 lessons)',
    scrim: '~100 MB',
    video: 'Up to ~20 GB depending on quality',
    scrimGood: true,
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-16 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
            Not a screen recording. A data structure.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            OpenScrim captures the DOM, not the display — which is what makes
            playback scrubbable, forkable, and small enough to embed
            anywhere.
          </p>
        </div>

        <div className="w-full max-w-5xl mx-auto">
          <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1.1fr_1.4fr_1.4fr] sm:grid-cols-[1fr_1.3fr_1.3fr] items-center bg-muted/40 border-b border-border">
              <div className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                What you care about
              </div>
              <div className="px-4 sm:px-6 py-4 text-sm sm:text-base font-semibold text-primary flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3 w-3" />
                </span>
                OpenScrim
              </div>
              <div className="px-4 sm:px-6 py-4 text-sm sm:text-base font-semibold text-muted-foreground flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <X className="h-3 w-3" />
                </span>
                Screen recording
              </div>
            </div>

            {/* Body rows */}
            {ROWS.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1.1fr_1.4fr_1.4fr] sm:grid-cols-[1fr_1.3fr_1.3fr] items-center ${
                  i !== ROWS.length - 1 ? 'border-b border-border/60' : ''
                } hover:bg-muted/20 transition-colors`}
              >
                <div className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-medium text-foreground">
                  {row.label}
                </div>
                <div className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-foreground">
                  <span className="inline-flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{row.scrim}</span>
                  </span>
                </div>
                <div className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-muted-foreground">
                  <span className="inline-flex items-start gap-2">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                    <span>{row.video}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
