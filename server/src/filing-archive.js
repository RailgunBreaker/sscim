import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { filingParagraphs } from './loss-filing-monitor.js';

const directory = fileURLToPath(new URL('../../artifacts/collected/filing-audit/', import.meta.url));
const sha256 = body => createHash('sha256').update(body).digest('hex');
export function archiveFiling(body, target = directory) {
  const sourceSha256 = sha256(body);
  mkdirSync(target, { recursive: true });
  const path = join(target, `${sourceSha256}.html`);
  if (!existsSync(path)) writeFileSync(path, body, { encoding: 'utf8', flag: 'wx' });
  return { sourceSha256, hashBasis: 'utf8_decoded_text', archiveKind: 'filing_audit_v1' };
}
export function readArchivedFiling(hash, target = directory) {
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid archive fingerprint.');
  const body = readFileSync(join(target, `${hash}.html`), 'utf8');
  if (sha256(body) !== hash) throw new Error('Archived source failed integrity verification.');
  // Never serve active third-party HTML in the authenticated application.
  return { sourceSha256: hash, text: filingParagraphs(body).join('\n\n'), view: 'normalized_visible_text_v1' };
}
