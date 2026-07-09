import { C } from '../theme.js';

export const Chip = ({ label, onClick, outline }) => (
  <span onClick={onClick} style={{
    fontSize: 11, padding: "3px 9px", borderRadius: 12, cursor: onClick ? "pointer" : "default",
    background: outline ? "transparent" : C.panel, border: `1px solid ${outline ? C.copper : C.line}`,
    color: outline ? C.copper : C.text,
  }}>{label}</span>
);

export default Chip;
