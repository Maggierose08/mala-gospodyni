// ============================================================
// Mała Gospodyni — core logic (unit conversion, scaling, allergen
// substitutions, temperature conversion). Kept separate from the UI
// code (app.js) so it can be tested on its own.
//
// This file has no dependency on the DOM — every function here is a
// plain function that takes data in and returns data out.
// ============================================================

const VOLUME_TO_ML = { tsp: 4.92892, tbsp: 14.7868, cup: 236.588, "fl oz": 29.5735, mL: 1, L: 1000 };
const WEIGHT_TO_G = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const isVolume = (u) => u in VOLUME_TO_ML;
const isWeight = (u) => u in WEIGHT_TO_G;

// Grams per US cup for common baking/cooking ingredients — lets us convert
// cups/tbsp/tsp <-> grams/oz for these specific ingredients (density varies
// by ingredient, so this can't be done in general without knowing what it is).
const DENSITY_G_PER_CUP = {
  "flour": 120, "all-purpose flour": 120, "sugar": 200, "granulated sugar": 200,
  "brown sugar": 220, "butter": 227, "milk": 240, "water": 240, "honey": 340,
  "rice": 185, "oats": 90, "rolled oats": 90, "cocoa powder": 90, "salt": 288,
  "vegetable oil": 218, "oil": 218, "powdered sugar": 120,
};

function findDensity(ingredientName) {
  const name = (ingredientName || "").toLowerCase();
  for (const key of Object.keys(DENSITY_G_PER_CUP)) {
    if (name.includes(key)) return DENSITY_G_PER_CUP[key];
  }
  return null;
}

function convertUnit(qty, fromUnit, toUnit, ingredientName) {
  if (fromUnit === toUnit) return { value: qty, ok: true };
  if (isVolume(fromUnit) && isVolume(toUnit)) {
    const ml = qty * VOLUME_TO_ML[fromUnit];
    return { value: ml / VOLUME_TO_ML[toUnit], ok: true };
  }
  if (isWeight(fromUnit) && isWeight(toUnit)) {
    const g = qty * WEIGHT_TO_G[fromUnit];
    return { value: g / WEIGHT_TO_G[toUnit], ok: true };
  }
  // Cross volume<->weight: only possible when we recognize the ingredient's density.
  const density = findDensity(ingredientName);
  if (density == null) {
    return { value: null, ok: false, reason: "no-density" };
  }
  if (isVolume(fromUnit) && isWeight(toUnit)) {
    const cups = (qty * VOLUME_TO_ML[fromUnit]) / VOLUME_TO_ML["cup"];
    const grams = cups * density;
    return { value: grams / WEIGHT_TO_G[toUnit], ok: true, approximate: true };
  }
  if (isWeight(fromUnit) && isVolume(toUnit)) {
    const grams = qty * WEIGHT_TO_G[fromUnit];
    const cups = grams / density;
    const ml = cups * VOLUME_TO_ML["cup"];
    return { value: ml / VOLUME_TO_ML[toUnit], ok: true, approximate: true };
  }
  return { value: null, ok: false, reason: "unsupported" };
}

function scaleQty(originalQty, originalServings, targetServings) {
  if (!originalServings || originalServings <= 0) return null;
  if (originalQty == null || isNaN(originalQty)) return null;
  return originalQty * (targetServings / originalServings);
}

function fToC(f) { return (f - 32) * 5 / 9; }
function cToF(c) { return c * 9 / 5 + 32; }

// Standard rounded oven-temperature quick-reference (°F / °C), the values
// most recipes actually use rather than the exact converted decimal.
const OVEN_TEMP_QUICK_REF = [
  { f: 250, c: 120 }, { f: 275, c: 135 }, { f: 300, c: 150 }, { f: 325, c: 163 },
  { f: 350, c: 175 }, { f: 375, c: 190 }, { f: 400, c: 200 }, { f: 425, c: 220 },
  { f: 450, c: 230 }, { f: 475, c: 245 }, { f: 500, c: 260 },
];

// Rule-of-thumb high-altitude baking adjustments. These are general
// guidelines, not exact science — the right fix depends on the specific
// recipe. Elevation in feet.
function altitudeAdjustment(elevationFt) {
  if (elevationFt == null || isNaN(elevationFt) || elevationFt < 3000) {
    return {
      applies: false,
      message: "Below about 3,000 ft, most recipes don't need any altitude adjustment.",
    };
  }
  const stepsAbove3500 = Math.max(0, (elevationFt - 3500) / 1000);
  const tempBumpF = elevationFt >= 3500 ? 15 + Math.min(10, Math.round(stepsAbove3500) * 2) : 0;
  const leaveningNote = `reduce baking powder/soda by about 1/8–1/4 tsp per tsp called for (a bit more the higher you go)`;
  const liquidNote = `add 1–2 tbsp extra liquid per cup used`;
  const sugarNote = `reduce sugar by about 1 tbsp per cup`;
  const tempNote = tempBumpF > 0
    ? `raise the oven temperature by roughly ${tempBumpF}°F`
    : `oven temperature usually doesn't need to change yet`;
  return {
    applies: true,
    message: `At ${Math.round(elevationFt).toLocaleString()} ft, general high-altitude baking guidance suggests: ${tempNote}; ${leaveningNote}; ${liquidNote}; and ${sugarNote}. These are rule-of-thumb starting points, not a guarantee — the right adjustment really depends on the specific recipe.`,
  };
}

// Allergen substitution map, with approximate swap ratios as a starting
// point (to be adjusted by taste/texture) — not an exact science, and not a
// substitute for checking labels / consulting a doctor for real allergies.
const ALLERGEN_MAP = {
  dairy: {
    label: "Dairy",
    keywords: ["milk", "butter", "cheese", "cream", "yogurt", "buttermilk"],
    suggestion: "1 cup milk ≈ 1 cup almond, oat, or soy milk. 1 cup butter ≈ 1 cup vegan butter, or about 3/4 cup neutral oil. 1 cup shredded cheese ≈ 2–3 tbsp nutritional yeast (to taste) or a vegan cheese swap.",
  },
  egg: {
    label: "Egg",
    keywords: ["egg", "eggs"],
    suggestion: "1 egg ≈ 1 tbsp ground flaxseed + 3 tbsp water (rest 5 min), or 1/4 cup unsweetened applesauce, or 1/2 a mashed banana.",
  },
  gluten: {
    label: "Gluten",
    keywords: ["flour", "wheat", "breadcrumbs", "pasta", "soy sauce"],
    suggestion: "1 cup flour ≈ 1 cup certified gluten-free 1:1 baking blend. Almond or oat flour are NOT 1:1 swaps — they're denser and usually need recipe adjustments beyond a simple substitution.",
  },
  nuts: {
    label: "Nuts",
    keywords: ["peanut", "almond", "walnut", "cashew", "pecan", "hazelnut", "pistachio"],
    suggestion: "1 cup nut butter ≈ 1 cup sunflower seed butter, soy nut butter, or pumpkin seed butter — check the label for cross-contamination warnings.",
  },
  soy: {
    label: "Soy",
    keywords: ["soy sauce", "tofu", "soy milk", "edamame"],
    suggestion: "1 tbsp soy sauce ≈ 1 tbsp tamari (check gluten-free if needed) or coconut aminos. 1 cup soy milk ≈ 1 cup oat or coconut milk.",
  },
};

function checkAllergens(ingredientNames, selectedCategories) {
  const results = [];
  for (const rawName of ingredientNames) {
    const name = (rawName || "").toLowerCase();
    if (!name.trim()) continue;
    for (const cat of selectedCategories) {
      const def = ALLERGEN_MAP[cat];
      if (!def) continue;
      if (def.keywords.some((k) => name.includes(k))) {
        results.push({ ingredient: rawName, category: cat, label: def.label, suggestion: def.suggestion });
      }
    }
  }
  return results;
}

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "?";
  const rounded = Math.round(n * 100) / 100;
  return rounded.toString();
}

// Popular volume/weight conversions people look up most while scaling a
// recipe by hand — not tied to any specific recipe, just a quick-reference
// list, the same spirit as OVEN_TEMP_QUICK_REF above. Computed from the
// same VOLUME_TO_ML / WEIGHT_TO_G tables convertUnit() itself uses, so
// there's only one place these numbers can ever get out of sync.
// `approx` marks a pair that crosses the metric/US-customary line (e.g.
// cups to mL) — genuinely a rounded approximation — vs. an exact
// definitional ratio within one system (e.g. 1 lb is exactly 16 oz).
function popularConversion(label, qty, fromUnit, toUnit, approx) {
  const result = convertUnit(qty, fromUnit, toUnit, "");
  return { label, value: fmtNum(result.value), unit: toUnit, approx: !!approx };
}

const POPULAR_CONVERSIONS = [
  popularConversion("1 tbsp", 1, "tbsp", "tsp"),
  popularConversion("1/4 cup", 0.25, "cup", "tbsp"),
  popularConversion("1 cup", 1, "cup", "tbsp"),
  popularConversion("1 cup", 1, "cup", "tsp"),
  popularConversion("1 cup", 1, "cup", "fl oz"),
  popularConversion("1 cup", 1, "cup", "mL", true),
  popularConversion("1 L", 1, "L", "mL"),
  popularConversion("1 L", 1, "L", "cup", true),
  popularConversion("1 lb", 1, "lb", "oz"),
  popularConversion("1 kg", 1, "kg", "g"),
  popularConversion("1 kg", 1, "kg", "lb", true),
  popularConversion("1 oz", 1, "oz", "g", true),
];

// ============================================================
// Scan a Recipe — turning raw OCR text into recipe form fields.
//
// This is a best-effort heuristic, not a guarantee: it's the reason every
// scan ends with a "check this against the original" reminder rather than
// saving straight into the recipe. Kept as a pure function (text in, data
// out) so it can be tested without needing a real photo or the OCR engine.
// ============================================================

const UNIT_WORDS = {
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  cup: "cup", cups: "cup",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "mL", milliliter: "mL", milliliters: "mL",
  l: "L", liter: "L", liters: "L",
};

const UNICODE_FRACTIONS = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

// Recognizes a leading quantity at the start of a line: "2", "1.5", "1/2",
// "1 1/2", or a unicode fraction like "½" — followed by the rest of the line.
function parseLeadingQty(line) {
  const m = line.match(/^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[½⅓⅔¼¾⅛⅜⅝⅞])\s+(.+)$/);
  if (!m) return null;
  const qtyStr = m[1];
  const rest = m[2];
  let qty;
  if (Object.prototype.hasOwnProperty.call(UNICODE_FRACTIONS, qtyStr)) {
    qty = UNICODE_FRACTIONS[qtyStr];
  } else if (qtyStr.includes(" ")) {
    const [whole, frac] = qtyStr.split(" ");
    const [n, d] = frac.split("/").map(Number);
    qty = Number(whole) + n / d;
  } else if (qtyStr.includes("/")) {
    const [n, d] = qtyStr.split("/").map(Number);
    qty = n / d;
  } else {
    qty = parseFloat(qtyStr);
  }
  return { qty: Math.round(qty * 1000) / 1000, rest };
}

// Pulls a recognized unit word off the front of `rest`, if there is one.
function parseLeadingUnit(rest) {
  const words = rest.trim().split(/\s+/);
  if (words.length >= 2 && words[0].toLowerCase() === "fl" && words[1].toLowerCase().replace(/[.,]$/, "") === "oz") {
    return { unit: "fl oz", name: words.slice(2).join(" ").trim() };
  }
  const first = (words[0] || "").toLowerCase().replace(/[.,]$/, "");
  if (Object.prototype.hasOwnProperty.call(UNIT_WORDS, first)) {
    return { unit: UNIT_WORDS[first], name: words.slice(1).join(" ").trim() };
  }
  return { unit: "", name: rest.trim() };
}

function parseOcrText(rawText) {
  const lines = (rawText || "")
    .split("\n")
    .map((l) => l.replace(/^[\s\-•*]+/, "").trim())
    .filter((l) => l.length > 0);

  if (!lines.length) {
    return { title: "", ingredients: [], steps: "" };
  }

  const title = lines[0];
  const rest = lines.slice(1);
  const ingredients = [];
  const stepLines = [];

  for (const line of rest) {
    const qtyMatch = parseLeadingQty(line);
    if (qtyMatch) {
      const { unit, name } = parseLeadingUnit(qtyMatch.rest);
      ingredients.push({ qty: qtyMatch.qty, unit, name });
    } else {
      stepLines.push(line);
    }
  }

  return { title, ingredients, steps: stepLines.join("\n") };
}

// Exposed for app.js (browser <script> include, no bundler in Phase 1) and
// for the Node-based test script.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VOLUME_TO_ML, WEIGHT_TO_G, DENSITY_G_PER_CUP, OVEN_TEMP_QUICK_REF, POPULAR_CONVERSIONS, ALLERGEN_MAP,
    findDensity, convertUnit, scaleQty, fToC, cToF, altitudeAdjustment, checkAllergens, fmtNum,
    parseOcrText,
  };
}
