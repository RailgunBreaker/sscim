export const C = {
  bg: "#0C111C", panel: "#141B2B", panel2: "#0F1626", line: "#243149",
  copper: "#C98A3F", copperDim: "#8A6230",
  red: "#E25C4A", amber: "#DFA83D", green: "#4FA97F",
  text: "#E9E4D8", dim: "#8C96A8",
  /* WAS #5A6478, which scored 2.89:1 on the panel background — below
     WCAG AA for normal text, while carrying 9-10px essential metadata
     all over the dashboard. Same hue (220) and saturation, lightened
     until it passes: 5.02:1 on the page, 4.57:1 on a panel. "Muted"
     has to mean de-emphasised, not unreadable. */
  faint: "#79849A",
};
