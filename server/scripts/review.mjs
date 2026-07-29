#!/usr/bin/env node
/* Review queue CLI — the human gate between the pipeline and the model.

   The AI drafts and proposes; approving here is what makes an event real.
   Approval writes the event into `events` AND prints the event-assumptions.js
   entry to paste, because an id with no recorded assumption is displayed but
   excluded from the scored index by design.

     node scripts/review.mjs list                 pending candidates
     node scripts/review.mjs show <id>            full proposal + raw record
     node scripts/review.mjs approve <id> [--sev=7] [--direction=adverse]
                                                  [--channel=both] [--operational=false]
     node scripts/review.mjs reject <id> [--reason="..."]

   Any field can be overridden at approval time — the proposal is a starting
   point, not a verdict. */
import { db } from '../src/db.js';
import { getSnapshotDate } from '../src/meta.js';
import { daysAgoOf } from '../src/history-events.js';

const [cmd, id, ...rest] = process.argv.slice(2);
const opt = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

const fmtDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });

function list() {
  const rows = db.prepare(`SELECT id, source_feed, date_iso, proposed_json, ai_notes
    FROM event_candidates WHERE status = 'pending' ORDER BY date_iso DESC`).all();
  if (!rows.length) return console.log('No pending candidates.');
  console.log(`${rows.length} pending candidate(s):\n`);
  for (const r of rows) {
    const p = r.proposed_json ? JSON.parse(r.proposed_json) : null;
    const verdict = !p ? '[undrafted]' : p.relevant ? `sev ${p.proposedSev} ${p.proposedDirection}/${p.proposedChannel} ${p.proposedOperational ? 'scored' : 'excluded'}` : '[AI: not relevant]';
    console.log(`  ${r.id}`);
    console.log(`    ${r.date_iso}  ${r.source_feed}  ${verdict}`);
    console.log(`    ${p?.title ?? '(no draft)'}`);
    if (r.ai_notes) console.log(`    uncertainty: ${r.ai_notes.slice(0, 160)}`);
    console.log('');
  }
  console.log('Review one:  node scripts/review.mjs show <id>');
}

function show(candidateId) {
  const r = db.prepare('SELECT * FROM event_candidates WHERE id = ?').get(candidateId);
  if (!r) return console.error(`No candidate ${candidateId}`);
  console.log(`\n=== ${r.id} (${r.status}) ===`);
  console.log(`feed: ${r.source_feed} · ref: ${r.source_ref} · date: ${r.date_iso}`);
  console.log(`\n--- raw upstream record ---\n${JSON.stringify(JSON.parse(r.raw_json), null, 2)}`);
  if (r.proposed_json) {
    console.log(`\n--- AI proposal (${r.ai_model}) — NOT authoritative ---\n${JSON.stringify(JSON.parse(r.proposed_json), null, 2)}`);
  } else {
    console.log(`\n--- no AI draft ---\n${r.ai_notes ?? '(none)'}`);
  }
  console.log(`\nApprove:  node scripts/review.mjs approve ${r.id} [--sev=N] [--direction=adverse|mitigating|mixed] [--channel=downstream|upstream|both] [--operational=true|false]`);
  console.log(`Reject:   node scripts/review.mjs reject ${r.id} --reason="..."`);
}

function approve(candidateId) {
  const r = db.prepare('SELECT * FROM event_candidates WHERE id = ?').get(candidateId);
  if (!r) return console.error(`No candidate ${candidateId}`);
  if (!r.proposed_json) return console.error('Candidate has no draft. Add the event by hand in server/src/history-events.js instead.');
  const p = JSON.parse(r.proposed_json);

  const sev = Number(opt('sev') ?? p.proposedSev);
  const direction = opt('direction') ?? p.proposedDirection;
  const channel = opt('channel') ?? p.proposedChannel;
  const operational = (opt('operational') ?? String(p.proposedOperational)) === 'true';
  if (!Number.isInteger(sev) || sev < 1 || sev > 10) return console.error(`Invalid --sev=${sev} (1-10)`);
  if (!['adverse', 'mitigating', 'mixed'].includes(direction)) return console.error(`Invalid --direction=${direction}`);
  if (!['downstream', 'upstream', 'both'].includes(channel)) return console.error(`Invalid --channel=${channel}`);

  const eventId = opt('event-id') ?? `p${r.date_iso.replace(/-/g, '').slice(2)}_${r.source_feed.slice(0, 3)}${r.source_ref.replace(/[^\w]/g, '').slice(-4)}`;
  if (db.prepare('SELECT id FROM events WHERE id = ?').get(eventId)) return console.error(`Event id ${eventId} already exists — pass --event-id=<unique>`);

  db.prepare(`INSERT INTO events (id, date, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
    VALUES (@id, @date, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)`)
    .run({
      id: eventId, date: fmtDate(r.date_iso), days_ago: daysAgoOf(r.date_iso, getSnapshotDate()),
      sev, type: p.eventType, conf: p.confidence,
      title: p.title, summary: p.summary, first: p.first, second: p.second, watch: p.watch,
      detail: `${p.detail}\n\nReviewer note: severity and classification accepted from an AI-drafted proposal on human review. Uncertainty at draft time: ${p.uncertainty}`,
      source: `${r.source_feed} (${JSON.parse(r.raw_json).url ?? r.source_ref}) — AI-drafted, human-reviewed`,
      stages_json: JSON.stringify(p.stages), countries_json: JSON.stringify(p.countries), timeline_json: JSON.stringify([]),
    });

  db.prepare("UPDATE event_candidates SET status='approved', reviewed_at=datetime('now'), reviewed_by=? WHERE id=?")
    .run(process.env.USERNAME || process.env.USER || 'local', candidateId);
  db.pragma('wal_checkpoint(TRUNCATE)');

  console.log(`Approved → event ${eventId}\n`);
  console.log('Add this to app/src/engine/event-assumptions.js (an unclassified id is excluded from the scored index):\n');
  console.log(`  ${eventId}: Object.freeze({ direction: '${direction}', channel: '${channel}', operational: ${operational}, reason: ${JSON.stringify(p.classificationReason)} }),\n`);
  console.log('Then: cd ../app && npm run snapshot && npm run audit:data');
}

function reject(candidateId) {
  const info = db.prepare("UPDATE event_candidates SET status='rejected', reviewed_at=datetime('now'), reviewed_by=?, ai_notes=COALESCE(?, ai_notes) WHERE id=?")
    .run(process.env.USERNAME || process.env.USER || 'local', opt('reason') ?? null, candidateId);
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log(info.changes ? `Rejected ${candidateId}` : `No candidate ${candidateId}`);
}

switch (cmd) {
  case 'list': list(); break;
  case 'show': show(id); break;
  case 'approve': approve(id); break;
  case 'reject': reject(id); break;
  default:
    console.log('Usage: node scripts/review.mjs list | show <id> | approve <id> [--sev=N ...] | reject <id> [--reason="..."]');
}
