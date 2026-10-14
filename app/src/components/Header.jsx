import { useMemo, useState, useRef, useEffect } from 'react';
import { C } from '../theme.js';
import { color, space, font, radius, typeStyle, tabular } from '../ui/tokens.js';
import { Button, IconButton, StatusBadge } from '../ui/primitives.jsx';
import { t } from '../i18n/index.js';
import { useVault } from '../data/VaultContext.jsx';
import { MODEL_VERSION } from '../engine/registry.js';
import SearchBox from './SearchBox.jsx';
import Freshness from './Freshness.jsx';

/* The header used to carry, in order: the logo, a build label reading
   "v4 · OSM MAP · COMPANY SPREAD", the full product name, three unlabelled
   counts, a host-only count, the dataset date, a freshness string, four
   language buttons, search, and three actions — twelve things competing at
   10 to 11.5px.

   The build label was the worst of them. It was two model versions and one
   application version out of date, and it read like something left in by
   accident, because it was.

   What stays in the bar: identity, one status, search, and the actions a
   reader came to use. Everything else moved into the About disclosure,
   which is where a reader goes when they want to know what they are
   looking at rather than to do something. */

export default function Header({
  lang, setLang, setSel, setShowGuide, setShowBriefing, tourTarget,
}) {
  const { data, engine } = useVault();
  const { COMPANIES, COUNTRY_NAMES } = data;
  const [aboutOpen, setAboutOpen] = useState(false);

  /* Counted from the snapshot, not typed in. */
  const scope = useMemo(() => {
    const stages = engine.STAGES || data.STAGES || [];
    const countryIds = Object.keys(COUNTRY_NAMES || {});
    const scored = countryIds.filter((id) => stages.some((st) => (st.shares || {})[id] > 0));
    return {
      stages: stages.length,
      companies: COMPANIES.length,
      scored: scored.length,
      hostOnly: countryIds.length - scored.length,
      total: countryIds.length,
      facilities: (data.FACILITIES || []).length,
      events: (data.EVENTS || []).length,
    };
  }, [engine, data, COMPANIES, COUNTRY_NAMES]);

  const datasetAsOf = engine.MODEL_PRIORS?.datasetAsOf ?? null;

  return (
    <header
      style={{
        borderBottom: `1px solid ${color.border.default}`,
        padding: `${space.sm + 2}px ${space.lg}px`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: space.md,
        alignItems: 'center',
        background: color.surface.page,
      }}
    >
      <a
        href="index.html"
        aria-label="SSCIM home"
        style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
      >
        <img
          src="sscim-logo.png"
          alt="SSCIM"
          style={{ display: 'block', width: 88, height: 'auto', filter: 'grayscale(1) brightness(0) invert(1)' }}
        />
      </a>

      {/* One status, not seven fields. The dataset date and how stale it is
          are the two things worth knowing at a glance; the rest is in About. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
        <span style={{ ...typeStyle.meta, ...tabular, color: color.text.secondary, whiteSpace: 'nowrap' }}>
          {datasetAsOf ? `Data to ${datasetAsOf}` : 'Data snapshot'}
        </span>
        <Freshness />
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: space.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <LanguagePicker lang={lang} setLang={setLang} />
        <SearchBox setSel={setSel} />
        <Button variant="quiet" size="sm" onClick={() => setShowGuide(true)}>
          {t('Help')}
        </Button>
        <Button
          id="btn-briefing"
          variant="primary"
          size="sm"
          onClick={() => setShowBriefing(true)}
          className={tourTarget === 'btn-briefing' ? 'tour-target ui-button' : 'ui-button'}
        >
          {t('Generate briefing')}
        </Button>
        <AboutMenu
          open={aboutOpen}
          setOpen={setAboutOpen}
          scope={scope}
          datasetAsOf={datasetAsOf}
          tourTarget={tourTarget}
        />
      </div>
    </header>
  );
}

/* Four languages, as a labelled group rather than four loose buttons. The
   codes are the language's own name, which is what a reader scanning for
   their language looks for. */
function LanguagePicker({ lang, setLang }) {
  const LANGS = [['en', 'EN', 'English'], ['zh', '简', '简体中文'], ['tw', '繁', '繁體中文'], ['ja', '日', '日本語']];
  return (
    <div
      role="radiogroup"
      aria-label="Language"
      style={{
        display: 'flex',
        gap: 2,
        padding: 2,
        background: color.surface.sunken,
        border: `1px solid ${color.border.control}`,
        borderRadius: radius.md,
      }}
    >
      {LANGS.map(([l, short, full]) => {
        const active = lang === l;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={full}
            title={full}
            onClick={() => setLang(l)}
            className="ui-button"
            style={{
              background: active ? color.state.accent : 'transparent',
              color: active ? color.text.onAccent : color.text.secondary,
              border: 'none',
              borderRadius: radius.sm,
              padding: `0 ${space.sm}px`,
              minHeight: 24,
              fontSize: font.size.meta,
              fontWeight: active ? font.weight.semibold : font.weight.regular,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

/* Everything the old header shouted, in a panel a reader opens on purpose:
   scope counts with their meanings spelled out, the dataset date, the model
   identifier, the application version, and the routes into the
   documentation. */
function AboutMenu({ open, setOpen, scope, datasetAsOf, tourTarget }) {
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, setOpen]);

  return (
    <div style={{ position: 'relative' }}>
      <IconButton
        ref={btnRef}
        label="About this model and dataset"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        id="btn-methodology"
        className={tourTarget === 'btn-methodology' ? 'tour-target ui-button' : 'ui-button'}
        size="sm"
      >
        <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>i</span>
      </IconButton>

      {open && (
        <div
          ref={ref}
          role="dialog"
          aria-label="About this model and dataset"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 1300,
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            background: color.surface.panel,
            border: `1px solid ${color.border.default}`,
            borderRadius: radius.lg,
            boxShadow: '0 8px 28px rgba(0,0,0,.45)',
            padding: space.lg,
          }}
        >
          <h2 style={{ ...typeStyle.heading, margin: `0 0 ${space.sm}px` }}>About this view</h2>
          <p style={{ ...typeStyle.secondary, margin: `0 0 ${space.md}px` }}>
            Semiconductor Supply Chain Intelligence Map. Scores are bounded comparative
            exposure estimates from an uncalibrated research model — not probabilities,
            losses or forecasts.
          </p>

          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: `${space.xs}px ${space.md}px` }}>
            <Row label="Dataset" value={datasetAsOf ?? '—'} />
            <Row label="Chain stages" value={scope.stages} />
            <Row label="Companies" value={scope.companies} />
            <Row label="Facilities" value={scope.facilities} />
            <Row
              label="Countries scored"
              value={scope.scored}
              note={`${scope.hostOnly} more host facilities but carry no production share, so they contribute to no score`}
            />
            <Row label="Events on record" value={scope.events} />
            <Row label="Model" value={MODEL_VERSION} mono />
            <Row label="Application" value={__APP_VERSION__} mono />
          </dl>

          <div style={{ display: 'flex', gap: space.sm, marginTop: space.lg, flexWrap: 'wrap' }}>
            <Button as="a" href="docs/METHODOLOGY.md.html" variant="secondary" size="sm">Methodology</Button>
            <Button as="a" href="docs/MODEL_V7_SPEC.md.html" variant="quiet" size="sm">Full specification</Button>
            <Button as="a" href="docs/" variant="quiet" size="sm">All documentation</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, note, mono }) {
  return (
    <>
      <dt style={{ ...typeStyle.meta, whiteSpace: 'nowrap' }}>{label}</dt>
      <dd style={{ margin: 0, ...typeStyle.secondary, ...tabular, color: color.text.primary, fontFamily: mono ? font.mono : 'inherit', fontSize: mono ? font.size.meta : font.size.secondary, wordBreak: mono ? 'break-all' : 'normal' }}>
        {value}
        {note && <div style={{ ...typeStyle.meta, marginTop: 2, fontFamily: 'inherit' }}>{note}</div>}
      </dd>
    </>
  );
}
