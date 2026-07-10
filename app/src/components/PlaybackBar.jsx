import { useEffect, useState, useRef } from 'react';
import { C } from '../theme.js';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { useVault } from '../data/VaultContext.jsx';
import { fmtSigned } from '../interaction/lensEncoding.js';

/* ====================================================================
   PlaybackBar — hop-by-hop propagation playback control (task §7 / §15).

   Drives the shared interaction controller's playback state
   ({ status, step, speed, length }); the world map, industry graph and
   Layer-3 panel all read the SAME derived frame (see playback.js /
   frameFromTrace), so nothing here computes visuals itself — it only
   steps the shared clock and reports which stages this hop reached.

   Reduced-motion: when the OS asks for reduced motion, auto-play still
   works but advances in slower, discrete steps and the pulse animation
   (defined in App GLOBAL_STYLE) is already suppressed by the media query;
   the bar says so, so the discrete-state nature is explicit.
   ==================================================================== */

const BASE_INTERVAL = 1100; // ms per hop at 1x, normal motion
const REDUCED_INTERVAL = 1600;

function btnStyle(disabled, primary) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 9px', borderRadius: 5, cursor: disabled ? 'default' : 'pointer',
    border: `1px solid ${primary ? C.copper : C.line}`,
    background: primary ? 'rgba(201,138,63,.14)' : 'transparent',
    color: disabled ? C.faint : primary ? C.copper : C.text,
    fontFamily: 'inherit', fontSize: 11, opacity: disabled ? 0.5 : 1,
  };
}

export default function PlaybackBar({ frame, scenarioName }) {
  const { state, playback } = useInteraction();
  const { engine } = useVault();
  const { STAGE_BY_ID } = engine;
  const pb = state.playback;
  const length = pb.length || 0;
  const step = pb.step || 0;
  const playing = pb.status === 'playing';
  const atEnd = step >= length - 1;
  const atStart = step <= 0;

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const fn = () => setReducedMotion(mq.matches);
    fn(); mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  // Auto-advance: re-scheduled every time `step` changes while playing, so
  // a manual pause / selection (which flips status away from 'playing' via
  // the reducer) cancels the pending hop cleanly.
  const timer = useRef(null);
  useEffect(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (!playing) return;
    if (atEnd) { playback({ status: 'paused' }); return; }
    const interval = (reducedMotion ? REDUCED_INTERVAL : BASE_INTERVAL) / (pb.speed || 1);
    timer.current = setTimeout(() => playback({ step: step + 1 }), interval);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, step, atEnd, pb.speed, reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  if (length <= 0) return null;

  const toStep = (s) => playback({ step: s, status: 'paused' });
  const reset = () => playback({ step: 0, status: 'idle' });
  const play = () => (atEnd ? playback({ step: 0, status: 'playing' }) : playback({ status: 'playing' }));
  const pause = () => playback({ status: 'paused' });

  const newNames = frame?.newStages
    ? [...frame.newStages].map((sid) => STAGE_BY_ID[sid]?.name || sid)
    : [];
  const cumCount = frame?.reachedStages?.size ?? 0;

  const speeds = [0.5, 1, 2];

  return (
    <div id="playback-bar" role="group" aria-label="Propagation playback"
      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '7px 14px', borderBottom: `1px solid ${C.line}`, background: C.panel }}>
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: 1.2, color: C.copper }}>▶ PROPAGATION</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={reset} disabled={atStart && pb.status === 'idle'} style={btnStyle(atStart && pb.status === 'idle')} title="Reset to the source shock" aria-label="Reset playback">⏮ Reset</button>
        <button onClick={() => toStep(step - 1)} disabled={atStart} style={btnStyle(atStart)} title="Previous hop" aria-label="Previous hop">◀ Prev</button>
        {playing
          ? <button onClick={pause} style={btnStyle(false, true)} aria-label="Pause">⏸ Pause</button>
          : <button onClick={play} style={btnStyle(false, true)} aria-label="Play">▶ Play</button>}
        <button onClick={() => toStep(step + 1)} disabled={atEnd} style={btnStyle(atEnd)} title="Next hop" aria-label="Next hop">Next ▶</button>
        <button onClick={() => toStep(length - 1)} disabled={atEnd} style={btnStyle(atEnd)} title="Jump to the fully-propagated state" aria-label="Jump to final hop">Final ⏭</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} role="group" aria-label="Playback speed">
        <span className="mono" style={{ fontSize: 9, color: C.faint }}>SPEED</span>
        {speeds.map((s) => (
          <button key={s} onClick={() => playback({ speed: s })}
            aria-pressed={pb.speed === s}
            style={{ ...btnStyle(false, pb.speed === s), padding: '3px 7px', fontSize: 10 }}>
            {s}×
          </button>
        ))}
      </div>

      {/* Hop readout — the same clock the map and graph are showing */}
      <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', fontSize: 10, color: C.dim }}>
        <span aria-live="polite">HOP {step} / {length - 1}</span>
        <span style={{ color: C.faint }}>· {cumCount} stage{cumCount === 1 ? '' : 's'} reached</span>
        {newNames.length > 0 && (
          <span style={{ color: C.text }}>· this hop: {newNames.slice(0, 4).join(', ')}{newNames.length > 4 ? ` +${newNames.length - 4}` : ''}</span>
        )}
      </div>

      <div className="mono" style={{ flexBasis: '100%', fontSize: 9, color: C.faint, lineHeight: 1.5 }}>
        Replays how the <b style={{ color: C.dim }}>{scenarioName || 'scenario'}</b> shock spreads across modeled propagation priors — hops are settle-order over the graph, not a physical shipment timeline.
        {reducedMotion && <span style={{ color: C.amber }}> · reduced-motion: stepping discretely.</span>}
      </div>
    </div>
  );
}
