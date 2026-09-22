import { it, expect } from 'vitest';
import { issuerReleaseSectionHash, fetchPublicDocument } from '../../../server/src/public-source-document.js';
const page = (value, nonce) => Buffer.from(`<script>nonce=${nonce}</script><header>${nonce}</header><article>SAN JOSE <p>Example output forecast: ${value} units.</p>About Western Digital</article><footer>${nonce}</footer>`);
it('ignores changing page decorations but detects a changed number in the reviewed release',()=>{
  expect(issuerReleaseSectionHash(page(7,'a'),'wdc')).toBe(issuerReleaseSectionHash(page(7,'b'),'wdc'));
  expect(issuerReleaseSectionHash(page(7,'a'),'wdc')).not.toBe(issuerReleaseSectionHash(page(8,'a'),'wdc'));
});
it('fails closed when issuer section boundaries disappear',()=>{
  expect(()=>issuerReleaseSectionHash(Buffer.from('<p>Temporarily unavailable</p>'),'wdc')).toThrow();
  expect(()=>issuerReleaseSectionHash(page(7,'a'),'unsupported')).toThrow();
  expect(()=>issuerReleaseSectionHash(Buffer.from('Kioxia Corporation announced today example text'),'kioxia')).toThrow();
});
it('rejects non-HTTPS input before attempting a download',async()=>{
  await expect(fetchPublicDocument('file:///private.txt')).rejects.toThrow('HTTPS');
});
