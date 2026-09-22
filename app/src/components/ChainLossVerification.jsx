export default function ChainLossVerification({ report }) {
  if (!report?.duplicateCharge || !report?.recoveryCheck) return <p>Chain-wide verification results are unavailable.</p>;
  const check = report.recoveryCheck, duplicate = report.duplicateCharge;
  const kioxia = report.kioxiaCheck;
  const operations = report.operationalCheck;
  const chargePeriods = report.chargePeriodCheck, historical = report.historicalRecoveryCheck;
  const photoresist = report.photoresistCheck;
  const producer = report.producerScope, sales = producer?.salesContext;
  const customers = report.customerEvidence;
  const counterparty = customers?.counterpartyCheck;
  return <section aria-label="Chain-wide loss verification">
    <h2>Chain-wide loss verification</h2>
    <p>2022 NAND contamination: <b>whole-chain loss remains unverified</b>. Checks through {report.asOf}.</p>
    <div className="evidence-table"><table><thead><tr><th>Check</th><th>Result</th><th>Meaning</th></tr></thead><tbody>
      <tr><td>Repeated WDC charge</td><td>{duplicate.status.replaceAll('_',' ')}</td><td>{duplicate.acceptedCharge == null ? 'Charge blocked pending reconciliation' : `${duplicate.acceptedCharge} USD million counted once across ${duplicate.representations.length} representations`}</td></tr>
      {chargePeriods && <tr><td>WDC charge timing</td><td>{chargePeriods.status.replaceAll('_',' ')}</td><td>{chargePeriods.nineMonths?.value ?? 'Unknown'} + {chargePeriods.finalQuarter?.value ?? 'Unknown'} = {chargePeriods.annualValue ?? 'Unknown'} USD million; first nine months plus final quarter</td></tr>}
      <tr><td>Recovery amount cross-check</td><td>{check.status.replaceAll('_',' ')}</td><td>{check.insurerQuarter?.value ?? 'Unknown'} + {check.unassignedQuarter?.value ?? 'Unknown'} = {check.nineMonths?.value ?? 'Unknown'} USD million; annual reported recovery {check.annualRecovery ?? 'Unknown'} USD million</td></tr>
      <tr><td>Selected company net charge</td><td>{report.selectedNetCharge == null ? 'Unavailable' : `${report.selectedNetCharge} USD million`}</td><td>{report.selectedNetLabel}</td></tr>
      <tr><td>Material-supplier allocation</td><td>Unknown</td><td>{check.quarterReceiptEvidence ? 'Receipt in the March 2024 quarter is reported. Payer identity, cash amount and settlement details remain unspecified.' : 'The USD 1 million quarter recovery has no verified receipt details or counterparty identity.'}</td></tr>
    </tbody></table></div>
    <p>{check.limitation}</p>
    {producer && <details aria-label="Producer cost boundaries"><summary>What the producer charges cover</summary>
      <p>{producer.limitation} The amounts below describe the existing charges; they are not additional losses.</p>
      {producer.costAccounts.length === 0 && <p>Cost classifications are unavailable or could not be matched to the reviewed charges.</p>}
      {producer.costAccounts.map(r => <div key={r.id}><h4>{r.companyId.toUpperCase()}: {r.value} {r.units}</h4>
        <p>{r.periodStart} to {r.periodEnd}; recorded in {r.accountingLine.replaceAll('_', ' ')}. <a href={r.source.url} target="_blank" rel="noreferrer">Cost classification disclosure</a></p>
        {r.components.length > 0 ? <ul>{r.components.map(c => <li key={c.id}>{c.label}: amount undisclosed</li>)}</ul> : <p>No component amounts disclosed in this source.</p>}
        <p>{r.limitation}</p>
      </div>)}
      {producer.otherCauseCosts.length > 0 && <><h4>Later utilization costs excluded from this incident</h4>
        {producer.otherCauseCosts.map(r => <p key={r.id}>{r.periodStart} to {r.periodEnd}: <b>{r.value} {r.units}</b>. {r.interpretation} <a href={r.source.url} target="_blank" rel="noreferrer">Demand-related utilization disclosure</a></p>)}
      </>}
    </details>}
    {chargePeriods && <details><summary>Verify the annual charge by accounting period</summary><p>{chargePeriods.limitation}</p>
      {[chargePeriods.nineMonths, chargePeriods.finalQuarter].filter(Boolean).map(r => <p key={r.id}>{r.periodStart} to {r.periodEnd}: {r.value} {r.units}. <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.supportingSection}</a></p>)}
    </details>}
    {historical && <details><summary>Sandisk historical recovery: excluded from additional payments</summary>
      <p>{historical.status.replaceAll('_', ' ')}. {historical.limitation}</p>
      {historical.historicalDisclosure && <p>{historical.historicalDisclosure.value} USD million for {historical.historicalDisclosure.periodStart} to {historical.historicalDisclosure.periodEnd}. <a href={historical.historicalDisclosure.source.url} target="_blank" rel="noreferrer">Historical insurer recovery and pre-separation accounting</a></p>}
    </details>}
    {check.quarterReceiptEvidence && <p>{check.quarterReceiptEvidence.interpretation} <a href={check.quarterReceiptEvidence.source.url} target="_blank" rel="noreferrer">WDC receipt disclosure, October 2024</a></p>}
    {operations && <div aria-label="Production loss evidence">
      <h3>Flash availability and downstream loss</h3>
      <div className="evidence-table"><table><thead><tr><th>Published</th><th>WDC availability forecast</th><th>Evidence status</th></tr></thead><tbody>
        {operations.availabilityHistory.map(r => <tr key={r.id}><td><a href={r.source.url} target="_blank" rel="noreferrer">{r.source.publicationDate}</a></td>
          <td>{r.qualifier === 'at_least' ? 'At least' : 'Approximately'} {r.value} {r.units}</td>
          <td>{r.id === operations.selectedAvailabilityForecast?.id ? 'Latest eligible issuer forecast' : 'Earlier or unreconciled forecast'}; final measured loss unavailable</td></tr>)}
      </tbody></table></div>
      <p>{operations.limitation}</p>
      {operations.restoration && <p>Normal operations resumed in {operations.restoration.reportedTiming}; shipment impacts were still expected. {operations.restoration.interpretation} <a href={operations.restoration.source.url} target="_blank" rel="noreferrer">Kioxia production update</a></p>}
      {sales && <details aria-label="Kioxia sales attribution"><summary>Kioxia sales after the disruption</summary>
        {[sales.before, sales.after].filter(Boolean).map(r => <p key={r.id}>{r.periodStart} to {r.periodEnd}: <b>{r.value} {r.units}</b> in company sales. <a href={r.source.url} target="_blank" rel="noreferrer">Reported sales</a></p>)}
        <p>Quarter-to-quarter change: {sales.change == null ? 'Unavailable' : `${sales.change} ${sales.units}`}. {sales.limitation}</p>
        {sales.attribution && <><p>The issuer identifies both contamination and COVID-19 interruptions at assembly, testing and logistics providers.</p>
          <p>Reported bit growth: {sales.attribution.reportedBitGrowth}; yen selling-price growth: {sales.attribution.reportedYenAspGrowth}. The issuer reports qualitative ranges. {sales.attribution.priceContext} <a href={sales.attribution.source.url} target="_blank" rel="noreferrer">Shipment and pricing explanation</a></p></>}
        <p>Incident-only sales loss and downstream customer loss: unknown.</p>
      </details>}
      {(report.productEvidence || []).length > 0 && <details><summary>Observed effects on enterprise SSD sales</summary>
        {report.productEvidence.map(r => <p key={r.id}>{r.periodStart} to {r.periodEnd}: {r.value != null && <b>{r.value}% year-over-year growth. </b>}{r.interpretation} <a href={r.source.url} target="_blank" rel="noreferrer">Product revenue disclosure</a></p>)}
        <p>These are WDC product revenues. Lost output and financial losses at external customers remain unquantified; later growth does not establish complete catch-up.</p>
      </details>}
      {operations.mixedAdjustmentForecast && <details><summary>Financial outlook excluded from contamination-only validation</summary>
        <p>{operations.mixedAdjustmentForecast.lower}–{operations.mixedAdjustmentForecast.upper} {operations.mixedAdjustmentForecast.units}, quarter ending {operations.mixedAdjustmentForecast.periodEnd}: stock compensation, contamination charges and other adjustments. {operations.excludedComparison} <a href={operations.mixedAdjustmentForecast.source.url} target="_blank" rel="noreferrer">Outlook footnote</a></p>
      </details>}
    </div>}
    {kioxia && <>
      <h3>Kioxia charge and insurance recovery</h3>
      <div className="evidence-table"><table><thead><tr><th>Company account</th><th>Reported amount</th><th>Verification</th></tr></thead><tbody>
        <tr><td>FY2021 contamination charge</td><td>{kioxia.charge?.value ?? 'Unknown'} JPY billion</td><td>{kioxia.chargeStatus.replaceAll('_', ' ')}</td></tr>
        <tr><td>FY2023 insurance income</td><td>{kioxia.preciseRecovery?.value ?? 'Unknown'} JPY billion</td><td>{kioxia.status.replaceAll('_', ' ')}; earlier disclosure {kioxia.roundedRecovery?.value ?? 'Unknown'} JPY billion. {kioxia.recoveriesCounted === 1 ? 'Counted once.' : 'Recovery reconciliation blocked.'}</td></tr>
        <tr><td>Selected Kioxia net charge</td><td>{kioxia.selectedNetCharge == null ? 'Unavailable' : `Approximately ${kioxia.selectedNetCharge} JPY billion`}</td><td>{kioxia.netLabel}</td></tr>
      </tbody></table></div>
      <p>FY2021 ended March 31, 2022; FY2023 ended March 31, 2024. The insurance adjustment excludes sales-related and other impacts. Supplier reimbursement and final settlement remain unknown.</p>
      {[kioxia.charge, kioxia.preciseRecovery, kioxia.roundedRecovery].filter(Boolean).map(r => <p key={r.id}>
        {r.periodStart} to {r.periodEnd}: <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.supportingSection}</a>
      </p>)}
      {kioxia.roundingRange && <details><summary>Precision of the selected Kioxia net charge</summary>
        <p>{kioxia.roundingRange.lower} to {kioxia.roundingRange.upper} JPY billion. {kioxia.roundingLimitation}</p>
      </details>}
    </>}
    {(report.unattributedRecoveries || []).length > 0 && <div aria-label="Unassigned insurance evidence">
      <h3>Later insurance income awaiting incident attribution</h3>
      <p>These company totals are excluded from the contamination account. Their publication does not establish a further incident recovery or a final settlement.</p>
      <div className="evidence-table"><table><thead><tr><th>Period</th><th>Insurance income</th><th>Attribution</th></tr></thead><tbody>
        {report.unattributedRecoveries.map(r => <tr key={r.id}><td>{r.periodStart} to {r.periodEnd}</td><td>{r.value.toLocaleString('en-US')} {r.units}</td>
          <td>Incident unspecified. <a href={r.source.url} target="_blank" rel="noreferrer">Note 24, published {r.source.publicationDate}</a></td></tr>)}
      </tbody></table></div>
    </div>}
    {(report.boundaryEvidence || []).map(r => <div key={r.id}>
      <h3>Joint-venture accounting boundary</h3>
      <p>Kioxia equity interest: {r.equityShare * 100}%; recognized share of the ventures' accounts: {r.recognizedAccountShare * 100}%. {r.accountingTreatment}</p>
      <p>{r.transactionPath}</p><p>{r.limitation} <a href={r.source.url} target="_blank" rel="noreferrer">Joint-venture disclosure</a></p>
    </div>)}
    {(report.governanceEvidence || []).map(r => <p key={r.id}>Joint-venture governance at {r.asOfDate}: Kioxia holds {(r.votingRightsShare * 100).toFixed(1)}% of voting rights; decisions are shared equally with Sandisk. {r.interpretation} <a href={r.source.url} target="_blank" rel="noreferrer">Note 31</a></p>)}
    {(report.periodObservations || []).map(r => <p key={r.id}>{r.companyId.toUpperCase()}, {r.periodStart} to {r.periodEnd}: the charge row shows "{r.reportedSymbol}". {r.interpretation} <a href={r.source.url} target="_blank" rel="noreferrer">Period disclosure</a></p>)}
    <h3>Recovery disclosures</h3>
    {[check.insurerQuarter,check.unassignedQuarter,check.nineMonths].filter(Boolean).map(r => <p key={r.id}>
      {r.periodStart} to {r.periodEnd}: <b>{r.value} {r.units}</b> · {r.counterpartyClass.replaceAll('_',' ')}. <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.supportingSection}</a>
    </p>)}
    <details><summary>Inspect duplicate records and combinations excluded from totals</summary>
      {duplicate.representations.map(r => <p key={r.dataset}>{r.dataset}: {r.value ?? 'Unavailable'} USD million. <a href={r.sourceUrl} target="_blank" rel="noreferrer">Original charge disclosure</a></p>)}
      <ul>{report.excludedCombinations.map(text => <li key={text}>{text}</li>)}</ul>
    </details>
    {photoresist && <div aria-label="TSMC photoresist loss verification">
      <h3>TSMC 2019 photoresist: forecast and reported impact</h3>
      <p>Q1 incident margin effect: forecast {photoresist.marginForecast?.value ?? 'Unknown'}, subsequently reported {photoresist.marginReported?.value ?? 'Unknown'} percentage points. {photoresist.status.replaceAll('_', ' ')}.</p>
      <p>{photoresist.comparisonLimitation}</p>
      <details><summary>Inspect TSMC revenue timing and margin evidence</summary>
        <div className="evidence-table"><table><thead><tr><th>Measure</th><th>Amount</th><th>Evidence</th></tr></thead><tbody>
          {[
            ['Q1 revenue shortfall forecast', photoresist.revenueShortfallForecast],
            ['Q2 replacement revenue forecast', photoresist.replacementRevenueForecast],
            ['Q1 uplift forecast: pull-in and demand combined', photoresist.mixedRevenueUpliftForecast],
            ['Q1 incident margin forecast', photoresist.marginForecast],
            ['Q1 incident margin: retrospective issuer attribution', photoresist.marginReported],
            ['Q2 incident margin improvement forecast', photoresist.q2MarginForecast],
            ['Q2 total margin change: incident and currency effects', photoresist.q2MixedMarginReported],
            ['Q1 recognized accounting charge', photoresist.recognizedCharge],
          ].map(([label, r]) => <tr key={label}><td>{label}</td><td>{r ? `${r.qualifier === 'approximately' ? 'About ' : ''}${r.value.toLocaleString()} ${r.units}` : 'Unavailable'}</td>
            <td>{r && <><a href={r.source.url} target="_blank" rel="noreferrer">{r.source.publicationDate}</a><br />{r.periodStart} to {r.periodEnd}</>}</td></tr>)}
        </tbody></table></div>
        <p>{photoresist.lossLimitation}</p>
      </details>
      <p>Realized replacement sales, supplier reimbursement and downstream customer losses remain unknown. The forecast does not establish zero permanent loss.</p>
    </div>}
    {customers && <div aria-label="Customer trading evidence">
      <h3>Disclosed trading partners for loss follow-up</h3>
      <p>{customers.limitation}</p>
      {!customers.transactions.length && <p>No eligible customer transaction evidence is available for this review date.</p>}
      {customers.transactions.map(r => <div key={r.id}>
        <h4>{r.supplierName} → {r.customerName}</h4>
        <p>{r.periodStart} to {r.periodEnd}: <b>{r.value.toLocaleString('en-US')} {r.units}</b>; {r.sharePercent}% of {r.shareBasis.toLowerCase()} as reported, rounded to whole percentages.</p>
        <p>{r.productScope}. A supplying plant and affected shipments are unknown. <a href={r.source.url} target="_blank" rel="noreferrer">Transaction disclosure</a></p>
      </div>)}
      {customers.transactions.some(r => r.transactionType === 'sale') && <p>Sales shown in parentheses in the source are displayed as positive transaction amounts. They are not losses or reimbursements and are not subtracted from purchases.</p>}
      {counterparty && <details aria-label="Buyer seller reconciliation"><summary>Compare Phison sales with Apacer purchases</summary>
        <p>Buyer reporting scopes: {counterparty.groupStatus.replaceAll('_', ' ')}. Counterparty comparison: {counterparty.counterpartyStatus.replaceAll('_', ' ')}.</p>
        {[counterparty.parent, counterparty.subsidiary, counterparty.group].filter(Boolean).map(r => <p key={r.id}>
          {r.buyerScopeLabel}: <b>{r.value.toLocaleString('en-US')} {r.units}</b>. <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.supportingSection}</a>
        </p>)}
        {counterparty.groupResidual !== null && <p>Group less parent and subsidiary purchases: {counterparty.groupResidual.toLocaleString('en-US')} {counterparty.units}. The group total includes these component rows.</p>}
        {counterparty.consolidation && <p>UD INFO entered Apacer consolidation on {counterparty.consolidation.consolidationStartDate}. {counterparty.consolidation.limitation} <a href={counterparty.consolidation.source.url} target="_blank" rel="noreferrer">Consolidation date disclosure</a></p>}
        {counterparty.parentNote && <p>Parent-only note: {counterparty.parentNote.value.toLocaleString('en-US')} {counterparty.units}; {counterparty.parentStatus.replaceAll('_', ' ')}. <a href={counterparty.parentNote.source.url} target="_blank" rel="noreferrer">Corroborating note, counted once</a></p>}
        {counterparty.seller && <p>Phison-reported sales to Apacer: {counterparty.seller.value.toLocaleString('en-US')} {counterparty.units}. <a href={counterparty.seller.source.url} target="_blank" rel="noreferrer">Seller disclosure</a></p>}
        <p>Seller sales less buyer parent purchases: {counterparty.sellerMinusBuyer === null ? 'Unavailable' : `${counterparty.sellerMinusBuyer.toLocaleString('en-US')} ${counterparty.units}`}. Explanation: unverified. Loss attributable to this difference: unknown.</p>
        <p>{counterparty.limitation}</p>
      </details>}
      {customers.supplierAssessment && <p>{customers.supplierAssessment.assessment} {customers.supplierAssessment.limitation} <a href={customers.supplierAssessment.source.url} target="_blank" rel="noreferrer">Supplier-risk discussion</a></p>}
      {customers.inventoryCheck && <details aria-label="Customer inventory costs"><summary>Inventory expenses awaiting incident attribution</summary>
        <p>{customers.inventoryCheck.limitation}</p>
        {!customers.inventoryCheck.scopes.length && <p>No eligible inventory expense evidence is available for this review date.</p>}
        {customers.inventoryCheck.scopes.map(s => <div key={s.scopeId}>
          <h4>{(s.current || s.prior).scopeLabel}</h4>
          {[['2022', s.current], ['2021', s.prior]].map(([year, r]) => <p key={year}>{year}: {r ? <><b>{r.value.toLocaleString('en-US')} {r.units}</b> — {r.sourceMetric}. <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.supportingSection}</a></> : 'Unavailable'}</p>)}
        </div>)}
        <p>Inventory expense attributable to contamination: unknown. Excluded from incident totals and model calibration.</p>
        <p>Evidence needed: {customers.inventoryCheck.nextEvidence}</p>
      </details>}
      <p>Downstream incident loss and affected-customer coverage: unknown.</p><p>Next evidence needed: {customers.nextEvidence}</p>
    </div>}
    <h3>Still needed to close the chain-wide account</h3>
    {report.completionRequirements?.length > 0 ? <div aria-label="Chain loss completion requirements">
      <p>{report.completionOutlook}</p>
      {report.completionRequirements.map(r => <div key={r.id}><h4>{r.scope}: {r.status}</h4><p>{r.needed}</p><p>Evidence to obtain: {r.likelySource}.</p><p>{r.blocks}</p></div>)}
    </div> : <ul>{report.unresolved.map(text => <li key={text}>{text}</li>)}</ul>}
    <details><summary>Reviewed filings and verification findings</summary>{report.documents.map(d => <p key={d.id}><a href={d.url} target="_blank" rel="noreferrer">{d.id.replaceAll('_',' ')} · Published {d.publicationDate}</a><br />{d.finding}{d.limitation && <><br />{d.limitation}</>}{d.retrievalStatus === 'reviewed_archive_network_unavailable' && <><br />Reviewed archived copy; latest retrieval unavailable.</>}</p>)}</details>
  </section>;
}
