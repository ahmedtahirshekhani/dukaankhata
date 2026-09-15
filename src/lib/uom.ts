// src/lib/uom.ts

export type UnitOption = { value: string; label: string };

export const UNIT_VALUES = [
  "piece",
  "kg",
  "gram",
  "liter",
  "ml",
  "meter",
  "cm",
  "inch",
  "foot",
  "yard",
  "lb",
  "oz",
  "gallon",
  "pint",
  "quart",
  "sqm",
  "sqft",
  "cum",
  "box",
  "pack",
  "dozen",
  "roll",
  "sheet",
  "bundle",
  "carton",
  "case",
  "bottle",
  "can",
  "jar",
  "bag",
  "pair",
  "set",
  "unit",
  "tube",
  "packet",
  "strip",
  "ton",
  "cft",
  "sft",
  "rft",
  "bale",
  "cone",
  "than",
  "guz",
  "crate",
  "sack",
  "tin",
  "drum",
  "maund",
  "seer",
  "tablet",
  "capsule",
  "ampoule",
  "vial",
  "coil",
  "bucket",
  "ream",
] as const;

export type UnitValue = (typeof UNIT_VALUES)[number];

export const UOM_SHORTCUTS: Record<string, string> = {
  piece: "pcs",
  kg: "kg",
  gram: "g",
  liter: "L",
  ml: "ml",
  meter: "m",
  cm: "cm",
  inch: "in",
  foot: "ft",
  yard: "yd",
  lb: "lb",
  oz: "oz",
  gallon: "gal",
  pint: "pt",
  quart: "qt",
  sqm: "m²",
  sqft: "ft²",
  cum: "m³",
  box: "bx",
  pack: "pk",
  dozen: "doz",
  roll: "rl",
  sheet: "sht",
  bundle: "bdl",
  carton: "ctn",
  case: "cs",
  bottle: "btl",
  can: "cn",
  jar: "jr",
  bag: "bag",
  pair: "pr",
  set: "set",
  unit: "unt",
  uom: "unt",
  tube: "tb",
  packet: "pkt",
  strip: "strp",
  ton: "t",
  cft: "cft",
  sft: "sft",
  rft: "rft",
  bale: "bal",
  cone: "cn",
  than: "thn",
  guz: "guz",
  crate: "crt",
  sack: "sck",
  tin: "tin",
  drum: "drm",
  maund: "mnd",
  seer: "ser",
  tablet: "tab",
  capsule: "cap",
  ampoule: "amp",
  vial: "val",
  coil: "cl",
  bucket: "bkt",
  ream: "rm",
};

export const UNITS_OF_MEASUREMENT: UnitOption[] = [
  { value: "piece", label: "Piece (pcs)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "meter", label: "Meter (m)" },
  { value: "cm", label: "Centimeter (cm)" },
  { value: "inch", label: "Inch (in)" },
  { value: "foot", label: "Foot (ft)" },
  { value: "yard", label: "Yard (yd)" },
  { value: "lb", label: "Pound (lb)" },
  { value: "oz", label: "Ounce (oz)" },
  { value: "gallon", label: "Gallon (gal)" },
  { value: "pint", label: "Pint (pt)" },
  { value: "quart", label: "Quart (qt)" },
  { value: "sqm", label: "Square Meter (m²)" },
  { value: "sqft", label: "Square Foot (ft²)" },
  { value: "cum", label: "Cubic Meter (m³)" },
  { value: "box", label: "Box (bx)" },
  { value: "pack", label: "Pack (pk)" },
  { value: "dozen", label: "Dozen (doz)" },
  { value: "roll", label: "Roll (rl)" },
  { value: "sheet", label: "Sheet (sht)" },
  { value: "bundle", label: "Bundle (bdl)" },
  { value: "carton", label: "Carton (ctn)" },
  { value: "case", label: "Case (cs)" },
  { value: "bottle", label: "Bottle (btl)" },
  { value: "can", label: "Can (cn)" },
  { value: "jar", label: "Jar (jr)" },
  { value: "bag", label: "Bag (bag)" },
  { value: "pair", label: "Pair (pr)" },
  { value: "set", label: "Set (set)" },
  { value: "unit", label: "Unit (unt)" },
  { value: "tube", label: "Tube (tb)" },
  { value: "packet", label: "Packet (pkt)" },
  { value: "strip", label: "Strip (strp)" },
  { value: "ton", label: "Ton (t)" },
  { value: "cft", label: "Cubic Foot (cft)" },
  { value: "sft", label: "Square Foot (sft)" },
  { value: "rft", label: "Running Foot (rft)" },
  { value: "bale", label: "Bale (bal)" },
  { value: "cone", label: "Cone (cn)" },
  { value: "than", label: "Than (thn)" },
  { value: "guz", label: "Guz (guz)" },
  { value: "crate", label: "Crate (crt)" },
  { value: "sack", label: "Sack / Bori (sck)" },
  { value: "tin", label: "Tin (tin)" },
  { value: "drum", label: "Drum (drm)" },
  { value: "maund", label: "Maund (mnd)" },
  { value: "seer", label: "Seer (ser)" },
  { value: "tablet", label: "Tablet (tab)" },
  { value: "capsule", label: "Capsule (cap)" },
  { value: "ampoule", label: "Ampoule (amp)" },
  { value: "vial", label: "Vial (val)" },
  { value: "coil", label: "Coil (cl)" },
  { value: "bucket", label: "Bucket (bkt)" },
  { value: "ream", label: "Ream (rm)" },
];

/**
 * Returns the short abbreviation for a given unit value (e.g. 'piece' -> 'pcs', 'kg' -> 'kg')
 */
export function getUomShortcut(uom?: string | null): string {
  if (!uom) return "";
  const normalized = uom.toLowerCase().trim();
  return UOM_SHORTCUTS[normalized] || uom;
}

/**
 * Formats a UOM string for display, using shortcut if available
 */
export function formatUomDisplay(uom?: string | null): string {
  if (!uom) return "-";
  const shortcut = getUomShortcut(uom);
  return shortcut || uom;
}

/**
 * Returns translated and sorted unit options using next-intl translator if provided
 */
export function getLocalizedUnitOptions(t?: (key: string) => string): UnitOption[] {
  if (!t) {
    return [...UNITS_OF_MEASUREMENT].sort((a, b) => a.label.localeCompare(b.label));
  }
  const options: UnitOption[] = UNIT_VALUES.map((value) => ({
    value,
    label: t(`units.${value}`) || value,
  }));
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

