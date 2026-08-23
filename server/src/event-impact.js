/* What each event is actually worth to the published index.

   ── Why the server computes this ──────────────────────────────────────────
   "Delete this event" is a decision about a number, and the number is not
   visible from the event row. Severity 7 says how bad the event was; it does
   not say what removing it does to the index, because propagation combines
   through a saturating noisy-OR (engine/math.js combineSigned) and decays
   with age. A severity-9 export control from 2022 moves today's index by
   nothing at all, and one of five near-identical earthquake records moves it
   less than any of them would alone. Deleting on severity alone is guessing.

   ── It does not re-derive anything ────────────────────────────────────────
   Every figure here comes from the engine's own chainIndexAt / indexOf, built
   from the same bundle the dashboard renders. That is the same rule
   engine/timeseries.js follows, and it is what stops this readout and the
   published index from disagreeing about the same event.

   ── Two different questions ───────────────────────────────────────────────
   removalDelta  what today's published index does if this event is deleted.
                 The number an admin is actually deciding on.
   marginal      what the event contributed on its OWN date — the historical
                 attribution the dashboard's history panel shows. An old event
                 can have a large marginal and a zero removalDelta; that means
                 it mattered then and does not now.
   ──────────────────────────────────────────────────────────────────────── */
import { buildBundle } from './bundle.js';
import { buildVaultData } from '../../app/src/data/buildVaultData.js';
import { buildEngine } from '../../app/src/engine/index.js';
import { getEventAssumption } from '../../app/src/engine/event-assumptions.js';

/* Built per request rather than cached. The vault changes underneath this —
   that is the entire point of the screen it feeds — and a cached engine would
   quote impacts for events that had already been deleted. Building costs
   ~130ms against the full 163-event vault, against a screen a human reads. */
export function buildVaultEngine() {
  const bundle = buildBundle();
  const data = buildVaultData(bundle);
  const engine = buildEngine({
    STAGES: data.STAGES, FLOW_EDGES: data.FLOW_EDGES, COMPANIES: data.COMPANIES,
    CUSTOMERS: data.CUSTOMERS, POLICIES: data.POLICIES, EVENTS: data.EVENTS, OWNERS: data.OWNERS,
    datasetAsOf: bundle.meta?.snapshotDate,
  });
  return { engine, data, snapshotDate: bundle.meta?.snapshotDate ?? null };
}

const round = (n, places = 4) => Number(n.toFixed(places));

/* Impact of every event on the CURRENT index, plus its historical marginal.
   One engine build and one index evaluation per scored event — ~20ms for the
   whole table, so there is no reason to paginate or compute this lazily. */
export function eventImpacts() {
  const { engine, data, snapshotDate } = buildVaultEngine();
  const events = data.EVENTS;
  const scored = events.filter((e) => getEventAssumption(e.id).operational);
  const current = engine.chainIndexAt(0);

  const rows = events.map((event) => {
    const assumption = getEventAssumption(event.id);
    const daysAgo = event.daysAgo ?? 0;

    if (!assumption.operational) {
      /* Not in the scored set at all, so removing it cannot move the index.
         Reported as an explicit zero rather than omitted — "this event does
         nothing to the number" is the answer, not missing data. */
      return {
        id: event.id, title: event.title, dateISO: event.dateISO ?? null, daysAgo,
        sev: event.sev, type: event.type, conf: event.conf,
        stages: event.stages ?? [], countries: event.countries ?? [],
        operational: false, direction: assumption.direction, channel: assumption.channel,
        reason: assumption.reason,
        indexWithout: round(current), removalDelta: 0, marginal: 0, standalone: 0,
      };
    }

    const withoutNow = engine.indexOf(scored.filter((e) => e.id !== event.id), 0);
    const indexOnDate = engine.chainIndexAt(daysAgo);
    const withoutThen = engine.indexOf(scored.filter((e) => e.id !== event.id), daysAgo);

    return {
      id: event.id, title: event.title, dateISO: event.dateISO ?? null, daysAgo,
      sev: event.sev, type: event.type, conf: event.conf,
      stages: event.stages ?? [], countries: event.countries ?? [],
      operational: true, direction: assumption.direction, channel: assumption.channel,
      reason: assumption.reason,
      indexWithout: round(withoutNow),
      removalDelta: round(current - withoutNow),
      indexOnDate: round(indexOnDate),
      marginal: round(indexOnDate - withoutThen),
      standalone: round(engine.indexOf([event], daysAgo) - 5),
    };
  });

  return { snapshotDate, currentIndex: round(current), scoredCount: scored.length, events: rows };
}

/* Impact of removing a SET of events at once, which is not the sum of the
   individual deltas. Five near-identical earthquake records each show a small
   removalDelta precisely because the other four are still there; drop all
   five and the index moves much further than any one of them suggested.
   An admin clearing a duplicate cluster needs this number, not the sum. */
export function removalPreview(ids) {
  const { engine, data } = buildVaultEngine();
  const doomed = new Set(ids);
  const known = data.EVENTS.filter((e) => doomed.has(e.id)).map((e) => e.id);
  const missing = [...doomed].filter((id) => !known.includes(id));

  const scored = data.EVENTS.filter((e) => getEventAssumption(e.id).operational);
  const current = engine.chainIndexAt(0);
  const after = engine.indexOf(scored.filter((e) => !doomed.has(e.id)), 0);

  /* The sum of each event's own removalDelta, for contrast with the real
     combined figure. They differ whenever the removed events overlap, and
     showing both is what makes the saturation legible instead of looking
     like an arithmetic error. */
  const sumOfIndividual = known.reduce((total, id) => {
    if (!scored.some((e) => e.id === id)) return total;
    return total + (current - engine.indexOf(scored.filter((e) => e.id !== id), 0));
  }, 0);

  return {
    requested: [...doomed], removing: known, notFound: missing,
    currentIndex: round(current),
    indexAfter: round(after),
    delta: round(current - after),
    sumOfIndividualDeltas: round(sumOfIndividual),
    scoredRemoved: known.filter((id) => scored.some((e) => e.id === id)).length,
  };
}
