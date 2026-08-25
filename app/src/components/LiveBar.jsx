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

  const tone = scenarioActive ? { bg: '#2A1E14', border: C.amber, text: C.amber, label: '⌖ HAZARD APPLIED' }
    : reviewing ? { bg: '#161A26', border: C.copperDim, text: C.copper, label: '⟲ HISTORY REVIEW' }
      : isStatic ? { bg: C.panel2, border: C.line, text: C.dim, label: '◍ STATIC SNAPSHOT' }
        : { bg: C.panel2, border: C.line, text: C.dim, label: '● LIVE VAULT' };

  const sourceNote = isStatic
    ? `Static snapshot — the vault API is not reachable from here, so this is the dataset frozen into the build (data as of ${model.datasetAsOf}). Figures are real and complete; they do not update until the site is rebuilt.`
    : `Live vault — figures are read from the vault API (data as of ${model.datasetAsOf}).`;

  return (
    <div className="mono" style={{ background: tone.bg, borderBottom: `1px solid ${tone.border}`, padding: '7px 16px', fontSize: 11.5, color: tone.text, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 9, letterSpacing: 1.4, color: tone.text, flexShrink: 0, fontWeight: 700 }} title={sourceNote}>{tone.label}</span>
      {/* The source is stated even while a hazard or a history review owns
          the main label, because those are claims about WHAT is being shown
          and this is a claim about WHERE IT CAME FROM — they are different
          questions and collapsing them is how "LIVE" ended up on a static
          deploy in the first place. */}
      {(scenarioActive || reviewing) && (
        <span className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: C.faint, flexShrink: 0 }} title={sourceNote}>
          {isStatic ? '◍ STATIC SNAPSHOT' : '● LIVE VAULT'}
        </span>
      )}
      <span className="mono" style={{ fontSize: 9, color: C.faint, flexShrink: 0 }} title={sourceNote}>
        data as of {model.datasetAsOf}
      </span>

      <span style={{ flex: 1, minWidth: 220 }}>
        <span style={{ color: C.copper, fontWeight: 600 }}>{t('WHAT CHANGED')} · </span>{whatChanged}
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Spark data={history} />
        <span style={{ fontSize: 10, color: C.faint }}>
          {eventsInWindow} event{eventsInWindow === 1 ? '' : 's'} in window
        </span>
        <span style={{ fontSize: 11, color: C.dim }}>
          index <b style={{ fontSize: 15, color: riskColor(activeChainIndex) }}>{activeChainIndex.toFixed(2)}</b>
        </span>
        {scenarioActive ? (
          <span style={{ fontSize: 10.5, color: C.amber }}>
            {chainIndexDelta >= 0 ? '+' : ''}{chainIndexDelta.toFixed(2)} vs {baselineChainIndex.toFixed(2)} without it
          </span>
        ) : (
          <span style={{ fontSize: 10.5, color: C.faint }}>
            {baselineDelta7d >= 0 ? '+' : ''}{Number.isFinite(baselineDelta7d) ? baselineDelta7d.toFixed(2) : '—'} over 7d
          </span>
        )}
        {scenarioActive && onClearHazard && (
          <button type="button" onClick={onClearHazard}
            title={hazard?.desc || 'Remove the hazard overlay and return to the observed reading'}
            style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 700, background: C.amber, color: '#0C111C', border: `1px solid ${C.amber}` }}>
            Clear hazard
          </button>
        )}
      </span>
    </div>
  );
}
