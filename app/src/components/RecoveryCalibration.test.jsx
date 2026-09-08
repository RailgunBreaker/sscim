import { it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import RecoveryCalibration from './RecoveryCalibration.jsx';
const report = JSON.parse(readFileSync(new URL('../../../docs/benchmarks/recovery-calibration.json', import.meta.url), 'utf8'));
it('shows the issuer comparison and separates parameter uncertainty from prediction coverage', () => {
  const html = renderToStaticMarkup(<RecoveryCalibration report={report} />);
  expect(html).toContain('issuer target error was 2.0');
  expect(html).toContain('versus 10.0');
  expect(html).toContain('not a recovery prediction interval');
  expect(html).toContain('Global model defaults remain assumptions');
  expect(html).toContain('reconstructed after the outcomes were known');
  expect(html).toContain('not established an advantage over simple baselines');
});
it('handles an absent or explicitly withdrawn report', () => {
  expect(renderToStaticMarkup(<RecoveryCalibration />)).toBe('');
  expect(renderToStaticMarkup(<RecoveryCalibration report={{}} />)).toBe('');
});
