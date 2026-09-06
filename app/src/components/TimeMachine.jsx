import { t } from '../i18n/index.js';
import { useMemo } from 'react';
import { C } from '../theme.js';
import { Disclosure } from '../ui/primitives.jsx';
import { useVault } from '../data/VaultContext.jsx';
import { reviewDateISO } from '../engine/buildModel.js';
import { eventImpacts } from '../engine/timeseries.js';
import { getEventAssumption } from '../engine/event-assumptions.js';
import { riskColor } from '../utils/colors.js';

/* ====================================================================
   TimeMachine — review the chain as it actually stood on a past date.

   This replaces the what-if machinery with the other question, which the
   data can actually answer: not "what if a quake hit Kyushu" but "what did
   the chain look like the week it did". Everything re-derives — the map,
   the stage fields, the country readings, the index — through the engine's
   own back-dating rule (eventsAsOf), so a reviewed date is a real past
   state of the model and not today's numbers with a different caption.

   Two ways in, deliberately:

     the slider   continuous review. Drag anywhere in the record.
     the markers  every reviewed event, at its own date, sized by the
                  MARGINAL contribution it made to the index that day
                  (timeseries.js eventImpacts — the index with the event,
                  minus the same date without it). Clicking one snaps the
                  slider to that date and pins the event.

   Marginal, not standalone, and the difference matters: propagation
   combines through a bounded, saturating operator, so two severity-7 incidents on the
   same stages do not move the index twice as far as one. The marginal
   figure is what that event actually added to the number that was
   published.

   The index is NOT re-derived here. Every figure comes from the engine's
   own chainIndexAt / indexOf, so this panel and the history chart cannot
   disagree.
   ==================================================================== */

/* A decade of daily steps is more resolution than the data supports (the
   record thins out badly before ~2020) and more than a slider can express.
   Three years of review covers every event dense enough to be worth
   scrubbing through; older ones are still reachable from their markers. */
const MAX_REVIEW_DAYS = 1100;
const MARKER_LIMIT = 60;

export default function TimeMachine({ asOfDaysAgo, setAsOfDaysAgo, setSel, selectedId }) {
  const { engine } = useVault();

  const spanDays = Math.min(engine.longSpanDays || MAX_REVIEW_DAYS, MAX_REVIEW_DAYS);

  /* Marginal per-event attribution, computed once. Only events inside the
     reviewable span get a marker; the rest stay in the history panel. */
  const markers = useMemo(() => {
    const impacts = eventImpacts(engine, getEventAssumption);
    return impacts
      // Only scored events get a marker: an excluded event contributes
      // exactly 0 to the index, so a mark for it would claim a movement the
      // model never made. They stay visible in the intelligence feed.
      .filter((im) => im.operational && (im.daysAgo ?? 0) <= spanDays && (im.daysAgo ?? 0) >= 0)
      .sort((a, b) => Math.abs(b.marginal ?? 0) - Math.abs(a.marginal ?? 0))
      .slice(0, MARKER_LIMIT)
      .map((im) => ({ ...im, dateISO: reviewDateISO(engine, im.daysAgo) }));
  }, [engine, spanDays]);

  const maxMarginal = useMemo(
    () => markers.reduce((m, im) => Math.max(m, Math.abs(im.marginal ?? 0)), 0.001),
    [markers],
  );

  const live = !asOfDaysAgo;
  const shownDate = reviewDateISO(engine, asOfDaysAgo);
  const indexThen = engine.chainIndexAt(asOfDaysAgo || 0);

  // The slider runs left-to-right as past-to-present, which is how a reader
  // expects time to run; the underlying value is an offset backwards, so it
  // is inverted on the way in and out rather than in the model.
  const sliderValue = spanDays - (asOfDaysAgo || 0);
  const onSlide = (v) => setAsOfDaysAgo(Math.max(0, spanDays - Number(v)));

  return (
    <div className="cbar" style={{ padding: '7px 16px', background: live ? C.panel2 : C.panel2, borderBottom: `1px solid ${live ? C.line : C.copperDim}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 12, color: live ? C.faint : C.copper, flexShrink: 0 }}>
          {live ? t('LIVE') : '⟲ REVIEWING'}
        </span>
        <span className="mono" style={{ fontSize: 12, color: live ? C.dim : C.text, fontWeight: live ? 400 : 700, flexShrink: 0 }}>
          {shownDate}
        </span>
        <span className="mono" style={{ fontSize: 12, color: C.dim, flexShrink: 0 }}>
          index <b style={{ color: riskColor(indexThen), fontSize: 13 }}>{indexThen.toFixed(2)}</b>
        </span>

        <input type="range" min="0" max={spanDays} step="1" value={sliderValue}
          onChange={(e) => onSlide(e.target.value)}
          aria-label={t('Review the chain as of a past date')}
          style={{ flex: '1 1 240px', minWidth: 160, accentColor: live ? C.copperDim : C.copper }} />

        <button type="button" onClick={() => setAsOfDaysAgo(0)} disabled={live}
          style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, fontFamily: 'inherit',
            cursor: live ? 'default' : 'pointer', fontWeight: live ? 400 : 700,
            background: live ? 'transparent' : C.copper, color: live ? C.faint : C.onAccent,
            border: `1px solid ${live ? C.line : C.copper}`, opacity: live ? 0.5 : 1 }}>{t('Return to live')}</button>
      </div>

      {/* --- event markers: click to jump to that date --- */}
      <div style={{ position: 'relative', height: 22, marginTop: 4 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 1, background: C.line }} />
        {markers.map((im) => {
          const pos = spanDays ? ((spanDays - im.daysAgo) / spanDays) * 100 : 100;
          const mag = Math.abs(im.marginal ?? 0) / maxMarginal;
          const h = 5 + 11 * mag;
          const on = selectedId === im.id;
          const adverse = (im.marginal ?? 0) >= 0;
          return (
            <button key={im.id} type="button"
              onClick={() => { setAsOfDaysAgo(im.daysAgo); setSel({ type: 'event', id: im.id }); }}
              title={`${im.dateISO} · ${im.title}\nincident-removal difference on its date: ${(im.marginal ?? 0) >= 0 ? '+' : ''}${(im.marginal ?? 0).toFixed(3)} (not an additive share)`}
              aria-label={`Review ${im.dateISO}: ${im.title}`}
              style={{
                position: 'absolute', left: `${pos}%`, transform: 'translateX(-50%)',
                bottom: 0, width: on ? 5 : 3, height: h, padding: 0, minHeight: 0,
                background: on ? C.text : adverse ? C.amber : C.green,
                border: 'none', borderRadius: 1, cursor: 'pointer',
                opacity: on ? 1 : 0.35 + 0.5 * mag,
              }} />
          );
        })}
      </div>

      {/* This paragraph is a methodological caveat, not an instruction, and
          it was three lines of permanent text above the graph. At 375px the
          page chrome reached 780 of 812 pixels before any content appeared,
          and this block was the largest single contributor. The caveat is
          not hidden — it is one click away, which is where a caveat that a
          reader has not asked for belongs. The state sentence, which says
          WHAT IS ON SCREEN rather than how to read it, stays visible. */}
      {live ? (
        <Disclosure summary={t('How to read this timeline')} style={{ marginTop: 2 }}>
          Current-model retrospective replay over the last{' '}
          {Math.round(spanDays / 30)} months, or click an event marker. Marker
          height shows the index difference when the entire incident, including its updates,
          is removed on the primary record&rsquo;s date. These differences are not additive shares.
          The replay uses the current network and parameters. These are recalculations, not archived outputs or point-in-time validation; source publication dates limit when evidence can apply.
        </Disclosure>
      ) : (
        <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.6, marginTop: 2 }}>
          {`Current-model retrospective replay for ${shownDate}: ${engine.eventsAsOf(asOfDaysAgo).length} available event record(s). Current network and parameters; sparse coverage and a neutral score do not establish historical safety.`}
        </div>
      )}
    </div>
  );
}
