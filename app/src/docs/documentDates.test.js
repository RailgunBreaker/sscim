// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { documentDates } from '../../scripts/lib/document-dates.mjs';

const repo = mkdtempSync(path.join(tmpdir(), 'sscim-doc-dates-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe', env: {
  ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_AUTHOR_DATE: '2026-08-01T12:00:00Z', GIT_COMMITTER_DATE: '2026-08-01T12:00:00Z',
} });
git('init');
writeFileSync(path.join(repo, 'guide with spaces.md'), '# Guide');
git('add', '.');
git('-c', 'commit.gpgsign=false', 'commit', '-m', 'Add guide');
afterAll(() => {
  if (path.dirname(repo) !== path.resolve(tmpdir()) || !path.basename(repo).startsWith('sscim-doc-dates-')) throw new Error('Unexpected test directory');
  rmSync(repo, { recursive: true, force: true });
});

describe('document modification dates', () => {
  it('uses the file commit date even when checkout timestamps are newer', async () => {
    utimesSync(path.join(repo, 'guide with spaces.md'), new Date(), new Date());
    expect(await documentDates(repo)('guide with spaces.md')).toBe('2026-08-01T12:00:00.000Z');
  });
  it('uses source modification time for an uncommitted edit', async () => {
    writeFileSync(path.join(repo, 'guide with spaces.md'), '# Updated guide');
    const date = new Date('2026-09-06T12:00:00Z');
    utimesSync(path.join(repo, 'guide with spaces.md'), date, date);
    expect(await documentDates(repo)('guide with spaces.md')).toBe(date.toISOString());
  });
  it('supplies dates for documents that have not been committed yet', async () => {
    const file = path.join(repo, 'new.md');
    writeFileSync(file, '# New document');
    const date = new Date('2026-09-05T12:00:00Z');
    utimesSync(file, date, date);
    expect(await documentDates(repo)('new.md')).toBe(date.toISOString());
  });
});
