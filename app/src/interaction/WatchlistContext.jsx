import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normalizeList, toggleEntry, removeEntry, isWatched, MAX_WATCHED } from './watchlist.js';

/* ====================================================================
   The watchlist's storage half. The rules live in watchlist.js (pure,
   tested); this is only where the list is kept and how it survives a
   reload.

   localStorage, not the URL hash: a watchlist is a standing personal
   preference, not a shareable view of the data. Putting it in the hash
   would mean every link a reader shares carries their supplier list with
   it, which is both noisy and, for anyone tracking their own supply base,
   a disclosure they did not intend to make.

   Storage is best-effort throughout. Private-mode Safari throws on write,
   a full quota throws on write, and a corrupted value throws on read —
   none of which is a reason for the dashboard to fail to start, so every
   path falls back to an empty list and the feature simply forgets.
   ==================================================================== */

const STORAGE_KEY = 'sscim.watchlist.v1';

const WatchlistCtx = createContext(null);

function load() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function WatchlistProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { /* quota or private mode — the list stays for this session only */ }
  }, [items]);

  const toggle = useCallback((entry) => setItems((cur) => toggleEntry(cur, entry)), []);
  const remove = useCallback((entry) => setItems((cur) => removeEntry(cur, entry)), []);
  const clearAll = useCallback(() => setItems([]), []);
  const watching = useCallback((entry) => isWatched(items, entry), [items]);

  const value = useMemo(
    () => ({ items, toggle, remove, clearAll, watching, full: items.length >= MAX_WATCHED }),
    [items, toggle, remove, clearAll, watching],
  );
  return <WatchlistCtx.Provider value={value}>{children}</WatchlistCtx.Provider>;
}

export function useWatchlist() {
  const ctx = useContext(WatchlistCtx);
  if (!ctx) throw new Error('useWatchlist() must be called inside <WatchlistProvider>');
  return ctx;
}
