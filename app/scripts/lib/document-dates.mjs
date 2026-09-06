import { execFileSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';

// Checkout timestamps are build times, not document modification times.
export function documentDates(repoDir) {
  const git = (args) => execFileSync('git', args, { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  let changed = new Set();
  try { changed = new Set(git(['diff', '--name-only', '-z', 'HEAD', '--']).split('\0')); } catch { /* Source archive without Git. */ }
  return async (relative) => {
    if (!changed.has(relative)) {
      try {
        const committed = git(['log', '-1', '--format=%cI', '--', relative]);
        if (committed) return new Date(committed).toISOString();
      } catch { /* Untracked file or source archive: use the source file date. */ }
    }
    return (await stat(path.join(repoDir, relative))).mtime.toISOString();
  };
}
