export type ViewerMode = 'playback' | 'fork';

export interface Fork {
  id: string;
  recordingId: string;
  timestamp: number;
  content: string;
  language: string;
  cursor: {
    lineNumber: number;
    column: number;
  };
  edits: string;
  createdAt: number;
  updatedAt: number;
  /** Multi-file forks: path → edited content. `edits`/`cursor` describe `activePath`. */
  files?: Record<string, string>;
  activePath?: string;
}
