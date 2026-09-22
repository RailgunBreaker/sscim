export default function PilotIntake({ workspace, busy, activate, review, openInvestigation, name }) {
  const p = workspace.protocol || workspace.proposedProtocol;
  if (!p) return null;
  const e = workspace.evaluation;
  return <section aria-label="Disclosure pilot">
    <h3>{p.name}</h3>
    <p>{p.objective}</p>
    <p>{p.companies.map(c => c.name).join(', ')}. {p.collectionScope}</p>
    {workspace.protocol ? <p>Activated {p.activatedAt}. Checkpoint {p.checkpointAt}. The 30-day checkpoint and 48-hour review target are pilot operating choices, not validated model thresholds.</p> : <>
      <p>Start with three source-linked historical investigations and a defined watchlist. Activation records the actual start time; existing evidence stays historical.</p>
      <button disabled={busy || Boolean(workspace.collection.error)} onClick={activate}>Activate disclosure pilot</button>
    </>}
    <details><summary>Pilot evaluation criteria</summary><ul>{p.criteria.map(c => <li key={c}>{c}</li>)}</ul><p>{p.limitation}</p></details>
    <p>Last collection run: {workspace.collection.checkedAt || 'Unavailable'}. Reload the workspace to read the latest collector output.</p>
    {workspace.collection.error && <p role="alert">{workspace.collection.error} Stored reviews remain visible; intake coverage cannot be assessed.</p>}
    <details><summary>Collection coverage ({workspace.collection.checks.length} checks)</summary>
      <p>Retrieval and keyword matching do not establish that a filing contains every relevant incident. Unmatched filings require an independent audit before estimating recall.</p>
      {workspace.collection.checks.map((c, i) => <p key={i}>{name(c.companyId)}: {c.status} — <a href={c.url} target="_blank" rel="noreferrer">{c.publicationDate || 'Reference document'}</a>; {c.candidateId ? 'candidate matched' : 'no candidate recorded'}.</p>)}
      <p>{workspace.collectionHistory.length} collection snapshots retained in the private export, including unmatched filings and retrieval failures.</p>
    </details>
    <h3>Filing review queue</h3>
    <p>{e.triaged} of {e.candidates} current source revisions triaged; {e.pending} pending, {e.deferred} deferred, {e.overdue} overdue. {e.triagedWithinTarget} triaged within the review target, measured from entry into this workspace.</p>
    <p>{e.historical} historical or backfilled documents; {e.newlyPublished} newly published after activation. Prediction accuracy, incident recall and operational benefit remain unmeasured.</p>
    {workspace.queue.map(c => <article className="pilot-card" key={c.id}>
      <b>{name(c.companyId)} — {c.publicationDate}</b>
      <p><a href={c.sourceUrl} target="_blank" rel="noreferrer">Open source document</a>. {c.cohort === 'historical_or_backfill' ? 'Historical / backfill' : 'New publication after activation'}; {c.status}{c.overdue ? ' — overdue' : ''}.</p>
      {c.excerpt && <p>Collector excerpt: “{c.excerpt}”</p>}
      {c.finding && <p>Historical source review (may refer to an earlier revision): {c.finding}</p>}
      <p><small>First collected: {c.firstSeenAt || 'Unknown'}. Entered this workspace: {c.queuedAt || 'Pilot not activated'}. Prior source reviews do not count as pilot decisions.</small></p>
      {!c.current && <p>Source is absent from the current intake. Previous evidence and decisions are retained; review is unavailable until collection succeeds.</p>}
      {c.lastDecision && <p>Decision recorded {c.lastDecision.reviewedAt}: {c.lastDecision.reason}</p>}
      {c.lastDecision?.investigationId && <button onClick={() => openInvestigation(c.companyId, c.lastDecision.investigationId)}>Open linked investigation</button>}
      {workspace.protocol && c.current && <form className="pilot-form" key={`${c.revision}-${c.reviewCount}`} onSubmit={event => {
        event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget));
        review({ candidateId: c.id, revision: c.revision, expectedReviews: c.reviewCount, ...v });
      }}>
        <label>Review decision<select name="decision" defaultValue="defer"><option value="defer">Defer — more evidence needed</option><option value="investigate">Investigate — link or open a case</option><option value="dismiss">Dismiss — explain why out of scope</option></select></label>
        <label>Decision reason<textarea name="reason" required maxLength={2000} placeholder="Explain the source finding and the next question or exclusion reason" /></label>
        <button disabled={busy}>Save review decision</button>
      </form>}
    </article>)}
    <details><summary>Review history ({workspace.reviews.length})</summary>
      {workspace.reviews.map(r => <p key={r.requestId}>{r.reviewedAt}: {name(r.source.companyId)}, {r.decision} — {r.reason}. Source revision {r.revision.slice(0, 12)}. Operator decision; not an independent outcome label.</p>)}
    </details>
  </section>;
}
