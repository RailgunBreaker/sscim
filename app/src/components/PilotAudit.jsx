import { useState } from 'react';
const percent = v => v == null ? 'Not available' : `${(v * 100).toFixed(1)}%`;
function ReviewHandoff({ batch, download, previewResponse, importResponse, busy }) {
  const [response, setResponse] = useState(null), [preview, setPreview] = useState(null);
  const [error, setError] = useState(''), [working, setWorking] = useState(false);
  async function perform(action) {
    setWorking(true); setError('');
    try { await action(); } catch (e) { setError(e.message); }
    finally { setWorking(false); }
  }
  return <details><summary>External reviewer handoff</summary>
    <p>Download a package containing the rubric, frozen sources and a blank response template. It omits detector results, AI drafts, prior judgments and the historical control. Nothing is sent to another person automatically.</p>
    <button disabled={busy || working} onClick={() => perform(() => download(batch.id))}>Download reviewer package</button>
    <p>The reviewer should return only the completed response template as JSON and disclose any AI assistance. Upload that response here to check it before importing.</p>
    <label className="pilot-form">Completed reviewer response<input type="file" accept=".json,application/json" disabled={busy || working} onChange={e => {
      const file = e.target.files?.[0]; setResponse(null); setPreview(null); setError('');
      if (!file) return;
      perform(async () => {
        if (file.size > 1000000) throw new Error('Return only the completed response template, under 1 MB, without the source package.');
        const parsed = JSON.parse(await file.text());
        if (parsed.batchId !== batch.id) throw new Error('This response belongs to another audit.');
        setResponse({ ...parsed, requestId: crypto.randomUUID() });
      });
    }} /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy || working || !response} onClick={() => perform(async () => setPreview(await previewResponse(response)))}>Preview reviewer response</button>
    {preview && <>
      <p>{preview.count} judgments checked. {preview.rows.filter(r => r.qualifiesForCensusScoring).length} meet the declared external-review requirements. Preview has not changed the audit.</p>
      <ul>{preview.rows.map(r => <li key={r.caseId}>{batch.cases.find(c => c.id === r.caseId)?.companyId}, {batch.cases.find(c => c.id === r.caseId)?.publicationDate}: {r.label.replaceAll('_', ' ')} — {r.reviewerId}, {r.reviewerKind.replaceAll('_', ' ')}.</li>)}</ul>
      <button disabled={busy || working || preview.alreadyImported} onClick={() => perform(async () => {
        if (await importResponse(response)) { setPreview(null); setResponse(null); }
      })}>Import reviewed response</button>
      <p>Import records the submitted provenance. It does not authenticate a reviewer's identity or independence.</p>
    </>}
    {(batch.importHistory || []).map(r => <p key={r.requestId}>Imported {r.count} judgments on {r.recordedAt}; earlier case revisions remain in judgment history.</p>)}
  </details>;
}
function AuditCase({ batch, item, name, label, loadSource, busy }) {
  const [source, setSource] = useState(null), [sourceError, setSourceError] = useState(''), [loading, setLoading] = useState(false);
  const previous = batch.labels.filter(r => r.caseId === item.id).at(-1);
  const draft = batch.screeningDrafts?.find(r => r.caseId === item.id);
  return <details className="pilot-card"><summary>{name(item.companyId)} — {item.publicationDate || 'Discovery unavailable'}{item.control ? ' (historical control)' : ''} — {previous ? previous.label.replaceAll('_', ' ') : 'awaiting review'}</summary>
    <p>{item.form || 'Filing discovery'}; {item.cohort.replaceAll('_', ' ')}. {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Publisher source</a>}</p>
    {draft && <details open><summary>AI screening draft — not a saved judgment</summary>
      <p>Prepared {draft.preparedAt}. Proposed classification: {draft.proposedLabel.replaceAll('_', ' ')}.</p>
      <p>{draft.rationale}</p><p>Review scope: {draft.evidenceSection}</p>
      {draft.quote && <blockquote>{draft.quote}</blockquote>}
      <p>This draft is excluded from judgment counts and accuracy calculations. Review the frozen source before recording a judgment.</p>
    </details>}
    {item.sourceSha256 && item.status === 'retrieved' ? <>
      <button disabled={loading || busy} onClick={async () => {
        setLoading(true); setSourceError('');
        try { setSource(await loadSource(batch.id, item.id)); } catch (e) { setSourceError(e.message); }
        finally { setLoading(false); }
      }}>{loading ? 'Loading source…' : 'Read frozen source'}</button>
      {sourceError && <p role="alert">{sourceError}</p>}
      {source && <details open><summary>Archived filing text</summary><p>Fingerprint: {source.sourceSha256}. This is normalized text; consult the publisher for original table layout.</p><textarea aria-label="Archived filing text" readOnly value={source.text} style={{ width: '100%', minHeight: 260 }} /></details>}
      {previous && <p>Latest judgment by {previous.reviewerId}, {previous.reviewerKind.replaceAll('_', ' ')}; recorded {previous.recordedAt}. {previous.rationale}</p>}
      {previous && <details><summary>Evidence and review provenance</summary>
        <p>Sections reviewed: {previous.evidenceSection}</p>
        {previous.quote && <blockquote>{previous.quote}</blockquote>}
        <p>Review reference: {previous.reportReference || 'None supplied'}. Source integrity verified when recorded: {previous.sourceIntegrityVerified ? 'yes' : 'no'}.</p>
        <p>Reviewer independence: {previous.independenceDeclared ? 'declared by the operator' : 'not declared'}; not authenticated by this workspace.</p>
      </details>}
      <form className="pilot-form" key={previous?.version || 0} onSubmit={e => {
        e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget));
        label({ ...v, independenceDeclared: v.independenceDeclared === 'on', batchId: batch.id, caseId: item.id,
          sourceSha256: item.sourceSha256, expectedVersion: previous?.version || 0 });
      }}>
        <label>Source judgment<select name="label" defaultValue="uncertain"><option value="uncertain">Uncertain — leave unresolved</option><option value="relevant">Relevant incident and consequence</option><option value="not_relevant">Does not meet the rubric</option></select></label>
        <label>Reviewer identity<input name="reviewerId" required maxLength={150} /></label>
        <label>Review origin<select name="reviewerKind" defaultValue="operator_human"><option value="operator_human">Workspace operator</option><option value="ai_assisted">AI or AI-assisted review</option><option value="external_human">External human review</option></select></label>
        <label>Review report reference<input name="reportReference" maxLength={500} placeholder="Required for an independence declaration" /></label>
        <label><input name="independenceDeclared" type="checkbox" style={{ width: 'auto', justifySelf: 'start' }} />The external reviewer declares independence from building or tuning this detector.</label>
        <label>Sections reviewed<input name="evidenceSection" required maxLength={1000} placeholder="Include sections checked for incident and consequence" /></label>
        <label>Supporting source text<textarea name="quote" maxLength={2000} placeholder="Required for relevant judgments; copy from the frozen source" /></label>
        <label>Judgment rationale<textarea name="rationale" required maxLength={2000} placeholder="Explain how both rubric conditions are met, or what was checked before excluding this filing" /></label>
        <button disabled={busy || !source}>Save source judgment</button>
      </form>
      {!source && <p>Read the frozen source before recording a judgment.</p>}
    </> : <p>The run did not retain a reviewable source. This case remains in the denominator and prevents complete-run scoring.</p>}
    <details><summary>Frozen detector result</summary><p>{item.matched == null ? 'Unavailable' : item.matched ? 'Matched' : 'Unmatched'}. This result is fixed for this audit.</p></details>
  </details>;
}
export default function PilotAudit({ workspace, busy, freeze, label, loadSource, name, downloadHandoff, previewResponse, importResponse }) {
  if (!workspace.protocol) return null;
  const runs = workspace.collectionHistory.filter(r => r.detectorSha256 && r.detectorVersion);
  return <section aria-label="Filing accuracy audit"><h3>Filing accuracy audit</h3>
    <p>Review every filing in a frozen collection run, including unmatched filings. Historical positive controls are kept separate. Source judgments do not establish monetary loss or validate a forecast.</p>
    {runs.length ? <form className="pilot-form" onSubmit={e => { e.preventDefault(); freeze(new FormData(e.currentTarget).get('collectionDigest')); }}>
      <label>Collection run<select name="collectionDigest" defaultValue={runs.at(-1).digest}>{[...runs].reverse().map(r => <option key={r.digest} value={r.digest}>{r.checkedAt} — {r.checks.length} checks</option>)}</select></label>
      <button disabled={busy}>Freeze audit census</button>
    </form> : <p>The next filing collection must archive both matched and unmatched sources before an audit can be frozen.</p>}
    {(workspace.audits || []).map(batch => <details className="pilot-card" key={batch.id} open>
      <summary>Audit of {batch.collectedAt} — {batch.score.total} filings, {batch.score.controls} controls</summary>
      <p>Frozen {batch.createdAt}; detector {batch.detectorVersion}. Later collection and detector changes cannot overwrite this census.</p>
      <p><strong>Stage: {batch.score.complete ? 'census review complete' : 'external review pending'}.</strong> {batch.score.complete
        ? 'The collected filing census can be assessed against its declared external reviews. This does not complete predictive validation.'
        : `Completion requires ${batch.score.externalReviewNeeded ?? batch.score.total - batch.score.qualified} more conclusive, source-backed external reviews, resolution of uncertain judgments, and a final results check.`}</p>
      <ReviewHandoff batch={batch} busy={busy} download={downloadHandoff} previewResponse={previewResponse} importResponse={importResponse} />
      <details><summary>Review rubric</summary><p>{batch.rubric.relevant}</p><p>{batch.rubric.notRelevant}</p><p>{batch.rubric.uncertain}</p><p>{batch.rubric.method}</p></details>
      <p>{batch.score.labeled}/{batch.score.total} filings labeled; {batch.score.qualified} have declared external reviews with verified source integrity. {batch.score.uncertain} uncertain; {batch.score.unavailable} unavailable.</p>
      {batch.screeningDrafts?.length > 0 && <p>{batch.screeningDrafts.length} AI screening drafts available. Drafts are not saved judgments and do not reduce the external review requirement.</p>}
      {batch.screeningDraftError && <p role="alert">{batch.screeningDraftError}</p>}
      {batch.score.reviewOrigins && <>
        <p>{batch.score.reviewOrigins.ai_assisted} AI-assisted, {batch.score.reviewOrigins.operator_human} operator and {batch.score.reviewOrigins.external_human} external human judgments. {batch.score.externalReviewNeeded} filings still need a qualifying external review.</p>
        <p>Current judgments: {batch.score.judgments.relevant} relevant, {batch.score.judgments.not_relevant} outside this rubric, {batch.score.judgments.uncertain} uncertain. These counts exclude the historical control.</p>
        {batch.score.labeled > 0 && batch.score.judgments.relevant === 0 && <p>No positive filing has been identified in these judgments. This set currently cannot establish sensitivity to relevant disclosures; absence of a finding does not establish zero loss.</p>}
      </>}
      <p>Agreement: {percent(batch.score.accuracy)}. Precision: {percent(batch.score.precision)}. Recall within this census: {percent(batch.score.recall)}.</p>
      {!batch.score.complete && <p>Scores remain unavailable until every non-control filing has a conclusive, source-backed, declared external human review.</p>}
      <p>{batch.score.qualification}</p>
      {batch.score.confusion && <p>True positives: {batch.score.confusion.truePositive}; false positives: {batch.score.confusion.falsePositive}; true negatives: {batch.score.confusion.trueNegative}; false negatives: {batch.score.confusion.falseNegative}.</p>}
      {batch.cases.map(item => <AuditCase key={item.id} batch={batch} item={item} name={name} label={label} loadSource={loadSource} busy={busy} />)}
      <details><summary>Judgment history ({batch.labels.length})</summary>{batch.labels.map(r => <p key={r.requestId}>{r.recordedAt}: {r.reviewerId} — {r.label}; revision {r.version}. {r.rationale}</p>)}</details>
    </details>)}
  </section>;
}
