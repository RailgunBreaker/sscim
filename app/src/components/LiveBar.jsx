import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { riskColor } from '../utils/colors.js';
import Spark from './Spark.jsx';

/* ====================================================================
   LiveBar — the status strip. What you are looking at, and how far it is
   from the live reading.

   Replaces the old scenario bar. The dashboard no longer authors what-ifs:
   preset scenarios, the draft composer, the builder modal and propagation
   playback are gone. What is left is a live read of the vault, an optional
   review of a past date, and one bounded hypothesis — a hazard you place
   on the map yourself.

   Those three states are visually distinct on purpose, because the worst
   failure mode of a dashboard like this is a reader quoting a hypothetical
   number as an observed one. Live is quiet; a reviewed date is copper; an
   applied hazard is amber with the word HAZARD in it and a one-click exit.

   AND THE FOURTH THING THE LABEL HAS TO SAY: where the data came from.
   This strip said "● LIVE" whenever no hazard and no history review were
   active — including on the GitHub Pages deploy, which has no API to
   reach and is reading the static snapshot that shipped with the build.
   A static site asserting "LIVE" is the same class of misrepresentation
   as a hypothesis quoted as an observation, so the two sources are now
   distinguished:

     live vault      the API answered; the reading updates when it does
     static snapshot the API is unreachable; this is the dataset frozen
                     into the build, with its own date shown

   The static state is informative, not alarming — the fallback works, the
   figures are real, and the only thing that is untrue is the word "live".
   History review stays a separate label from both, because reviewing a
   past date is a different claim from where today's data came from.

   The current-value readout uses model.activeChainIndex (which includes any
   hazard), and states the baseline separately whenever the two differ. The
   sparkline stays baseline history: neither a hypothesis nor a review of
   the past rewrites the record.
   ==================================================================== */

export default function LiveBar({ model, whatChanged, hazard, onClearHazard, source }) {
  const { history, baselineChainIndex, activeChainIndex, chainIndexDelta, scenarioActive, reviewing, eventsInWindow } = model;
  const prev7 = history[history.length - 8];
  const baselineDelta7d = baselineChainIndex - prev7;
  const isStatic = source === 'static';

  const tone = scenarioActive ? { bg: C.panel2, border: C.amber, text: C.amber, label: 'Hazard applied' }
    : reviewing ? { bg: C.panel2, border: C.copperDim, text: C.copper, label: 'History review' }
      : isStatic ? { bg: C.panel2, border: C.line, text: C.dim, label: 'Static snapshot' }
        : { bg: C.panel2, border: C.line, text: C.dim, label: 'Live vault' };

  const sourceNote = isStatic
    ? `Static snapshot — the vault API is not reachable from here, so this is the dataset frozen into the build (data as of ${model.datasetAsOf}). These research scores use incomplete evidence and assumed coefficients; they update when the site is rebuilt.`
    : `Live vault — figures are read from the vault API (data as of ${model.datasetAsOf}).`;

  /* HIERARCHY. This row answers, in order: what is the current reading,
     what moved it, and where the numbers came from. It used to answer them
     in the opposite order and at the opposite sizes — the source badge
     shouted at 9px in caps, "WHAT CHANGED" was set in copper, and the index
     itself sat last on the right at 15px. The number a reader came for is
     now first and largest; the provenance is a quiet badge. */
  return (
    <div style={{
      background: tone.bg, borderBottom: `1px solid ${tone.border}`,
      padding: '20px 24px', color: tone.text, lineHeight: 1.45,
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      {/* 1 — the current result, and what KIND of reading it is */}
      {/* WRAPS RATHER THAN OVERFLOWS. This group was flexShrink: 0, so it held
          its max-content width whatever the viewport. That was invisible while
          the label read "Chain index"; renaming it "Research chain index" took
          the group to 387px, wider than the 327px a 375px screen leaves after
          this row's 24px padding, and the whole page gained 36px of horizontal
          scroll. Wrapping is the fix rather than shrinking: the 32px reading is
          the number the reader came for and must never be compressed, so the
          group keeps its intrinsic sizing and simply takes a second line when
          one will not do. Above ~435px nothing moves — group 2 grows into the
          free space, so this one is never squeezed. */}
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        <span style={{ fontSize: 12, color: C.faint }}>
          {t(reviewing || scenarioActive ? tone.label : 'Research chain index')}
        </span>
        <b className="mono" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.1, color: riskColor(activeChainIndex) }}>
          {activeChainIndex.toFixed(2)}
        </b>
        {scenarioActive ? (
          <span className="mono" style={{ fontSize: 13, color: C.amber }}>
            {chainIndexDelta >= 0 ? '+' : ''}{chainIndexDelta.toFixed(2)} vs {baselineChainIndex.toFixed(2)} without the hazard
          </span>
        ) : (
          <span className="mono" style={{ fontSize: 13, color: C.dim }}>
            {baselineDelta7d >= 0 ? '+' : ''}{Number.isFinite(baselineDelta7d) ? baselineDelta7d.toFixed(2) : '—'} {t('over 7 days')}
          </span>
        )}
        <Spark data={history} />
      </span>

      {/* 2 — what moved it */}
      <span style={{ flex: 1, minWidth: 240, fontSize: 13 }}>
        <span style={{ color: C.faint }}>{t('What changed:')}</span>{' '}{whatChanged}
      </span>

      {/* 3 — where it came from, and the one action */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, fontSize: 12, color: C.faint }}>
        <span>{t(eventsInWindow === 1 ? '{count} event in window' : '{count} events in window', { count: eventsInWindow })}</span>
        <span
          title={sourceNote}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            border: `1px solid ${tone.border}`, borderRadius: 3, padding: '2px 8px', color: tone.text,
          }}
        >
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: tone.text }} />
          {t(isStatic ? 'Static snapshot' : 'Live vault')}
          {` · ${model.datasetAsOf}`}
        </span>
        {scenarioActive && onClearHazard && (
          <button type="button" onClick={onClearHazard} className="ui-button"
            title={hazard?.desc || 'Remove the hazard overlay and return to the observed reading'}
            style={{ fontSize: 13, padding: '5px 12px', borderRadius: 5, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, background: C.amber, color: C.onAccent, border: `1px solid ${C.amber}` }}>{t('Clear hazard')}</button>
        )}
      </span>
    </div>
  );
}
