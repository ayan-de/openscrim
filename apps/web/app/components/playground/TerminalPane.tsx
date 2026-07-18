'use client';

/**
 * Placeholder for rdamn's xterm terminal. The real one is driven by a
 * node-pty WebSocket from a playground container; until OpenScrim has a
 * server-side playground runtime this pane preserves the layout only.
 */
export default function TerminalPane() {
  return (
    <div className="w-full h-full bg-black text-white/80 font-mono text-sm p-3 overflow-hidden">
      <p>
        <span className="text-green-400">rdamn@openscrim</span>
        <span className="text-white/50">:</span>
        <span className="text-blue-400">~/code</span>
        <span className="text-white/50">$ </span>
        <span className="animate-pulse">▊</span>
      </p>
      <p className="mt-3 text-white/40">
        Terminal requires a connected playground container — coming in a later
        phase.
      </p>
    </div>
  );
}
