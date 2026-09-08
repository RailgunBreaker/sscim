import { it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import { sourceDigestStatus } from '../../../server/src/source-digests.js';
it('distinguishes legacy decoded-text hashes from byte changes without resetting baselines',()=>{
  const bytes=Buffer.from([60,112,62,233,60,47,112,62]);
  const old=createHash('sha256').update(bytes.toString('utf8')).digest('hex');
  const migrated=sourceDigestStatus(bytes,{baselineSha256:old});
  expect(migrated).toMatchObject({baselineSha256:old,baselineHashBasis:'utf8_decoded_text',reviewRequired:false});
  const changed=sourceDigestStatus(Buffer.from('different content'),migrated);
  expect(changed).toMatchObject({baselineSha256:old,reviewRequired:true});
  expect(sourceDigestStatus(bytes,sourceDigestStatus(bytes))).toMatchObject({reviewRequired:false,baselineHashBasis:'raw_bytes'});
});
