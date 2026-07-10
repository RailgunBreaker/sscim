import { useEffect, useRef } from 'react';

/* Shared modal accessibility behavior: focuses the dialog on mount and
   restores focus to whatever triggered it on close, since every overlay
   in this app (Guide/Methodology/Briefing/ScenarioBuilder) needs the same
   Escape-to-close + focus-return handling. Returns a ref to attach to the
   dialog's outer element. */
export function useModalA11y(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const prevFocused = document.activeElement;
    ref.current?.focus();
    return () => { if (prevFocused instanceof HTMLElement) prevFocused.focus(); };
  }, []);
  const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
  return { ref, onKeyDown };
}
