import { C } from '../theme.js';
import { t } from '../i18n/index.js';

export const riskColor = (s) => (s >= 7.5 ? C.red : s >= 5.5 ? C.amber : C.green);
export const riskLabel = (s) => t(s >= 7.5 ? "HIGH" : s >= 5.5 ? "ELEVATED" : "MODERATE");
export const confColor = (c) => (c === "High" ? C.green : c === "Medium" ? C.amber : c === "Simulated" ? C.copper : C.red);
export const TYPE_COLORS = {
  "Export Control": C.red, "Geopolitical Risk": C.red, "Critical Material Risk": C.amber,
  "Policy Signal": C.copper, "Technology Update": C.green, "Company Guidance": C.amber,
};
export const MAP_ARCS = [["nl", "tw"], ["jp", "tw"], ["jp", "kr"], ["us", "tw"], ["kr", "us"], ["tw", "my"], ["us", "cn"], ["jp", "us"], ["tw", "vn"], ["kr", "cn"], ["de", "cn"]];
