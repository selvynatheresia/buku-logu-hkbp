export interface HymnsFingerprint {
  content_version: number;
  hash: string;
}
export function computeFingerprint(): HymnsFingerprint;
export function readRecorded(): HymnsFingerprint | null;
