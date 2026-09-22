import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const execute = promisify(execFile);
const userAgent = 'SSCIM public-source research alansong0318@outlook.com';

export function issuerReleaseSectionHash(bytes, issuer) {
  const text = bytes.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!['wdc', 'kioxia'].includes(issuer)) throw new Error('Unsupported issuer release layout');
  const start = text.indexOf(issuer === 'wdc' ? 'SAN JOSE' : 'Kioxia Corporation announced today');
  const end = text.indexOf(issuer === 'wdc' ? 'About Western Digital' : 'Share', start);
  if (start < 0 || end <= start) throw new Error('Issuer release section boundaries not found');
  return createHash('sha256').update(text.slice(start, end)).digest('hex');
}

// These issuer CDNs reject or time out with Node's HTTP client in the collection environment.
// Use the available Python standard-library client; keep the same byte-review rules.
export async function fetchPublicDocument(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Public sources require HTTPS');
  // This issuer works with Windows' certificate store via curl; Node times out
  // and Python's separate certificate store rejects the presented chain.
  if (process.platform === 'win32' && parsed.hostname === 'www.apacer.com' && parsed.pathname.toLowerCase().endsWith('.pdf')) {
    const { stdout } = await execute('curl.exe', ['--fail', '--silent', '--show-error', '--max-time', '25',
      '--proto', '=https', '--user-agent', userAgent, '--url', url],
      { encoding: 'buffer', timeout: 30000, maxBuffer: 20 * 1024 * 1024, windowsHide: true });
    if (stdout.subarray(0, 5).toString() !== '%PDF-') throw new Error('Apacer source did not return a PDF');
    return { bytes: stdout, finalUrl: url, contentType: 'application/pdf' };
  }
  if (['www.westerndigital.com', 'pr.tsmc.com', 'investor.tsmc.com'].includes(parsed.hostname)) {
    const script = `import sys,urllib.request,gzip,json,base64
r=urllib.request.urlopen(urllib.request.Request(sys.argv[1],headers={'User-Agent':sys.argv[2]}),timeout=20)
b=r.read()
if b[:2]==b'\\x1f\\x8b': b=gzip.decompress(b)
print(json.dumps({'body':base64.b64encode(b).decode('ascii'),'url':r.url,'contentType':r.headers.get('Content-Type','')}))`;
    const { stdout } = await execute('python', ['-c', script, url, userAgent], { timeout: 25000, maxBuffer: 20 * 1024 * 1024, windowsHide: true });
    const result = JSON.parse(stdout);
    return { bytes: Buffer.from(result.body, 'base64'), finalUrl: result.url, contentType: result.contentType };
  }
  const response = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), finalUrl: response.url, contentType: response.headers.get('content-type') || '' };
}
