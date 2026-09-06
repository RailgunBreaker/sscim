export const FACILITY_EVIDENCE = {
  tsmc_fab18: {
    claimStatus: 'verified_scoped', claim: 'Fab 18 in the Southern Taiwan Science Park produces 5nm and 3nm process technology; 3nm volume production announced December 29, 2022.',
    url: 'https://pr.tsmc.com/system/files/newspdf/attachment/e588c2da1b748b4aa734b13128cc330fcbc5ce9d/1229%20TSMC%203nm%20Ceremony%20%28E%29_10_wmn.pdf',
    publisher: 'TSMC', documentIdentifier: 'TSMC 3nm Volume Production and Capacity Expansion Ceremony, 2022-12-29', supportingSection: 'Page 1, paragraphs 1–2', publicationDate: '2022-12-29',
    verifiedAt: '2026-09-06', reviewerProvenance: 'Codex source review; not human sign-off',
    limitations: 'Current capacity, precise coordinates, start-year interpretation and site-to-site shipments are not verified by this source. Scale remains analyst ordinal.',
  },
  asml_veldhoven: {
    claimStatus: 'verified_scoped', claim: 'Veldhoven factories assemble EUV and DUV lithography systems.',
    url: 'https://www.asml.com/en/careers/teams/manufacturing', publisher: 'ASML', documentIdentifier: 'Manufacturing – Teams', supportingSection: 'Jobs in our main manufacturing sites — Veldhoven; Inside our Veldhoven cleanroom factory', publicationDate: null,
    verifiedAt: '2026-09-06', reviewerProvenance: 'Codex source review; not human sign-off',
    limitations: 'Undated current page, not a point-in-time operating vintage. Capacity, coordinate precision, metrology allocation and any particular downstream fab shipment remain unverified. Scale remains analyst ordinal.',
  },
};
