// Evidence quoted by a model must exist in the fetched input. This checks
// traceability only; it does not certify the interpretation or its accuracy.
export function groundProposal(candidate, proposal) {
  if (!proposal || typeof proposal !== 'object') return null;
  const raw = candidate.raw || {};
  const text = [raw.title, raw.excerpt, raw.summary, raw.abstract, raw.content, raw.sourceText]
    .filter(v => typeof v === 'string').join('\n');
  const quote = typeof proposal.evidenceQuote === 'string' ? proposal.evidenceQuote.trim() : '';
  const matched = quote.length >= 20 && text.includes(quote);
  const observed = proposal.evidenceKind === 'observed';
  return { ...proposal,
    proposedOperational: proposal.proposedOperational === true && matched && observed,
    evidenceKind: ['observed', 'forecast', 'unknown'].includes(proposal.evidenceKind) ? proposal.evidenceKind : 'unknown',
    evidenceQuote: matched ? quote : null,
    evidenceStatus: matched ? 'quoted_input_requires_review' : 'missing_supporting_input',
    severityBasis: 'uncalibrated_ordinal',
    uncertainty: [proposal.uncertainty, !matched ? 'No matching source passage establishes the proposed operational claim.' : null,
      !observed ? 'The proposal does not identify an observed effect; forecasts and unknown evidence cannot enter factual scoring.' : null].filter(Boolean).join(' '),
  };
}
