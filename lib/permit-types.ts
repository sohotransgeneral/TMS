export const PERMIT_TYPES = [
  { value: "OVERSIZE",   label: "Oversize" },
  { value: "OVERWEIGHT", label: "Overweight" },
  { value: "WIDE_LOAD",  label: "Wide Load" },
  { value: "EXTRA_LONG", label: "Extra Long" },
  { value: "HAZMAT",     label: "Hazmat / ADR" },
  { value: "SUPERLOAD",  label: "Superload" },
  { value: "OTHER",      label: "Other" },
] as const;
