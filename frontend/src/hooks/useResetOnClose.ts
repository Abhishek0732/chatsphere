import { useEffect } from 'react';

/**
 * Run `reset` whenever a modal transitions to closed, so reopening it starts
 * fresh (no stale typed text / selections carried over). Intentionally depends
 * only on `open` — the caller passes a reset that clears its own state.
 */
export function useResetOnClose(open: boolean, reset: () => void) {
  useEffect(() => {
    if (!open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
