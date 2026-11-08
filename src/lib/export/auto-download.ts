/**
 * "Generate report" for a person downloads that person's PowerPoint as soon
 * as it is ready. The request lives in memory only: it is consumed by the
 * account shell once the matching version finishes preparing.
 */

export interface AutoDownloadRequest {
  avatarId: string;
  /** Name or role shown in the progress message. */
  label: string;
  /** Toast that shows the progress. */
  toastId: string;
}

let current: AutoDownloadRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const autoDownload = {
  get: () => current,
  request(r: AutoDownloadRequest) {
    current = r;
    emit();
  },
  clear() {
    current = null;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
