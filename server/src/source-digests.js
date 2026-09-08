import { createHash } from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function sourceDigestStatus(bytes,prior) {
  const sha256=hash(bytes),textSha256=hash(bytes.toString('utf8'));
  const baselineSha256=prior?.baselineSha256||prior?.sha256||sha256;
  // Older collectors hashed decoded UTF-8 text. Compare like with like, without
  // silently resetting a changed baseline or confusing a byte-format migration
  // with a publication revision.
  const baselineHashBasis=prior?.baselineHashBasis || (!prior || baselineSha256===sha256?'raw_bytes':baselineSha256===textSha256?'utf8_decoded_text':'legacy_unspecified');
  const changed=baselineHashBasis==='raw_bytes'?baselineSha256!==sha256:
    baselineHashBasis==='utf8_decoded_text'?baselineSha256!==textSha256:
    baselineSha256!==sha256 && baselineSha256!==textSha256;
  return {sha256,hashBasis:'raw_bytes',baselineSha256,baselineHashBasis,
    contentChangedSinceBaseline:changed,reviewRequired:changed};
}
