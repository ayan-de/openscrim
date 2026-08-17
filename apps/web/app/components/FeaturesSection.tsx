import {
  Rewind,
  GitFork,
  FileArchive,
  Share2,
  Sparkles,
  Code2,
  type LucideIcon,
} from 'lucide-react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Code2,
    title: 'DOM-level capture',
    description:
      'Every keystroke, cursor move, selection, and edit is recorded as a structured, timestamped event — not a pixel video.',
  },
  {
    icon: Rewind,
    title: 'Scrub like a video',
    description:
      'Seek, pause, and change playback speed through a real coding session, frame by frame, just like a video player.',
  },
  {
    icon: GitFork,
    title: 'Fork any moment',
    description:
      'Branch a playback at any timestamp into a live, editable Monaco session — practice from exactly where the recording left off.',
  },
  {
    icon: Sparkles,
    title: 'Built for AI tutors',
    description:
      "Structured event data — not pixels — means AI tools can read, summarize, and coach on exactly what changed and why.",
  },
  {
    icon: FileArchive,
    title: 'Tiny, portable .scrim files',
    description:
      'Delta-encoded and gzip-compressed. Full sessions weigh kilobytes, not the megabytes a screen recording would take.',
  },
  {
    icon: Share2,
    title: 'Share & embed anywhere',
    description:
      'Publish a public link, or drop the React SDK’s ScrimPlayer straight into your own docs, blog, or app.',
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

        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group relative rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6 transition-all duration-300 hover:border-primary/50 hover:bg-card"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-card-foreground mb-2">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
