#!/usr/bin/env node
/* Review queue CLI — the human gate between the pipeline and the model.

   The AI drafts and proposes; approving here is what makes an event real.
   Approval writes the event into `events` AND records its classification in
   app/src/engine/event-assumptions.js, because an id with no recorded
   assumption is displayed but silently excluded from the scored index.

     node scripts/review.mjs list                 pending candidates
     node scripts/review.mjs show <id>            full proposal + raw record
     node scripts/review.mjs approve <id> [--sev=7] [--direction=adverse]
                                                  [--channel=both] [--operational=false]
     node scripts/review.mjs reject <id> [--reason="..."]
     node scripts/review.mjs publish              commit + push the batch now

   Any field can be overridden at approval time — the proposal is a starting
   point, not a verdict.

   Publishing: finishing the queue publishes the batch automatically (one
   commit for the session, not one per decision). Pass --no-publish to hold it
   back, or run `publish` yourself later. Either way the decision is already in
   the database the moment it is made; the commit is only its distribution.

   The decision logic itself lives in src/review-queue.js, shared with the
   admin API — this file is a front end for it, not a second implementation. */
import {
  candidateById, pendingCandidates, approveCandidate, rejectCandidate,
  publishPendingReviews, unpublishedReviews,
} from '../src/review-queue.js';

const [cmd, id, ...rest] = process.argv.slice(2);
const opt = (name) => rest.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const flag = (name) => rest.includes(`--${name}`);

function list() {
  const rows = pendingCandidates();
  if (!rows.length) return console.log('No pending candidates.');
  console.log(`${rows.length} pending candidate(s):\n`);
  for (const r of rows) {
    const p = r.proposal;
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
  const r = candidateById(candidateId);
  if (!r) return console.error(`No candidate ${candidateId}`);
  console.log(`\n=== ${r.id} (${r.status}) ===`);
  console.log(`feed: ${r.source_feed} · ref: ${r.source_ref} · date: ${r.date_iso}`);
  console.log(`\n--- raw upstream record ---\n${JSON.stringify(r.raw, null, 2)}`);
  if (r.proposal) {
    console.log(`\n--- AI proposal (${r.ai_model}) — NOT authoritative ---\n${JSON.stringify(r.proposal, null, 2)}`);
  } else {
    console.log(`\n--- no AI draft ---\n${r.ai_notes ?? '(none)'}`);
  }
  console.log(`\nApprove:  node scripts/review.mjs approve ${r.id} [--sev=N] [--direction=adverse|mitigating|mixed] [--channel=downstream|upstream|both] [--operational=true|false]`);
  console.log(`Reject:   node scripts/review.mjs reject ${r.id} --reason="..."`);
}

/* A CLI process exits as soon as the command finishes, so the server's idle
   auto-publish timer would never fire here. The CLI equivalent is to publish
   synchronously once the queue is empty — the same "one commit per review
   session" outcome, reached by a different route. */
function publishAfterDecision() {
  if (flag('no-publish')) {
    console.log(`\nHeld back (--no-publish). ${unpublishedReviews().length} decision(s) waiting — publish with: node scripts/review.mjs publish`);
    return;
  }
  const remaining = pendingCandidates().length;
  if (remaining) {
    console.log(`\n${remaining} candidate(s) still pending — publishing when the queue is empty. Publish now with: node scripts/review.mjs publish`);
    return;
  }
  publish();
}

function publish() {
  const queued = unpublishedReviews().length;
  if (!queued) return console.log('Nothing to publish — no unpublished review decisions.');
  console.log(`\nPublishing ${queued} decision(s)...`);
  const result = publishPendingReviews();
  if (result.published) {
    console.log(`  ${result.message}${result.count ? '' : ' (nothing to commit)'}`);
  } else {
    console.error(`  publish FAILED — decisions are safe in the database and the next pipeline run retries.\n${result.error}`);
    process.exitCode = 1;
  }
}

const reviewer = () => process.env.USERNAME || process.env.USER || 'local';

function approve(candidateId) {
  const operationalOpt = opt('operational');
  try {
    const { eventId } = approveCandidate(candidateId, {
      eventId: opt('event-id'),
      sev: opt('sev') !== undefined ? Number(opt('sev')) : undefined,
      direction: opt('direction'),
      channel: opt('channel'),
      operational: operationalOpt === undefined ? undefined : operationalOpt === 'true',
      reason: opt('reason'),
    }, reviewer());
    console.log(`Approved → event ${eventId}`);
    console.log('Classification recorded in app/src/engine/event-assumptions.js.');
    console.log('Refresh the bundled snapshot with:  cd ../app && npm run snapshot && npm run audit:data');
    publishAfterDecision();
  } catch (error) {
    console.error(`Cannot approve ${candidateId}: ${error.message}`);
    process.exitCode = 1;
  }
}

function reject(candidateId) {
  try {
    rejectCandidate(candidateId, opt('reason'), reviewer());
    console.log(`Rejected ${candidateId}`);
    publishAfterDecision();
  } catch (error) {
    console.error(`Cannot reject ${candidateId}: ${error.message}`);
    process.exitCode = 1;
  }
}

switch (cmd) {
  case 'list': list(); break;
  case 'show': show(id); break;
  case 'approve': approve(id); break;
  case 'reject': reject(id); break;
  case 'publish': publish(); break;
  default:
    console.log('Usage: node scripts/review.mjs list | show <id> | approve <id> [--sev=N ...] [--no-publish]');
    console.log('                            | reject <id> [--reason="..."] [--no-publish] | publish');
}
