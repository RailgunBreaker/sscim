// Shared by the server and browser. A URL is a citation, not verification.
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function sourceAvailable(source, asOf) {
  if (!validDate(asOf) || !source || source.claimStatus !== 'verified') return false;
  let url;
  try { url = new URL(source.url); } catch { return false; }
  return ['https:', 'http:'].includes(url.protocol) && Boolean(source.supportingSection)
    && validDate(source.publicationDate) && validDate(source.informationAvailableDate)
    && source.publicationDate <= asOf && source.informationAvailableDate <= asOf;
}

export function reviewedClaim(record, asOf) {
  return record?.claimStatus === 'verified' && validDate(record.review?.verifiedAt)
    && Boolean(record.review?.provenance) && sourceAvailable(record.source, asOf);
}
