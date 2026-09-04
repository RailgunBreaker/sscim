/* ====================================================================
   primitives.jsx — the small set of components the interface repeats.

   These exist because the same control was being written from scratch in
   forty places, each with its own padding, radius and border, which is
   what makes an interface look assembled rather than designed. A control
   defined once looks the same everywhere by construction.

   Three rules run through all of them:

     1. A row that is not interactive does not look interactive. Borders
        mean selection, focus, warning, or a real control — never
        decoration.
     2. Every interactive element has a visible focus ring, and every
        icon-only control has an accessible name. Neither is optional.
     3. Meaning is never carried by colour alone. Where a state is shown
        in colour, a word or a shape carries it too.
   ==================================================================== */
import { forwardRef, useId, useState, useRef, useEffect } from 'react';
import { color, space, font, radius, control, focusRing, typeStyle, tabular } from './tokens.js';

/* Touch targets. Below 560px every control grows to 44px, which is the
   floor for a finger. Applied here rather than in each component so that
   it cannot be forgotten. */
const useTouch = () => {
  const [touch, setTouch] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 560 : false));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const on = () => setTouch(window.innerWidth <= 560);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return touch;
};

const focusable = {
  outline: 'none',
  /* The visible ring is applied by :focus-visible in the global stylesheet
     so that a mouse click does not paint one; this is the fallback for
     environments without :focus-visible. */
};

/* ------------------------------------------------------------- Button */

const BUTTON_VARIANTS = {
  primary: {
    background: color.state.accent,
    color: color.text.onAccent,
    border: `1px solid ${color.state.accent}`,
    fontWeight: font.weight.semibold,
  },
  secondary: {
    background: 'transparent',
    color: color.text.primary,
    border: `1px solid ${color.border.control}`,
    fontWeight: font.weight.medium,
  },
  /* No border at all. For tertiary actions that must not compete. */
  quiet: {
    background: 'transparent',
    color: color.text.secondary,
    border: '1px solid transparent',
    fontWeight: font.weight.regular,
  },
  danger: {
    background: 'transparent',
    color: color.state.adverse,
    border: `1px solid ${color.state.adverse}`,
    fontWeight: font.weight.medium,
  },
};

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', as = 'button', style, children, ...rest }, ref,
) {
  const touch = useTouch();
  const Tag = as;
  const h = touch ? control.touch : control[size] ?? control.md;
  return (
    <Tag
      ref={ref}
      className="ui-button"
      style={{
        ...BUTTON_VARIANTS[variant] ?? BUTTON_VARIANTS.secondary,
        ...focusable,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs + 2,
        minHeight: h,
        padding: `0 ${size === 'sm' ? space.sm + 2 : space.md}px`,
        borderRadius: radius.md,
        fontFamily: 'inherit',
        fontSize: size === 'sm' ? font.size.meta : font.size.secondary,
        lineHeight: 1,
        cursor: 'pointer',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
});

/* --------------------------------------------------------- IconButton */

/* An icon-only control with no accessible name is invisible to a screen
   reader, so `label` is required rather than optional. */
export const IconButton = forwardRef(function IconButton({ label, size = 'md', style, children, ...rest }, ref) {
  const touch = useTouch();
  const h = touch ? control.touch : control[size] ?? control.md;
  if (!label) throw new Error('IconButton requires a `label` — an icon-only control needs an accessible name.');
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className="ui-button"
      style={{
        ...focusable,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: h,
        height: h,
        background: 'transparent',
        color: color.text.secondary,
        border: `1px solid ${color.border.control}`,
        borderRadius: radius.md,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: font.size.secondary,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
});

/* --------------------------------------------------- SegmentedControl */

/* One choice from a small set, where the options are peers. Rendered as a
   radiogroup, because that is what it is: tabs would promise panels. */
export function SegmentedControl({ options, value, onChange, label, size = 'md', style }) {
  const touch = useTouch();
  const h = touch ? control.touch : control[size] ?? control.md;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{
        display: 'inline-flex',
        background: color.surface.sunken,
        border: `1px solid ${color.border.control}`,
        borderRadius: radius.md,
        padding: 2,
        gap: 2,
        /* At 375px a four-option control is wider than the viewport. It
           scrolls ITSELF rather than widening the page — horizontal page
           scroll is the defect, a scrollable control is not. */
        maxWidth: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'thin',
        ...style,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.title}
            onClick={() => !o.disabled && onChange(o.value)}
            className="ui-button"
            style={{
              ...focusable,
              minHeight: h - 4,
              padding: `0 ${space.md}px`,
              background: active ? color.state.accent : 'transparent',
              color: o.disabled ? color.text.muted : active ? color.text.onAccent : color.text.secondary,
              border: 'none',
              borderRadius: radius.sm,
              fontFamily: 'inherit',
              fontSize: font.size.secondary,
              fontWeight: active ? font.weight.semibold : font.weight.regular,
              cursor: o.disabled ? 'not-allowed' : 'pointer',
              opacity: o.disabled ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- Tabs */

/* Real tab semantics: roving tabindex, arrow-key navigation, Home/End,
   and aria-controls pointing at the panel. A row of buttons that merely
   looks like tabs is not usable from a keyboard. */
export function Tabs({ tabs, value, onChange, label, idPrefix = 'tab', panelIdFor, style }) {
  /* aria-controls must name an element that exists. Where the panel is
     rendered elsewhere in the tree, the caller supplies its id; pointing at
     an id that is not in the document is worse than omitting the attribute. */
  const panelId = panelIdFor ?? ((v) => `${idPrefix}panel-${v}`);
  const ref = useRef(null);
  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.value === value);
    if (i < 0) return;
    const go = (n) => {
      e.preventDefault();
      const next = tabs[(n + tabs.length) % tabs.length];
      onChange(next.value);
      ref.current?.querySelector(`#${idPrefix}-${CSS.escape(next.value)}`)?.focus();
    };
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(tabs.length - 1);
  };
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ display: 'flex', gap: space.xs, borderBottom: `1px solid ${color.border.subtle}`, overflowX: 'auto', ...style }}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            id={`${idPrefix}-${t.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={panelId(t.value)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className="ui-button"
            style={{
              ...focusable,
              background: 'transparent',
              color: active ? color.text.primary : color.text.secondary,
              border: 'none',
              /* The active tab is marked by a rule under it, not a box
                 around it. */
              borderBottom: `2px solid ${active ? color.state.accent : 'transparent'}`,
              padding: `${space.sm}px ${space.md}px`,
              marginBottom: -1,
              fontFamily: 'inherit',
              fontSize: font.size.secondary,
              fontWeight: active ? font.weight.semibold : font.weight.regular,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.count != null && (
              <span style={{ ...tabular, marginLeft: space.xs + 2, color: color.text.muted, fontSize: font.size.meta }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- Panel */

/* ONE boundary. Internal structure comes from dividers and background
   contrast, never from a second box inside the first. */
export function Panel({ children, flush = false, tone = 'panel', style, ...rest }) {
  return (
    <section
      style={{
        background: tone === 'sunken' ? color.surface.sunken : color.surface.panel,
        border: `1px solid ${color.border.default}`,
        borderRadius: radius.lg,
        padding: flush ? 0 : space.lg,
        ...style,
      }}
      {...rest}
    >
      {children}
    </section>
  );
}

/* ------------------------------------------------------ SectionHeader */

/* Sentence case by default. `eyebrow` is available for the rare label
   that genuinely needs to sit above a title, and is the only remaining
   place all-caps is permitted. */
export function SectionHeader({ title, description, eyebrow, actions, level = 2, style }) {
  const H = `h${level}`;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: space.md, marginBottom: space.md, ...style }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {eyebrow && <div style={{ ...typeStyle.eyebrow, marginBottom: space.xs }}>{eyebrow}</div>}
        <H style={{ ...typeStyle.heading, margin: 0 }}>{title}</H>
        {description && (
          <p style={{ ...typeStyle.secondary, margin: `${space.xs}px 0 0`, maxWidth: '72ch' }}>{description}</p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: space.sm, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------- StatusBadge */

/* Colour AND a word. A reader who cannot separate the hues still reads
   the state, which is what "no meaning by colour alone" requires. */
const BADGE_TONES = {
  adverse: color.state.adverse,
  warning: color.state.warning,
  mitigating: color.state.mitigating,
  neutral: color.text.secondary,
  accent: color.state.accent,
};

export function StatusBadge({ tone = 'neutral', children, title, style }) {
  const c = BADGE_TONES[tone] ?? BADGE_TONES.neutral;
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space.xs + 2,
        padding: `2px ${space.sm}px`,
        borderRadius: radius.sm,
        background: 'transparent',
        border: `1px solid ${c}`,
        color: c,
        fontSize: font.size.meta,
        fontWeight: font.weight.medium,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- Metric */

/* A measurement: the value large and tabular, the label above it, the
   qualifier below. This is the hierarchy the dashboard was missing —
   result, then context, then caveat. */
export function Metric({ label, value, unit, caption, tone, size = 'md', style }) {
  const valueSize = size === 'lg' ? 30 : size === 'sm' ? font.size.heading : 22;
  return (
    <div style={{ minWidth: 0, ...style }}>
      <div style={{ ...typeStyle.meta, marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: space.xs + 2 }}>
        <span style={{ ...tabular, fontSize: valueSize, fontWeight: font.weight.semibold, lineHeight: 1.1, color: tone ? BADGE_TONES[tone] : color.text.primary }}>
          {value}
        </span>
        {unit && <span style={{ ...typeStyle.meta, color: color.text.secondary }}>{unit}</span>}
      </div>
      {caption && <div style={{ ...typeStyle.meta, marginTop: space.xs }}>{caption}</div>}
    </div>
  );
}

/* --------------------------------------------------------- Disclosure */

/* Progressive disclosure. The summary is a plain-language sentence; the
   detail is the formula-level explanation. Both are present; only one is
   demanded of a reader who has not asked for it. */
export function Disclosure({ summary, children, defaultOpen = false, style }) {
  const id = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...style }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="ui-button"
        style={{
          ...focusable,
          display: 'inline-flex',
          alignItems: 'center',
          gap: space.xs + 2,
          background: 'transparent',
          border: 'none',
          padding: `${space.xs}px 0`,
          color: color.text.accent,
          fontFamily: 'inherit',
          fontSize: font.size.secondary,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-block', width: 10, transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
        {summary}
      </button>
      <div id={id} hidden={!open} style={{ ...typeStyle.secondary, paddingLeft: space.lg, paddingBottom: space.sm }}>
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- EmptyState */

/* An empty panel must say what to do next. "No data" is not an empty
   state; it is an unanswered question. */
export function EmptyState({ title, description, action, style }) {
  return (
    <div style={{ padding: `${space.xl}px ${space.lg}px`, textAlign: 'center', ...style }}>
      <div style={{ ...typeStyle.heading, marginBottom: space.xs }}>{title}</div>
      {description && (
        <p style={{ ...typeStyle.secondary, margin: `0 auto ${space.md}px`, maxWidth: '46ch' }}>{description}</p>
      )}
      {action}
    </div>
  );
}

export default {
  Button, IconButton, SegmentedControl, Tabs, Panel, SectionHeader, StatusBadge, Metric, Disclosure, EmptyState,
};
