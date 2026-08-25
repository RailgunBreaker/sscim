/* ====================================================================
   ingest/incident.js — recognising that two candidates describe the same
   real-world INCIDENT, not just the same headline.

   WHY THE TITLE ALONE IS NOT ENOUGH. dedupe.js compares meaningful title
   tokens, which catches a wire story syndicated across a dozen sites.
   What it cannot catch is the case that actually got through: seven
   records of one earthquake, written from different angles.

     "M7.1 Kumamoto earthquake halts multiple Kyushu semiconductor fabs"
     "Sony halts Kumamoto image-sensor fab indefinitely after Kyushu earthquake"
     "TSMC's JASM Kumamoto fab resumes operations after M7.1 earthquake"

   Those share few tokens. Jaccard overlap between the first and the third
   is well under the 0.6 duplicate threshold, so all three entered the
   queue as separate events and all three were scored — and the index
   accumulates through noisy-OR, so one earthquake pushed the reading as
   though three had happened. The third is a RECOVERY report and was
   classified adverse, which meant a fab coming back online was raising
   the disruption reading.

   WHAT THIS ADDS. Five signals beyond the title, each cheap and each
   computed from what the candidate already carries:

     geography   place names shared between the two records
     magnitude   an earthquake magnitude, a Federal Register citation, a
                 named storm — the identifiers an incident actually has
     type        both records describe the same class of incident
     proximity   how many days apart they are
     facilities  operator and plant names shared between them

   WHAT IT DELIBERATELY DOES NOT DO. It never auto-rejects. A near-title
   match is already only flagged rather than collapsed, because a rewrite
   is where a genuinely distinct event hides ("export curbs on chip
   equipment" and "export curbs on chip materials" differ by one token and
   are two different rules). An incident match is weaker evidence than
   that, not stronger: it says "these may be the same story", which is
   exactly the judgement a person should make. So the output is a FLAG
   with its reasons attached, and the reasons are written into the
   candidate so the reviewer can see what matched rather than being asked
   to trust a score.

   Pure and dependency-free, so every rule is unit-testable.
   ==================================================================== */

import { tokenize, similarity } from './dedupe.js';

/* Incident classes, recognised from the words a report actually uses.
   Deliberately coarse: the question is "are these the same KIND of
   thing", not a taxonomy. */
export const INCIDENT_TYPES = {
  /* "Kumamoto M7.1: TSMC JASM confirmed safe" says earthquake without
     using the word — a bare magnitude is how a headline refers to one
     once the story is a day old, and reading that as a generic "outage"
     put a real pair of quake reports on opposite sides of the type check. */
  earthquake: /\b(earthquake|quake|seismic|magnitude|aftershock|tremor|M\s?\d\.\d)\b/i,
  fire: /\b(fire|blaze|explosion|blast)\b/i,
  flood: /\b(flood|typhoon|hurricane|storm|cyclone|monsoon)\b/i,
  power: /\b(power (outage|cut|failure)|blackout|grid failure)\b/i,
  export_control: /\b(export control|export curb|entry list|entity list|licen[cs]e requirement|BIS|sanction)\b/i,
  outage: /\b(halt|halts|halted|suspend|suspended|shutdown|shut down|outage|stoppage|offline)\b/i,
  strike: /\b(strike|walkout|labou?r dispute|industrial action)\b/i,
  cyber: /\b(cyber|ransomware|breach|hack)\b/i,
};

export function incidentType(text) {
  const t = String(text || '');
  /* Order matters: a report of an earthquake that halted fabs is an
     earthquake, not an "outage". The specific causes are listed before
     the generic consequence. */
  for (const [name, re] of Object.entries(INCIDENT_TYPES)) {
    if (name !== 'outage' && re.test(t)) return name;
  }
  return INCIDENT_TYPES.outage.test(t) ? 'outage' : null;
}

/* Identifiers an incident genuinely has, which two reports of the same
   one will usually agree on. A shared magnitude plus a shared place is
   very strong evidence; a shared magnitude alone is not (M7.1 is a common
   number). */
export function incidentMarkers(text) {
  const t = String(text || '');
  const markers = new Set();
  const mag = t.match(/\bM\s?(\d\.\d)\b|\bmagnitude[- ](\d\.\d)\b/i);
  if (mag) markers.add(`mag:${mag[1] || mag[2]}`);
  const fr = t.match(/\b(\d{2,3})\s*FR\s*(\d{3,6})\b/i);
  if (fr) markers.add(`fr:${fr[1]}-${fr[2]}`);
  const eo = t.match(/\bexecutive order\s+(\d{4,5})\b/i);
  if (eo) markers.add(`eo:${eo[1]}`);
  return markers;
}

/* Capitalised multi-word proper nouns: place names, operators, plant
   names. Crude on purpose — a gazetteer would be a data dependency for a
   signal that only has to be suggestive, and every match is shown to a
   person anyway. Sentence-initial words are kept because a headline's
   first word is usually a real name ("Sony halts...", "Kumamoto M7.1..."). */
const NOT_A_NAME = new Set([
  'The', 'A', 'An', 'In', 'On', 'At', 'For', 'From', 'By', 'With', 'As', 'After',
  'Amid', 'Over', 'Into', 'Out', 'Up', 'Down', 'New', 'Says', 'Report', 'Update',
  'Exclusive', 'Analysis', 'Breaking', 'And', 'Or', 'But', 'To', 'Of', 'It', 'Its',
  'This', 'That', 'More', 'Than', 'About', 'Will', 'May', 'Could', 'Would',
]);

export function properNouns(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/\b([A-Z][a-zA-Z]{2,})\b/g)) {
    if (!NOT_A_NAME.has(m[1])) out.add(m[1].toLowerCase());
  }
  return out;
}

const overlap = (a, b) => [...a].filter((x) => b.has(x));
const dayDiff = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;

export const INCIDENT_WINDOW_DAYS = 14;

/* The text a candidate offers about itself. Title first because it is the
   most reliable; summary and body add place and operator names the
   headline had no room for. */
export function candidateText(c) {
  const raw = c?.raw || c || {};
  return [raw.title, raw.summary, raw.text, raw.description].filter(Boolean).join(' \n ');
}

/* Scores how likely two records are to describe the SAME incident.

   Returns { score, reasons } — the reasons are the point. A number a
   reviewer cannot interrogate is a number they will either over-trust or
   ignore, so every contribution names itself. */
export function incidentMatch(a, b, { windowDays = INCIDENT_WINDOW_DAYS } = {}) {
  const reasons = [];
  let score = 0;

  const aDate = a.dateISO || a.date_iso;
  const bDate = b.dateISO || b.date_iso;
  if (aDate && bDate) {
    const days = dayDiff(aDate, bDate);
    if (days > windowDays) return { score: 0, reasons: ['outside the incident window'] };
    if (days <= 1) { score += 0.25; reasons.push(days === 0 ? 'same day' : 'one day apart'); }
    else if (days <= 3) { score += 0.15; reasons.push(`${Math.round(days)} days apart`); }
    else if (days <= 7) { score += 0.05; reasons.push(`${Math.round(days)} days apart`); }
  }

  const aText = candidateText(a);
  const bText = candidateText(b);

  const aType = incidentType(aText);
  const bType = incidentType(bText);
  if (aType && aType === bType) {
    score += 0.2;
    reasons.push(`both describe a ${aType.replace('_', ' ')}`);
  } else if (aType && bType && aType !== bType) {
    /* Only penalise when BOTH sides name a specific cause. `outage` is the
       generic fallback — a consequence, not a cause — so "earthquake" and
       "outage" are compatible readings of one event rather than a
       contradiction, and penalising that pair pushed two genuine reports of
       the same quake below the threshold. */
    const specific = aType !== 'outage' && bType !== 'outage';
    if (specific) { score -= 0.1; reasons.push(`different incident types (${aType} vs ${bType})`); }
    else { score += 0.05; reasons.push(`compatible incident types (${aType} / ${bType})`); }
  }

  const sharedMarkers = overlap(incidentMarkers(aText), incidentMarkers(bText));
  if (sharedMarkers.length) { score += 0.3; reasons.push(`shared identifier: ${sharedMarkers.join(', ')}`); }

  /* Geography and facilities come from the same extraction; they are
     scored together because a plant name and its city are usually both
     present and counting them twice would double-weight one fact. */
  const sharedNames = overlap(properNouns(aText), properNouns(bText));
  if (sharedNames.length >= 3) { score += 0.25; reasons.push(`shares ${sharedNames.length} named entities: ${sharedNames.slice(0, 5).join(', ')}`); }
  else if (sharedNames.length === 2) { score += 0.15; reasons.push(`shares 2 named entities: ${sharedNames.join(', ')}`); }
  else if (sharedNames.length === 1) { score += 0.05; reasons.push(`shares one named entity: ${sharedNames[0]}`); }

  const titleSim = similarity(tokenize(a.raw?.title || a.title), tokenize(b.raw?.title || b.title));
  if (titleSim >= 0.3) { score += 0.2; reasons.push(`titles ${(titleSim * 100).toFixed(0)}% similar`); }
  else if (titleSim >= 0.15) { score += 0.1; reasons.push(`titles ${(titleSim * 100).toFixed(0)}% similar`); }

  /* Same publisher running the same story twice is a stronger signal than
     two publishers converging on one; different feeds covering one event
     is normal and carries no information either way. */
  const aFeed = a.sourceFeed || a.source_feed;
  const bFeed = b.sourceFeed || b.source_feed;
  if (aFeed && aFeed === bFeed) { score += 0.05; reasons.push('same source feed'); }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

/* Above this, the pair is worth a person's attention. Chosen so that a
   shared incident identifier plus a shared place on the same day clears
   it, while two unrelated stories from one feed on one day do not. */
export const INCIDENT_FLAG_THRESHOLD = 0.55;

/* The best incident candidate for `candidate` among `existing`, or null.

   NEVER an auto-reject. An incident match is a hypothesis about the world
   ("these are two accounts of one event"), and the correct response to a
   hypothesis is to show it to somebody with its evidence attached. The
   return value is explicitly shaped for that: an id, a score, and the
   reasons in plain words. */
export function findIncidentMatch(candidate, existing, { threshold = INCIDENT_FLAG_THRESHOLD, windowDays = INCIDENT_WINDOW_DAYS } = {}) {
  let best = null;
  for (const prior of existing || []) {
    const { score, reasons } = incidentMatch(candidate, prior, { windowDays });
    if (score >= threshold && (!best || score > best.score)) {
      best = { id: prior.id, score, reasons, uncertain: true };
    }
  }
  return best;
}

/* The note written onto a flagged candidate. Spelled out rather than
   scored, because "0.72" tells a reviewer nothing they can act on. */
export function incidentNote(match) {
  if (!match) return null;
  return `Possibly the same incident as ${match.id} — ${match.reasons.join('; ')}. `
    + 'Not auto-rejected: confirm whether this is a separate event, a further report of the same one, '
    + 'or a recovery update. Several records of one incident each score independently through the '
    + 'noisy-OR and inflate the index.';
}
