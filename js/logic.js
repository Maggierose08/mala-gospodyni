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

// Minimum safe internal temperatures, straight from the USDA Food Safety
// and Inspection Service's safe minimum internal temperature chart
// (fsis.usda.gov) — a food thermometer is the only reliable way to check
// these, not color or juices.
const SAFE_MEAT_TEMPS = [
  { food: "Beef, pork, veal & lamb — steaks, roasts, chops", f: 145, c: 62.8, note: "Let it rest at least 3 minutes before cutting or serving — the temperature keeps rising and evens out during that time." },
  { food: "Ground meat — beef, pork, veal, lamb", f: 160, c: 71.1, note: "Grinding mixes any surface bacteria all through the meat, so ground meat needs a higher temperature than a whole cut." },
  { food: "Ham, fresh or smoked (uncooked)", f: 145, c: 62.8, note: "Let it rest at least 3 minutes before serving." },
  { food: "Fully cooked ham (to reheat)", f: 140, c: 60, note: "That's for a USDA-inspected, packaged ham — reheat any other ham to 165°F (73.9°C)." },
  { food: "All poultry — chicken, turkey, duck, whole or ground", f: 165, c: 73.9, note: "Check the thickest part of the breast and the innermost part of the thigh and wing." },
  { food: "Eggs", f: 160, c: 71.1, note: "For dishes without a thermometer: both the yolk and white should be firm." },
  { food: "Fish & shellfish", f: 145, c: 62.8, note: "Fish is done when it's opaque and flakes easily with a fork." },
  { food: "Leftovers & casseroles", f: 165, c: 73.9, note: "" },
];

// Gas, electric, and convection ovens behave differently even set to the
// "same" temperature. Recipes are generally written and tested in a
// standard electric (or unspecified "conventional") oven, so this offers
// guidance for the other two — honestly: there is no single agreed-on
// "add/subtract this many degrees" rule between gas and electric (real
// cooking sources are clear that difference is about heat evenness and
// humidity, not a fixed number), so `offsetF` is only ever non-zero for
// convection, where a specific rule of thumb (-25°F, check ~10 min early)
// is widely and consistently recommended.
const OVEN_TYPES = {
  electric: {
    label: "Electric (standard)",
    summary: "Most recipes are written and tested in a standard electric oven, so no adjustment is usually needed — the numbers above should already match what the recipe expects.",
    offsetF: 0,
    tips: [
      "Even, fairly dry heat — a reliable default for cakes, cookies, and pastries.",
      "Good for roasts and bread too, but keep an eye on delicate bakes near the end so they don't dry out.",
    ],
  },
  gas: {
    label: "Gas",
    summary: "Gas ovens tend to run less evenly than electric, with a more humid interior — that's a difference in heat behavior, not a fixed number of degrees, so there's no reliable \"add/subtract this much\" rule to apply here.",
    offsetF: 0,
    tips: [
      "Expect hot spots, often toward the back or top — rotate pans halfway through baking.",
      "The extra humidity helps crusty bread, but can leave cookies and pastries paler or softer than expected — a few extra minutes of baking time can help them brown.",
      "Gas oven dials are often less accurate than electric ones — an inexpensive oven thermometer shows what temperature you're really baking at.",
    ],
  },
  convection: {
    label: "Convection / Fan",
    summary: "The fan circulates hot air, cooking faster and more evenly than a standard oven — most recipes (written for a standard oven) need a lower temperature and less time.",
    offsetF: -25,
    tips: [
      "Common rule of thumb: lower the recipe's temperature by 25°F (about 15°C), and start checking for doneness about 10 minutes before the recipe's stated time.",
      "Great for roasting and for baking multiple trays at once — even air circulation means less need to rotate pans.",
      "For delicate cakes, custards, or soufflés, some bakers turn the fan off (if the oven allows it) since fast-moving air can dry them out or affect how they rise.",
    ],
  },
};

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

// Looks up substitution ideas for a single typed-in ingredient against
// every allergen category at once (unlike checkAllergens, which only looks
// at categories the user has pre-selected) -- e.g. "soy sauce" matches both
// the gluten and soy entries. Used by the "Check Your Own Ingredients" tab,
// which is a direct one-ingredient-in / substitutions-out lookup rather
// than a whole-recipe check.
function findIngredientSubstitutions(rawName) {
  const name = (rawName || "").toLowerCase();
  if (!name.trim()) return [];
  const results = [];
  for (const cat of Object.keys(ALLERGEN_MAP)) {
    const def = ALLERGEN_MAP[cat];
    if (def.keywords.some((k) => name.includes(k))) {
      results.push({ category: cat, label: def.label, suggestion: def.suggestion });
    }
  }
  return results;
}

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "?";
  const rounded = Math.round(n * 100) / 100;
  return rounded.toString();
}

// Cooking measurements are usually written as fractions (1/4 cup, 1/3 tsp)
// rather than decimals, so an ingredient quantity that lands on -- or very
// close to -- one of these common cooking fractions gets displayed that way
// instead. Ingredient qty in the data stays a plain decimal (0.25, 0.33,
// ...) so scaling math (scaleQty above) keeps working exactly; this only
// controls how that number is *shown*. Denominators of 2, 3, 4, 6, and 8
// cover what home recipes actually use -- anything that doesn't land close
// to one of these (an odd scaled amount, for instance) still falls back to
// a plain rounded decimal.
//
// This is deliberately a separate function from fmtNum above, not a
// replacement for it: fmtNum is also used for unit-conversion results
// (grams, mL, °F/°C, etc.) where a fraction would be wrong -- nobody writes
// "12 1/2 g" for 12.5 grams of sugar. fmtQty is only for a quantity shown
// in its own recipe unit (cup, tbsp, tsp, lb, oz, or a bare count).
const COMMON_FRACTIONS = [
  { value: 1 / 8, text: "1/8" },
  { value: 1 / 6, text: "1/6" },
  { value: 1 / 4, text: "1/4" },
  { value: 1 / 3, text: "1/3" },
  { value: 3 / 8, text: "3/8" },
  { value: 1 / 2, text: "1/2" },
  { value: 5 / 8, text: "5/8" },
  { value: 2 / 3, text: "2/3" },
  { value: 3 / 4, text: "3/4" },
  { value: 5 / 6, text: "5/6" },
  { value: 7 / 8, text: "7/8" },
];
const FRACTION_TOLERANCE = 0.01;

function fmtQty(n) {
  if (n === null || n === undefined || isNaN(n)) return "?";
  const rounded = Math.round(n * 100) / 100;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  if (frac < 0.005) return whole.toString();
  for (const f of COMMON_FRACTIONS) {
    if (Math.abs(frac - f.value) <= FRACTION_TOLERANCE) {
      return whole > 0 ? `${whole} ${f.text}` : f.text;
    }
  }
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
// An optional `ingredientName` routes through convertUnit()'s cross
// volume<->weight path (via DENSITY_G_PER_CUP) for the gram conversions
// below — those are inherently approximate (density varies by how
// packed/sifted an ingredient is), which is why each names the ingredient
// rather than claiming a universal "1 cup = X g".
function popularConversion(label, qty, fromUnit, toUnit, approx, ingredientName) {
  const result = convertUnit(qty, fromUnit, toUnit, ingredientName || "");
  return { label, value: fmtNum(result.value), unit: toUnit, approx: !!approx };
}

const POPULAR_CONVERSIONS = [
  popularConversion("1 tbsp", 1, "tbsp", "tsp"),
  popularConversion("1/4 cup", 0.25, "cup", "tbsp"),
  popularConversion("1 cup", 1, "cup", "fl oz"),
  popularConversion("1 cup", 1, "cup", "mL", true),
  popularConversion("1 L", 1, "L", "mL"),
  popularConversion("1 L", 1, "L", "cup", true),
  popularConversion("1 lb", 1, "lb", "oz"),
  popularConversion("1 kg", 1, "kg", "g"),
  popularConversion("1 kg", 1, "kg", "lb", true),
  popularConversion("1 oz", 1, "oz", "g", true),
  popularConversion("1 cup flour", 1, "cup", "g", true, "flour"),
  popularConversion("1 tbsp flour", 1, "tbsp", "g", true, "flour"),
  popularConversion("1 tsp flour", 1, "tsp", "g", true, "flour"),
  popularConversion("1 cup sugar", 1, "cup", "g", true, "sugar"),
  popularConversion("1 tbsp sugar", 1, "tbsp", "g", true, "sugar"),
  popularConversion("1 cup butter", 1, "cup", "g", true, "butter"),
  popularConversion("1 tbsp butter", 1, "tbsp", "g", true, "butter"),
];

// ============================================================
// Recipe Creator — turns a free-text request ("chicken dinner for 4,
// gluten-free, under 30 minutes") into a real, cookable recipe plus its
// grocery list.
//
// This is a deliberately honest design choice, not a corner cut: rather
// than call an outside AI service (which would need a paid backend and a
// per-request cost that isn't guaranteed to stay at $0), this matches the
// request against a hand-written library of real recipes and scales the
// best match to the servings asked for — same spirit as everything else in
// the app, fully free and fully offline. It's more limited than open-ended
// AI (it can only ever suggest what's in RECIPE_TEMPLATES below), which is
// why generateRecipe() reports how well the match actually fit instead of
// pretending every result is a perfect, purpose-built recipe.
// ============================================================

const RECIPE_TEMPLATES = [
  {
    id: "chicken-stir-fry", title: "Chicken & Vegetable Stir-Fry", servings: 4, timeMinutes: 25,
    tags: ["chicken", "stir-fry", "dinner", "quick", "easy", "asian", "rice", "weeknight"],
    dietary: ["dairy-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "chicken breast, thinly sliced" },
      { qty: 2, unit: "cup", name: "broccoli florets" },
      { qty: 1, unit: "", name: "red bell pepper, sliced" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 1, unit: "tsp", name: "fresh ginger, grated" },
      { qty: 3, unit: "tbsp", name: "soy sauce" },
      { qty: 1, unit: "tbsp", name: "vegetable oil" },
      { qty: 2, unit: "cup", name: "cooked rice" },
    ],
    steps: [
      "Heat oil in a large skillet or wok over medium-high heat.",
      "Add chicken and cook until browned, about 5-6 minutes, then remove and set aside.",
      "Add garlic and ginger to the pan and cook 30 seconds until fragrant.",
      "Add broccoli and bell pepper; stir-fry 3-4 minutes until crisp-tender.",
      "Return the chicken to the pan, add soy sauce, and toss to combine and heat through.",
      "Serve over the cooked rice.",
    ],
  },
  {
    id: "beef-tacos", title: "Beef Tacos", servings: 4, timeMinutes: 25,
    tags: ["beef", "tacos", "dinner", "quick", "easy", "mexican", "weeknight"],
    dietary: ["gluten-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "ground beef" },
      { qty: 1, unit: "tbsp", name: "taco seasoning" },
      { qty: 8, unit: "", name: "corn tortillas" },
      { qty: 1, unit: "cup", name: "shredded lettuce" },
      { qty: 1, unit: "cup", name: "diced tomato" },
      { qty: 1, unit: "cup", name: "shredded cheddar cheese" },
      { qty: 0.5, unit: "cup", name: "sour cream" },
    ],
    steps: [
      "Brown the ground beef in a skillet over medium heat, breaking it up as it cooks.",
      "Stir in the taco seasoning and a splash of water; simmer 2-3 minutes.",
      "Warm the tortillas in a dry pan or the microwave.",
      "Fill each tortilla with beef, lettuce, tomato, cheese, and sour cream.",
    ],
  },
  {
    id: "veggie-pasta-primavera", title: "Vegetable Pasta Primavera", servings: 4, timeMinutes: 30,
    tags: ["pasta", "vegetarian", "dinner", "quick", "easy", "italian"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 12, unit: "oz", name: "pasta" },
      { qty: 1, unit: "cup", name: "cherry tomatoes, halved" },
      { qty: 1, unit: "cup", name: "zucchini, sliced" },
      { qty: 1, unit: "cup", name: "bell pepper, sliced" },
      { qty: 2, unit: "tbsp", name: "olive oil" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 0.5, unit: "cup", name: "grated parmesan cheese" },
      { qty: 0.25, unit: "cup", name: "fresh basil, chopped" },
    ],
    steps: [
      "Cook the pasta in salted water according to package directions; reserve 1/2 cup pasta water, then drain.",
      "While the pasta cooks, heat olive oil in a large skillet over medium heat.",
      "Add garlic, zucchini, and bell pepper; cook 4-5 minutes until just tender.",
      "Add cherry tomatoes and cook 2 more minutes until they begin to soften.",
      "Toss in the drained pasta and a splash of the reserved pasta water; top with parmesan and basil.",
    ],
  },
  {
    id: "baked-salmon-veg", title: "Baked Salmon with Roasted Vegetables", servings: 4, timeMinutes: 35,
    tags: ["salmon", "seafood", "fish", "dinner", "healthy", "pescatarian"],
    dietary: ["gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 4, unit: "", name: "salmon fillets (about 6 oz each)" },
      { qty: 2, unit: "cup", name: "broccoli florets" },
      { qty: 2, unit: "cup", name: "baby carrots" },
      { qty: 2, unit: "tbsp", name: "olive oil" },
      { qty: 1, unit: "", name: "lemon, sliced" },
      { qty: 1, unit: "tsp", name: "garlic powder" },
      { qty: 0.5, unit: "tsp", name: "salt" },
    ],
    steps: [
      "Preheat the oven to 400°F (200°C).",
      "Toss the broccoli and carrots with half the olive oil, garlic powder, and salt on a sheet pan.",
      "Roast 10 minutes, then push the vegetables to one side and add the salmon, drizzled with the rest of the oil and topped with lemon slices.",
      "Bake 12-15 minutes more, until the salmon flakes easily with a fork.",
    ],
  },
  {
    id: "vegetarian-chili", title: "Vegetarian Chili", servings: 6, timeMinutes: 40,
    tags: ["chili", "vegetarian", "vegan", "dinner", "beans", "healthy"],
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "tbsp", name: "olive oil" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 2, unit: "cup", name: "canned kidney beans, drained" },
      { qty: 2, unit: "cup", name: "canned black beans, drained" },
      { qty: 1, unit: "cup", name: "canned corn" },
      { qty: 3, unit: "cup", name: "canned diced tomatoes" },
      { qty: 2, unit: "tbsp", name: "chili powder" },
      { qty: 1, unit: "tsp", name: "ground cumin" },
    ],
    steps: [
      "Heat olive oil in a large pot over medium heat and sauté the onion until soft, about 5 minutes.",
      "Add garlic and cook 1 minute more.",
      "Stir in the beans, corn, tomatoes, chili powder, and cumin.",
      "Bring to a simmer and cook uncovered 20-25 minutes, stirring occasionally, until thickened.",
    ],
  },
  {
    id: "classic-beef-chili", title: "Classic Beef Chili", servings: 6, timeMinutes: 45,
    tags: ["chili", "beef", "dinner", "hearty"],
    dietary: ["gluten-free", "nut-free"],
    ingredients: [
      { qty: 1.5, unit: "lb", name: "ground beef" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 2, unit: "cup", name: "canned kidney beans, drained" },
      { qty: 3, unit: "cup", name: "canned diced tomatoes" },
      { qty: 2, unit: "tbsp", name: "chili powder" },
      { qty: 1, unit: "tsp", name: "ground cumin" },
      { qty: 1, unit: "cup", name: "shredded cheddar cheese, for topping" },
    ],
    steps: [
      "Brown the ground beef with the onion in a large pot over medium heat; drain excess fat.",
      "Add garlic and cook 1 minute more.",
      "Stir in the beans, tomatoes, chili powder, and cumin.",
      "Simmer uncovered 25-30 minutes, stirring occasionally. Serve topped with cheddar.",
    ],
  },
  {
    id: "classic-pancakes", title: "Classic Buttermilk Pancakes", servings: 4, timeMinutes: 20,
    tags: ["pancakes", "breakfast", "vegetarian", "quick", "easy", "sweet"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 2, unit: "cup", name: "all-purpose flour" },
      { qty: 2, unit: "tbsp", name: "sugar" },
      { qty: 2, unit: "tsp", name: "baking powder" },
      { qty: 0.5, unit: "tsp", name: "baking soda" },
      { qty: 0.5, unit: "tsp", name: "salt" },
      { qty: 2, unit: "cup", name: "buttermilk" },
      { qty: 2, unit: "", name: "eggs" },
      { qty: 0.25, unit: "cup", name: "butter, melted" },
    ],
    steps: [
      "Whisk together flour, sugar, baking powder, baking soda, and salt in a large bowl.",
      "In a separate bowl, whisk the buttermilk, eggs, and melted butter.",
      "Pour the wet ingredients into the dry and stir just until combined (a few lumps are fine).",
      "Cook 1/4-cup portions on a hot, lightly greased griddle until bubbles form, then flip and cook until golden.",
    ],
  },
  {
    id: "veggie-omelet", title: "Veggie Omelet", servings: 2, timeMinutes: 15,
    tags: ["omelet", "eggs", "breakfast", "vegetarian", "quick", "easy", "gluten-free"],
    dietary: ["vegetarian", "gluten-free", "nut-free"],
    ingredients: [
      { qty: 4, unit: "", name: "eggs" },
      { qty: 0.25, unit: "cup", name: "bell pepper, diced" },
      { qty: 0.25, unit: "cup", name: "onion, diced" },
      { qty: 0.25, unit: "cup", name: "spinach, chopped" },
      { qty: 0.25, unit: "cup", name: "shredded cheddar cheese" },
      { qty: 1, unit: "tbsp", name: "butter" },
      { qty: 0.25, unit: "tsp", name: "salt" },
    ],
    steps: [
      "Whisk the eggs with salt in a bowl.",
      "Melt butter in a nonstick skillet over medium heat and sauté the pepper and onion 2-3 minutes.",
      "Add the spinach and cook until just wilted.",
      "Pour in the eggs, let set slightly, then sprinkle with cheese and fold in half once mostly set.",
    ],
  },
  {
    id: "overnight-oats", title: "Overnight Oats", servings: 2, timeMinutes: 10,
    tags: ["oats", "breakfast", "vegan", "vegetarian", "healthy", "make-ahead", "no-cook", "quick", "easy"],
    dietary: ["vegetarian", "vegan", "dairy-free", "nut-free", "gluten-free"],
    ingredients: [
      { qty: 1, unit: "cup", name: "rolled oats (certified gluten-free if needed)" },
      { qty: 1, unit: "cup", name: "unsweetened oat milk" },
      { qty: 2, unit: "tbsp", name: "chia seeds" },
      { qty: 2, unit: "tbsp", name: "maple syrup" },
      { qty: 1, unit: "cup", name: "mixed berries" },
    ],
    steps: [
      "Stir together the oats, oat milk, chia seeds, and maple syrup in a jar or container.",
      "Cover and refrigerate at least 4 hours, or overnight.",
      "Top with mixed berries just before eating.",
    ],
  },
  {
    id: "grilled-cheese-tomato-soup", title: "Grilled Cheese & Tomato Soup", servings: 4, timeMinutes: 25,
    tags: ["grilled cheese", "soup", "tomato", "lunch", "comfort food", "vegetarian"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 8, unit: "", name: "bread slices" },
      { qty: 8, unit: "", name: "cheddar cheese slices" },
      { qty: 2, unit: "tbsp", name: "butter, softened" },
      { qty: 4, unit: "cup", name: "canned crushed tomatoes" },
      { qty: 1, unit: "cup", name: "vegetable broth" },
      { qty: 0.5, unit: "cup", name: "heavy cream" },
      { qty: 1, unit: "tsp", name: "dried basil" },
    ],
    steps: [
      "Simmer the crushed tomatoes, broth, and basil in a pot over medium heat for 15 minutes, then stir in the cream.",
      "Meanwhile, butter the bread and assemble sandwiches with the cheese slices.",
      "Cook the sandwiches in a skillet over medium heat, 3-4 minutes per side, until golden and the cheese melts.",
      "Serve the grilled cheese alongside the soup.",
    ],
  },
  {
    id: "chicken-caesar-salad", title: "Chicken Caesar Salad", servings: 4, timeMinutes: 25,
    tags: ["chicken", "salad", "lunch", "caesar", "quick", "easy"],
    dietary: ["nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "chicken breast" },
      { qty: 8, unit: "cup", name: "romaine lettuce, chopped" },
      { qty: 0.5, unit: "cup", name: "caesar dressing" },
      { qty: 0.5, unit: "cup", name: "grated parmesan cheese" },
      { qty: 1, unit: "cup", name: "croutons" },
    ],
    steps: [
      "Season the chicken and cook in a skillet over medium heat, about 6-7 minutes per side, until cooked through; let rest, then slice.",
      "Toss the romaine with the caesar dressing.",
      "Top with the sliced chicken, parmesan, and croutons.",
    ],
  },
  {
    id: "shrimp-scampi", title: "Shrimp Scampi with Linguine", servings: 4, timeMinutes: 25,
    tags: ["shrimp", "seafood", "pasta", "dinner", "quick", "italian", "pescatarian"],
    dietary: ["nut-free"],
    ingredients: [
      { qty: 12, unit: "oz", name: "linguine" },
      { qty: 1, unit: "lb", name: "shrimp, peeled and deveined" },
      { qty: 4, unit: "tbsp", name: "butter" },
      { qty: 3, unit: "tbsp", name: "olive oil" },
      { qty: 4, unit: "", name: "garlic cloves, minced" },
      { qty: 0.5, unit: "cup", name: "dry white wine or broth" },
      { qty: 2, unit: "tbsp", name: "lemon juice" },
      { qty: 0.25, unit: "cup", name: "fresh parsley, chopped" },
    ],
    steps: [
      "Cook the linguine in salted water according to package directions; drain.",
      "Heat butter and olive oil in a large skillet over medium heat; add garlic and cook 30 seconds.",
      "Add shrimp and cook 2 minutes per side until pink, then remove.",
      "Add wine (or broth) and lemon juice to the pan, simmer 2 minutes, then return the shrimp and toss with the pasta and parsley.",
    ],
  },
  {
    id: "turkey-meatballs-marinara", title: "Turkey Meatballs with Marinara", servings: 4, timeMinutes: 40,
    tags: ["turkey", "meatballs", "pasta", "dinner", "italian"],
    dietary: ["nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "ground turkey" },
      { qty: 0.5, unit: "cup", name: "breadcrumbs" },
      { qty: 1, unit: "", name: "egg" },
      { qty: 0.25, unit: "cup", name: "grated parmesan cheese" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 3, unit: "cup", name: "marinara sauce" },
      { qty: 12, unit: "oz", name: "spaghetti" },
    ],
    steps: [
      "Preheat the oven to 400°F (200°C). Mix turkey, breadcrumbs, egg, parmesan, and garlic; form into 1.5-inch meatballs.",
      "Bake the meatballs on a lined sheet pan 18-20 minutes, until cooked through.",
      "Meanwhile, cook the spaghetti according to package directions and warm the marinara sauce.",
      "Add the meatballs to the sauce and serve over the spaghetti.",
    ],
  },
  {
    id: "vegetable-fried-rice", title: "Vegetable Fried Rice", servings: 4, timeMinutes: 20,
    tags: ["fried rice", "vegetarian", "vegan", "dinner", "quick", "easy", "asian", "weeknight"],
    dietary: ["vegetarian", "vegan", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 3, unit: "cup", name: "cooked rice, cold (day-old works best)" },
      { qty: 1, unit: "cup", name: "frozen peas and carrots" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 3, unit: "tbsp", name: "soy sauce" },
      { qty: 2, unit: "tbsp", name: "vegetable oil" },
      { qty: 2, unit: "", name: "green onions, sliced" },
    ],
    steps: [
      "Heat oil in a large skillet or wok over medium-high heat.",
      "Add onion and garlic, cook 2 minutes, then add the peas and carrots and cook 2 minutes more.",
      "Add the cold rice, breaking up clumps, and stir-fry 4-5 minutes.",
      "Stir in the soy sauce and green onions and toss to combine.",
    ],
  },
  {
    id: "banana-bread", title: "Banana Bread", servings: 8, timeMinutes: 65,
    tags: ["banana bread", "dessert", "snack", "baking", "vegetarian", "sweet"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 3, unit: "", name: "ripe bananas, mashed" },
      { qty: 0.33, unit: "cup", name: "butter, melted" },
      { qty: 0.75, unit: "cup", name: "sugar" },
      { qty: 1, unit: "", name: "egg" },
      { qty: 1, unit: "tsp", name: "vanilla extract" },
      { qty: 1, unit: "tsp", name: "baking soda" },
      { qty: 0.25, unit: "tsp", name: "salt" },
      { qty: 1.5, unit: "cup", name: "all-purpose flour" },
    ],
    steps: [
      "Preheat the oven to 350°F (175°C) and grease a loaf pan.",
      "Mix the mashed bananas with the melted butter, then stir in sugar, egg, and vanilla.",
      "Sprinkle the baking soda and salt over the mixture and stir in, then fold in the flour just until combined.",
      "Pour into the loaf pan and bake 55-65 minutes, until a toothpick comes out clean.",
    ],
  },
  {
    id: "chocolate-chip-cookies", title: "Chocolate Chip Cookies", servings: 24, timeMinutes: 30,
    tags: ["cookies", "dessert", "chocolate", "baking", "vegetarian", "sweet"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 2.25, unit: "cup", name: "all-purpose flour" },
      { qty: 1, unit: "tsp", name: "baking soda" },
      { qty: 1, unit: "tsp", name: "salt" },
      { qty: 1, unit: "cup", name: "butter, softened" },
      { qty: 0.75, unit: "cup", name: "sugar" },
      { qty: 0.75, unit: "cup", name: "brown sugar" },
      { qty: 2, unit: "", name: "eggs" },
      { qty: 1, unit: "tsp", name: "vanilla extract" },
      { qty: 2, unit: "cup", name: "chocolate chips" },
    ],
    steps: [
      "Preheat the oven to 375°F (190°C).",
      "Whisk together the flour, baking soda, and salt.",
      "Cream the butter with both sugars until fluffy, then beat in the eggs and vanilla.",
      "Stir in the flour mixture just until combined, then fold in the chocolate chips.",
      "Drop rounded tablespoons onto a lined sheet pan and bake 9-11 minutes, until edges are golden.",
    ],
  },
  {
    id: "lentil-soup", title: "Lentil Soup", servings: 6, timeMinutes: 40,
    tags: ["lentil", "soup", "vegan", "vegetarian", "healthy", "dinner", "lunch"],
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "tbsp", name: "olive oil" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 2, unit: "", name: "carrots, diced" },
      { qty: 2, unit: "", name: "celery stalks, diced" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 1.5, unit: "cup", name: "dried lentils, rinsed" },
      { qty: 6, unit: "cup", name: "vegetable broth" },
      { qty: 1, unit: "cup", name: "canned diced tomatoes" },
      { qty: 1, unit: "tsp", name: "ground cumin" },
      { qty: 1, unit: "tsp", name: "smoked paprika" },
    ],
    steps: [
      "Heat olive oil in a large pot over medium heat and sauté the onion, carrots, and celery 5-6 minutes.",
      "Add garlic and cook 1 minute more.",
      "Stir in the lentils, broth, tomatoes, cumin, and paprika.",
      "Bring to a boil, then reduce heat and simmer 25-30 minutes, until the lentils are tender.",
    ],
  },
  {
    id: "chana-masala", title: "Chana Masala (Indian Chickpea Curry)", servings: 4, timeMinutes: 30,
    tags: ["chana masala", "indian", "curry", "vegan", "vegetarian", "dinner", "healthy", "beans", "chickpeas"],
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 2, unit: "tbsp", name: "vegetable oil" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 3, unit: "", name: "garlic cloves, minced" },
      { qty: 1, unit: "tsp", name: "fresh ginger, grated" },
      { qty: 2, unit: "tsp", name: "ground cumin" },
      { qty: 1, unit: "tsp", name: "ground coriander" },
      { qty: 1, unit: "tsp", name: "turmeric" },
      { qty: 1, unit: "tsp", name: "garam masala" },
      { qty: 2, unit: "cup", name: "canned diced tomatoes" },
      { qty: 3, unit: "cup", name: "canned chickpeas, drained and rinsed" },
      { qty: 0.5, unit: "cup", name: "water" },
      { qty: 4, unit: "cup", name: "cooked rice, for serving" },
    ],
    steps: [
      "Heat oil in a large pot over medium heat and sauté the onion until soft, about 5 minutes.",
      "Add garlic and ginger and cook 1 minute, then stir in the cumin, coriander, turmeric, and garam masala.",
      "Add the diced tomatoes and simmer 5 minutes, mashing them slightly with a spoon.",
      "Stir in the chickpeas and water; simmer uncovered 15 minutes, mashing some chickpeas against the pot to thicken.",
      "Serve over rice.",
    ],
  },
  {
    id: "butter-chicken", title: "Butter Chicken", servings: 4, timeMinutes: 40,
    tags: ["butter chicken", "indian", "curry", "chicken", "dinner"],
    dietary: ["gluten-free", "nut-free"],
    ingredients: [
      { qty: 1.5, unit: "lb", name: "chicken thighs, cut into bite-size pieces" },
      { qty: 0.5, unit: "cup", name: "plain yogurt" },
      { qty: 1, unit: "tbsp", name: "lemon juice" },
      { qty: 2, unit: "tsp", name: "garam masala" },
      { qty: 1, unit: "tsp", name: "ground cumin" },
      { qty: 1, unit: "tsp", name: "turmeric" },
      { qty: 4, unit: "tbsp", name: "butter" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 3, unit: "", name: "garlic cloves, minced" },
      { qty: 1, unit: "tsp", name: "fresh ginger, grated" },
      { qty: 2, unit: "cup", name: "canned crushed tomatoes" },
      { qty: 1, unit: "cup", name: "heavy cream" },
      { qty: 4, unit: "cup", name: "cooked rice, for serving" },
    ],
    steps: [
      "Combine the chicken, yogurt, lemon juice, and half the garam masala, cumin, and turmeric in a bowl; marinate at least 20 minutes (or overnight).",
      "Melt 2 tbsp butter in a large skillet over medium-high heat and cook the marinated chicken until browned and cooked through, about 8 minutes; remove and set aside.",
      "Melt the remaining butter in the same pan and sauté the onion until soft, about 5 minutes, then add garlic, ginger, and the remaining spices and cook 1 minute.",
      "Stir in the crushed tomatoes and simmer 10 minutes, then stir in the cream and return the chicken to the pan; simmer 5 more minutes.",
      "Serve over rice.",
    ],
  },
  {
    id: "veggie-pad-thai", title: "Vegetable Pad Thai", servings: 4, timeMinutes: 30,
    tags: ["pad thai", "thai", "noodles", "vegetarian", "dinner", "asian"],
    dietary: ["vegetarian", "gluten-free", "dairy-free"],
    ingredients: [
      { qty: 8, unit: "oz", name: "rice noodles" },
      { qty: 2, unit: "tbsp", name: "vegetable oil" },
      { qty: 14, unit: "oz", name: "firm tofu, cubed" },
      { qty: 2, unit: "", name: "eggs, beaten" },
      { qty: 2, unit: "cup", name: "bean sprouts" },
      { qty: 3, unit: "", name: "green onions, sliced" },
      { qty: 3, unit: "tbsp", name: "tamari (gluten-free soy sauce)" },
      { qty: 2, unit: "tbsp", name: "rice vinegar" },
      { qty: 2, unit: "tbsp", name: "brown sugar" },
      { qty: 1, unit: "tbsp", name: "tamarind paste" },
      { qty: 0.25, unit: "cup", name: "roasted peanuts, chopped" },
      { qty: 1, unit: "", name: "lime, cut into wedges" },
    ],
    steps: [
      "Soak the rice noodles in warm water according to package directions until pliable, then drain.",
      "Heat 1 tbsp oil in a large skillet or wok over medium-high heat and cook the tofu until golden on most sides, about 6 minutes; remove and set aside.",
      "Add the remaining oil and the beaten eggs, scrambling until just set, then push to one side.",
      "Add the noodles, tamari, rice vinegar, brown sugar, and tamarind paste; toss well to combine and heat through, about 3 minutes.",
      "Return the tofu to the pan and add the bean sprouts and green onions; toss 1-2 minutes more.",
      "Top with chopped peanuts and serve with lime wedges.",
    ],
  },
  {
    id: "thai-green-curry-chicken", title: "Thai Green Curry with Chicken", servings: 4, timeMinutes: 30,
    tags: ["thai", "curry", "chicken", "dinner", "coconut", "asian"],
    dietary: ["gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "tbsp", name: "vegetable oil" },
      { qty: 3, unit: "tbsp", name: "green curry paste" },
      { qty: 1, unit: "lb", name: "chicken breast, sliced" },
      { qty: 2, unit: "cup", name: "canned coconut milk" },
      { qty: 1, unit: "cup", name: "green beans, trimmed and halved" },
      { qty: 1, unit: "", name: "red bell pepper, sliced" },
      { qty: 2, unit: "tbsp", name: "fish sauce" },
      { qty: 1, unit: "tbsp", name: "brown sugar" },
      { qty: 0.25, unit: "cup", name: "fresh basil leaves" },
      { qty: 4, unit: "cup", name: "cooked rice, for serving" },
    ],
    steps: [
      "Heat oil in a large pot over medium heat and cook the curry paste 1 minute until fragrant.",
      "Add the chicken and cook 3-4 minutes, stirring to coat in the paste.",
      "Stir in the coconut milk, green beans, and bell pepper; simmer 10-12 minutes, until the chicken is cooked through and vegetables are tender.",
      "Stir in the fish sauce and brown sugar, then remove from heat and stir in the basil.",
      "Serve over rice.",
    ],
  },
  {
    id: "greek-salad-chicken", title: "Greek Salad with Grilled Chicken", servings: 4, timeMinutes: 25,
    tags: ["greek", "salad", "chicken", "lunch", "mediterranean", "healthy", "quick", "easy"],
    dietary: ["gluten-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "chicken breast" },
      { qty: 1, unit: "tbsp", name: "olive oil, for the chicken" },
      { qty: 1, unit: "tsp", name: "dried oregano" },
      { qty: 4, unit: "cup", name: "romaine lettuce, chopped" },
      { qty: 1, unit: "", name: "cucumber, diced" },
      { qty: 2, unit: "cup", name: "cherry tomatoes, halved" },
      { qty: 0.5, unit: "", name: "red onion, thinly sliced" },
      { qty: 0.5, unit: "cup", name: "kalamata olives" },
      { qty: 1, unit: "cup", name: "feta cheese, crumbled" },
      { qty: 3, unit: "tbsp", name: "olive oil, for the dressing" },
      { qty: 1, unit: "tbsp", name: "red wine vinegar" },
    ],
    steps: [
      "Season the chicken with oregano and a drizzle of olive oil; grill or pan-sear over medium-high heat 6-7 minutes per side, until cooked through. Let rest, then slice.",
      "Toss the lettuce, cucumber, tomatoes, onion, and olives in a large bowl.",
      "Whisk the dressing oil and vinegar together and toss with the salad.",
      "Top with the sliced chicken and feta.",
    ],
  },
  {
    id: "falafel-wrap-tzatziki", title: "Falafel Wrap with Tzatziki", servings: 4, timeMinutes: 35,
    tags: ["falafel", "mediterranean", "vegetarian", "wrap", "lunch", "middle eastern"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 3, unit: "cup", name: "canned chickpeas, drained and rinsed" },
      { qty: 0.5, unit: "cup", name: "fresh parsley" },
      { qty: 3, unit: "", name: "garlic cloves" },
      { qty: 1, unit: "tsp", name: "ground cumin" },
      { qty: 1, unit: "tsp", name: "ground coriander" },
      { qty: 0.25, unit: "cup", name: "all-purpose flour" },
      { qty: 0.25, unit: "cup", name: "vegetable oil, for frying" },
      { qty: 1, unit: "cup", name: "plain yogurt" },
      { qty: 0.5, unit: "", name: "cucumber, grated" },
      { qty: 1, unit: "tbsp", name: "lemon juice" },
      { qty: 4, unit: "", name: "pita breads" },
      { qty: 2, unit: "cup", name: "shredded lettuce" },
      { qty: 1, unit: "cup", name: "diced tomato" },
    ],
    steps: [
      "Pulse the chickpeas, parsley, garlic, cumin, and coriander in a food processor until finely chopped but not pureed; stir in the flour and form into small patties.",
      "Heat oil in a skillet over medium heat and fry the patties 3-4 minutes per side, until golden and crisp.",
      "Meanwhile, stir together the yogurt, grated cucumber, and lemon juice for the tzatziki.",
      "Warm the pitas and fill with falafel, lettuce, tomato, and tzatziki.",
    ],
  },
  {
    id: "shakshuka", title: "Shakshuka", servings: 4, timeMinutes: 30,
    tags: ["shakshuka", "eggs", "breakfast", "mediterranean", "vegetarian", "middle eastern", "brunch"],
    dietary: ["vegetarian", "gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 2, unit: "tbsp", name: "olive oil" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 1, unit: "", name: "red bell pepper, diced" },
      { qty: 3, unit: "", name: "garlic cloves, minced" },
      { qty: 1, unit: "tsp", name: "ground cumin" },
      { qty: 1, unit: "tsp", name: "smoked paprika" },
      { qty: 4, unit: "cup", name: "canned crushed tomatoes" },
      { qty: 6, unit: "", name: "eggs" },
      { qty: 0.25, unit: "cup", name: "fresh parsley, chopped" },
    ],
    steps: [
      "Heat olive oil in a large skillet over medium heat and sauté the onion and bell pepper until soft, about 6 minutes.",
      "Add garlic, cumin, and smoked paprika and cook 1 minute.",
      "Stir in the crushed tomatoes and simmer uncovered 10 minutes, until slightly thickened.",
      "Make 6 small wells in the sauce and crack an egg into each; cover and cook 6-8 minutes, until the whites are set but yolks are still soft.",
      "Sprinkle with parsley and serve directly from the pan.",
    ],
  },
  {
    id: "beef-bibimbap", title: "Korean Beef Bibimbap", servings: 4, timeMinutes: 35,
    tags: ["bibimbap", "korean", "beef", "rice", "dinner", "asian"],
    dietary: ["dairy-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "beef sirloin, thinly sliced" },
      { qty: 3, unit: "tbsp", name: "soy sauce" },
      { qty: 1, unit: "tbsp", name: "sesame oil" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 1, unit: "tbsp", name: "brown sugar" },
      { qty: 2, unit: "cup", name: "spinach" },
      { qty: 2, unit: "cup", name: "bean sprouts" },
      { qty: 2, unit: "", name: "carrots, julienned" },
      { qty: 1, unit: "tbsp", name: "vegetable oil" },
      { qty: 4, unit: "", name: "eggs" },
      { qty: 4, unit: "cup", name: "cooked rice" },
      { qty: 4, unit: "tbsp", name: "gochujang (Korean chili paste)" },
    ],
    steps: [
      "Marinate the beef in soy sauce, sesame oil, garlic, and brown sugar for at least 15 minutes.",
      "Blanch the spinach and bean sprouts separately in boiling water for 1 minute each, then drain and season lightly.",
      "Heat vegetable oil in a skillet and quickly sauté the carrots 2-3 minutes; set aside with the spinach and bean sprouts.",
      "Cook the marinated beef in the same skillet over high heat 3-4 minutes, until browned.",
      "Fry the eggs sunny-side up.",
      "Divide the rice among bowls and top each with beef, the prepared vegetables, a fried egg, and a spoonful of gochujang.",
    ],
  },
  {
    id: "french-onion-soup", title: "French Onion Soup", servings: 4, timeMinutes: 60,
    tags: ["french onion soup", "french", "soup", "comfort food", "dinner"],
    dietary: ["nut-free"],
    ingredients: [
      { qty: 4, unit: "tbsp", name: "butter" },
      { qty: 4, unit: "", name: "onions, thinly sliced" },
      { qty: 1, unit: "tsp", name: "sugar" },
      { qty: 2, unit: "tbsp", name: "all-purpose flour" },
      { qty: 6, unit: "cup", name: "beef broth" },
      { qty: 0.5, unit: "cup", name: "dry white wine (optional)" },
      { qty: 1, unit: "tsp", name: "fresh thyme" },
      { qty: 4, unit: "", name: "baguette slices, toasted" },
      { qty: 1.5, unit: "cup", name: "gruyere cheese, shredded" },
    ],
    steps: [
      "Melt butter in a large pot over medium-low heat and cook the onions with the sugar, stirring often, 35-40 minutes, until deeply caramelized.",
      "Sprinkle in the flour and cook 1 minute, then stir in the wine (if using), broth, and thyme; simmer 15 minutes.",
      "Ladle the soup into oven-safe bowls, top each with a toasted baguette slice and a generous handful of gruyere.",
      "Broil 2-3 minutes, until the cheese is melted and bubbling.",
    ],
  },
  {
    id: "quiche-lorraine", title: "Quiche Lorraine", servings: 6, timeMinutes: 60,
    tags: ["quiche", "french", "breakfast", "brunch", "eggs", "bacon"],
    dietary: ["nut-free"],
    ingredients: [
      { qty: 1, unit: "", name: "pie crust (9-inch), unbaked" },
      { qty: 6, unit: "", name: "bacon slices, cooked and chopped" },
      { qty: 1, unit: "cup", name: "shredded gruyere cheese" },
      { qty: 4, unit: "", name: "eggs" },
      { qty: 1.5, unit: "cup", name: "heavy cream" },
      { qty: 0.25, unit: "tsp", name: "nutmeg" },
      { qty: 0.5, unit: "tsp", name: "salt" },
      { qty: 0.25, unit: "tsp", name: "black pepper" },
    ],
    steps: [
      "Preheat the oven to 375°F (190°C) and fit the pie crust into a 9-inch pie dish.",
      "Scatter the cooked bacon and gruyere over the crust.",
      "Whisk the eggs, cream, nutmeg, salt, and pepper together and pour over the bacon and cheese.",
      "Bake 35-40 minutes, until the center is just set and the top is golden. Let cool 10 minutes before slicing.",
    ],
  },
  {
    id: "ratatouille", title: "Ratatouille", servings: 4, timeMinutes: 45,
    tags: ["ratatouille", "french", "vegan", "vegetarian", "dinner", "healthy"],
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 3, unit: "tbsp", name: "olive oil" },
      { qty: 1, unit: "", name: "eggplant, diced" },
      { qty: 2, unit: "", name: "zucchini, diced" },
      { qty: 1, unit: "", name: "red bell pepper, diced" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 3, unit: "", name: "garlic cloves, minced" },
      { qty: 3, unit: "cup", name: "canned diced tomatoes" },
      { qty: 1, unit: "tsp", name: "dried herbes de Provence (or dried thyme)" },
      { qty: 0.25, unit: "cup", name: "fresh basil, chopped" },
    ],
    steps: [
      "Heat 2 tbsp olive oil in a large pot over medium heat and sauté the onion and bell pepper 5 minutes.",
      "Add the eggplant and zucchini and cook 8-10 minutes, stirring occasionally, until softened.",
      "Add garlic and cook 1 minute, then stir in the tomatoes and herbes de Provence.",
      "Simmer uncovered 20 minutes, until the vegetables are tender and the sauce has thickened.",
      "Drizzle with the remaining olive oil and top with fresh basil before serving.",
    ],
  },
  {
    id: "margherita-pizza", title: "Margherita Pizza", servings: 4, timeMinutes: 30,
    tags: ["pizza", "italian", "vegetarian", "dinner", "kid-friendly"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "pizza dough" },
      { qty: 0.5, unit: "cup", name: "pizza or marinara sauce" },
      { qty: 8, unit: "oz", name: "fresh mozzarella, sliced" },
      { qty: 0.25, unit: "cup", name: "fresh basil leaves" },
      { qty: 2, unit: "tbsp", name: "olive oil" },
      { qty: 0.5, unit: "tsp", name: "salt" },
    ],
    steps: [
      "Preheat the oven (with a pizza stone or sheet pan inside, if you have one) to 475°F (245°C).",
      "Stretch or roll the dough out on a floured surface into a round.",
      "Spread the sauce over the dough, leaving a border, then top with mozzarella slices.",
      "Bake 10-12 minutes, until the crust is golden and the cheese is bubbling.",
      "Top with fresh basil, a drizzle of olive oil, and a pinch of salt before slicing.",
    ],
  },
  {
    id: "minestrone-soup", title: "Minestrone Soup", servings: 6, timeMinutes: 40,
    tags: ["minestrone", "italian", "soup", "vegan", "vegetarian", "healthy", "dinner", "lunch"],
    dietary: ["vegetarian", "vegan", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 2, unit: "tbsp", name: "olive oil" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 2, unit: "", name: "carrots, diced" },
      { qty: 2, unit: "", name: "celery stalks, diced" },
      { qty: 3, unit: "", name: "garlic cloves, minced" },
      { qty: 6, unit: "cup", name: "vegetable broth" },
      { qty: 3, unit: "cup", name: "canned diced tomatoes" },
      { qty: 2, unit: "cup", name: "canned kidney beans, drained" },
      { qty: 1, unit: "cup", name: "small pasta (such as ditalini)" },
      { qty: 2, unit: "cup", name: "zucchini, diced" },
      { qty: 2, unit: "cup", name: "fresh spinach" },
      { qty: 1, unit: "tsp", name: "dried oregano" },
    ],
    steps: [
      "Heat olive oil in a large pot over medium heat and sauté the onion, carrots, and celery 5-6 minutes.",
      "Add garlic and cook 1 minute, then stir in the broth, tomatoes, beans, and oregano; bring to a boil.",
      "Add the pasta and zucchini; simmer 10-12 minutes, until the pasta is tender.",
      "Stir in the spinach just before serving, until wilted.",
    ],
  },
  {
    id: "slow-cooker-pulled-pork", title: "Slow Cooker Pulled Pork", servings: 8, timeMinutes: 480,
    tags: ["pulled pork", "slow cooker", "pork", "dinner", "bbq", "make-ahead"],
    dietary: ["gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 4, unit: "lb", name: "pork shoulder" },
      { qty: 1, unit: "tbsp", name: "paprika" },
      { qty: 1, unit: "tbsp", name: "brown sugar" },
      { qty: 1, unit: "tsp", name: "garlic powder" },
      { qty: 1, unit: "tsp", name: "onion powder" },
      { qty: 1, unit: "tsp", name: "salt" },
      { qty: 0.5, unit: "cup", name: "chicken broth" },
      { qty: 1.5, unit: "cup", name: "gluten-free barbecue sauce" },
      { qty: 8, unit: "", name: "hamburger buns (use gluten-free buns if needed)" },
    ],
    steps: [
      "Rub the pork shoulder all over with paprika, brown sugar, garlic powder, onion powder, and salt.",
      "Place in a slow cooker with the chicken broth; cover and cook on low 8 hours, until the pork shreds easily with a fork.",
      "Remove the pork, shred it, and discard excess fat and liquid.",
      "Toss the shredded pork with the barbecue sauce and serve on buns.",
    ],
  },
  {
    id: "one-pot-chicken-rice", title: "One-Pot Chicken and Rice", servings: 4, timeMinutes: 40,
    tags: ["one pot", "chicken", "rice", "dinner", "easy", "weeknight"],
    dietary: ["gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 2, unit: "tbsp", name: "olive oil" },
      { qty: 4, unit: "", name: "chicken thighs, bone-in" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 1.5, unit: "cup", name: "long-grain rice" },
      { qty: 3, unit: "cup", name: "chicken broth" },
      { qty: 1, unit: "cup", name: "frozen peas and carrots" },
      { qty: 1, unit: "tsp", name: "paprika" },
      { qty: 0.5, unit: "tsp", name: "salt" },
    ],
    steps: [
      "Heat olive oil in a large pot or deep skillet over medium-high heat and brown the chicken thighs, about 4 minutes per side; remove and set aside.",
      "Add the onion to the pot and cook 4 minutes, then add garlic and cook 1 minute more.",
      "Stir in the rice, broth, paprika, and salt, then nestle the chicken back into the pot.",
      "Cover and simmer 20-25 minutes, until the rice is tender and the chicken is cooked through, stirring in the peas and carrots for the last 5 minutes.",
    ],
  },
  {
    id: "vegan-buddha-bowl", title: "Vegan Buddha Bowl", servings: 4, timeMinutes: 35,
    tags: ["buddha bowl", "vegan", "vegetarian", "healthy", "lunch", "dinner", "grain bowl"],
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 1.5, unit: "cup", name: "quinoa, rinsed" },
      { qty: 3, unit: "cup", name: "vegetable broth or water" },
      { qty: 2, unit: "", name: "sweet potatoes, cubed" },
      { qty: 2, unit: "tbsp", name: "olive oil" },
      { qty: 3, unit: "cup", name: "canned chickpeas, drained and rinsed" },
      { qty: 4, unit: "cup", name: "kale, chopped" },
      { qty: 1, unit: "", name: "avocado, sliced" },
      { qty: 3, unit: "tbsp", name: "tahini" },
      { qty: 2, unit: "tbsp", name: "lemon juice" },
      { qty: 2, unit: "tbsp", name: "water, for dressing" },
      { qty: 1, unit: "", name: "garlic clove, minced" },
    ],
    steps: [
      "Preheat the oven to 400°F (200°C). Toss the sweet potatoes and chickpeas with 1 tbsp olive oil and roast 25-30 minutes, until tender and lightly browned.",
      "Meanwhile, cook the quinoa in the vegetable broth according to package directions.",
      "Massage the kale with the remaining olive oil until slightly softened.",
      "Whisk together the tahini, lemon juice, water, and garlic for the dressing.",
      "Divide the quinoa among bowls and top with the roasted sweet potatoes and chickpeas, kale, and avocado; drizzle with the tahini dressing.",
    ],
  },
  {
    id: "beef-and-broccoli", title: "Beef and Broccoli", servings: 4, timeMinutes: 25,
    tags: ["beef and broccoli", "chinese", "beef", "dinner", "quick", "easy", "asian", "weeknight"],
    dietary: ["dairy-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "flank steak, thinly sliced" },
      { qty: 2, unit: "tbsp", name: "cornstarch" },
      { qty: 4, unit: "tbsp", name: "soy sauce" },
      { qty: 2, unit: "tbsp", name: "oyster sauce" },
      { qty: 1, unit: "tbsp", name: "brown sugar" },
      { qty: 0.5, unit: "cup", name: "beef broth" },
      { qty: 2, unit: "tbsp", name: "vegetable oil" },
      { qty: 4, unit: "cup", name: "broccoli florets" },
      { qty: 3, unit: "", name: "garlic cloves, minced" },
      { qty: 1, unit: "tsp", name: "fresh ginger, grated" },
      { qty: 4, unit: "cup", name: "cooked rice, for serving" },
    ],
    steps: [
      "Toss the sliced steak with 1 tbsp cornstarch; whisk the remaining cornstarch with the soy sauce, oyster sauce, brown sugar, and beef broth for the sauce.",
      "Heat 1 tbsp oil in a large skillet or wok over high heat and cook the beef until browned, about 3 minutes; remove and set aside.",
      "Add the remaining oil and stir-fry the broccoli 3-4 minutes, until crisp-tender.",
      "Add garlic and ginger and cook 30 seconds, then return the beef to the pan and pour in the sauce.",
      "Toss until the sauce thickens and coats everything, about 1-2 minutes. Serve over rice.",
    ],
  },
  {
    id: "chicken-noodle-soup", title: "Chicken Noodle Soup", servings: 6, timeMinutes: 45,
    tags: ["chicken noodle soup", "soup", "comfort food", "dinner", "lunch", "healthy"],
    dietary: ["dairy-free", "nut-free"],
    ingredients: [
      { qty: 1, unit: "tbsp", name: "olive oil" },
      { qty: 1, unit: "", name: "onion, diced" },
      { qty: 2, unit: "", name: "carrots, sliced" },
      { qty: 2, unit: "", name: "celery stalks, sliced" },
      { qty: 2, unit: "", name: "garlic cloves, minced" },
      { qty: 8, unit: "cup", name: "chicken broth" },
      { qty: 2, unit: "cup", name: "cooked, shredded chicken" },
      { qty: 2, unit: "cup", name: "egg noodles" },
      { qty: 1, unit: "tsp", name: "dried thyme" },
      { qty: 0.25, unit: "cup", name: "fresh parsley, chopped" },
    ],
    steps: [
      "Heat olive oil in a large pot over medium heat and sauté the onion, carrots, and celery 6-7 minutes.",
      "Add garlic and cook 1 minute, then pour in the broth and thyme; bring to a boil.",
      "Add the egg noodles and cook according to package directions, until tender.",
      "Stir in the shredded chicken and parsley and heat through before serving.",
    ],
  },
  {
    id: "baked-mac-and-cheese", title: "Baked Mac and Cheese", servings: 6, timeMinutes: 40,
    tags: ["mac and cheese", "pasta", "vegetarian", "kid-friendly", "comfort food", "dinner"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 1, unit: "lb", name: "elbow macaroni" },
      { qty: 4, unit: "tbsp", name: "butter" },
      { qty: 0.25, unit: "cup", name: "all-purpose flour" },
      { qty: 3, unit: "cup", name: "milk" },
      { qty: 3, unit: "cup", name: "shredded cheddar cheese" },
      { qty: 1, unit: "cup", name: "shredded mozzarella" },
      { qty: 0.5, unit: "tsp", name: "salt" },
      { qty: 0.5, unit: "cup", name: "breadcrumbs" },
    ],
    steps: [
      "Preheat the oven to 375°F (190°C). Cook the macaroni in salted water until just shy of al dente; drain.",
      "Melt the butter in a large saucepan over medium heat, whisk in the flour, and cook 1 minute.",
      "Gradually whisk in the milk and cook, stirring, until thickened, about 5 minutes.",
      "Remove from heat and stir in the cheddar, mozzarella, and salt until smooth, then fold in the macaroni.",
      "Pour into a baking dish, top with breadcrumbs, and bake 20-25 minutes, until golden and bubbling.",
    ],
  },
  {
    id: "sheet-pan-chicken-fajitas", title: "Sheet Pan Chicken Fajitas", servings: 4, timeMinutes: 30,
    tags: ["fajitas", "mexican", "chicken", "sheet pan", "dinner", "quick", "easy", "weeknight"],
    dietary: ["gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 1.5, unit: "lb", name: "chicken breast, sliced into strips" },
      { qty: 2, unit: "", name: "bell peppers, sliced" },
      { qty: 1, unit: "", name: "onion, sliced" },
      { qty: 3, unit: "tbsp", name: "olive oil" },
      { qty: 2, unit: "tsp", name: "chili powder" },
      { qty: 1, unit: "tsp", name: "ground cumin" },
      { qty: 1, unit: "tsp", name: "garlic powder" },
      { qty: 0.5, unit: "tsp", name: "salt" },
      { qty: 8, unit: "", name: "corn tortillas" },
      { qty: 1, unit: "", name: "lime, cut into wedges" },
    ],
    steps: [
      "Preheat the oven to 425°F (220°C).",
      "Toss the chicken, bell peppers, and onion with olive oil, chili powder, cumin, garlic powder, and salt on a sheet pan.",
      "Roast 18-20 minutes, stirring halfway, until the chicken is cooked through and the vegetables are tender.",
      "Warm the tortillas and serve the chicken and vegetables with lime wedges.",
    ],
  },
  {
    id: "breakfast-burrito", title: "Breakfast Burrito", servings: 4, timeMinutes: 25,
    tags: ["breakfast burrito", "breakfast", "mexican", "eggs", "vegetarian", "quick", "easy"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 8, unit: "", name: "eggs" },
      { qty: 1, unit: "tbsp", name: "butter" },
      { qty: 1, unit: "cup", name: "canned black beans, drained and rinsed" },
      { qty: 1, unit: "cup", name: "shredded cheddar cheese" },
      { qty: 0.5, unit: "cup", name: "salsa" },
      { qty: 4, unit: "", name: "large flour tortillas" },
      { qty: 1, unit: "", name: "avocado, sliced" },
    ],
    steps: [
      "Whisk the eggs and scramble in butter over medium heat until just set, about 3-4 minutes.",
      "Warm the black beans in a small saucepan or the microwave.",
      "Warm the tortillas, then fill each with scrambled eggs, black beans, cheese, salsa, and avocado.",
      "Fold in the sides and roll up tightly to serve.",
    ],
  },
  {
    id: "blueberry-muffins", title: "Blueberry Muffins", servings: 12, timeMinutes: 40,
    tags: ["blueberry muffins", "breakfast", "baking", "vegetarian", "sweet", "snack"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 2, unit: "cup", name: "all-purpose flour" },
      { qty: 0.75, unit: "cup", name: "sugar" },
      { qty: 2, unit: "tsp", name: "baking powder" },
      { qty: 0.5, unit: "tsp", name: "salt" },
      { qty: 2, unit: "", name: "eggs" },
      { qty: 0.5, unit: "cup", name: "vegetable oil" },
      { qty: 0.5, unit: "cup", name: "milk" },
      { qty: 1, unit: "tsp", name: "vanilla extract" },
      { qty: 1.5, unit: "cup", name: "fresh or frozen blueberries" },
    ],
    steps: [
      "Preheat the oven to 400°F (200°C) and line a muffin tin with liners.",
      "Whisk together the flour, sugar, baking powder, and salt in a large bowl.",
      "In a separate bowl, whisk the eggs, oil, milk, and vanilla, then stir into the dry ingredients just until combined.",
      "Gently fold in the blueberries.",
      "Divide the batter among the muffin cups and bake 18-20 minutes, until a toothpick comes out clean.",
    ],
  },
  {
    id: "apple-crisp", title: "Apple Crisp", servings: 8, timeMinutes: 55,
    tags: ["apple crisp", "dessert", "baking", "vegetarian", "sweet", "fall"],
    dietary: ["vegetarian", "nut-free"],
    ingredients: [
      { qty: 6, unit: "", name: "apples, peeled and sliced" },
      { qty: 2, unit: "tbsp", name: "sugar" },
      { qty: 1, unit: "tbsp", name: "lemon juice" },
      { qty: 1, unit: "tsp", name: "cinnamon" },
      { qty: 1, unit: "cup", name: "rolled oats" },
      { qty: 0.75, unit: "cup", name: "all-purpose flour" },
      { qty: 0.5, unit: "cup", name: "brown sugar" },
      { qty: 0.5, unit: "cup", name: "butter, melted" },
      { qty: 0.25, unit: "tsp", name: "salt" },
    ],
    steps: [
      "Preheat the oven to 350°F (175°C) and grease a baking dish.",
      "Toss the sliced apples with the sugar, lemon juice, and cinnamon and spread in the baking dish.",
      "Mix the oats, flour, brown sugar, melted butter, and salt until crumbly.",
      "Sprinkle the topping evenly over the apples.",
      "Bake 40-45 minutes, until the topping is golden and the apples are bubbling.",
    ],
  },
  {
    id: "smoothie-bowl", title: "Smoothie Bowl", servings: 2, timeMinutes: 10,
    tags: ["smoothie bowl", "breakfast", "vegan", "vegetarian", "healthy", "no-cook", "quick", "easy"],
    dietary: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    ingredients: [
      { qty: 2, unit: "", name: "frozen bananas" },
      { qty: 1.5, unit: "cup", name: "frozen mixed berries" },
      { qty: 1, unit: "cup", name: "unsweetened oat milk" },
      { qty: 0.5, unit: "cup", name: "nut-free granola" },
      { qty: 1, unit: "tbsp", name: "chia seeds" },
      { qty: 0.5, unit: "cup", name: "sliced fresh fruit, for topping" },
    ],
    steps: [
      "Blend the frozen bananas, berries, and oat milk until thick and smooth, adding a splash more oat milk if needed to blend.",
      "Pour into bowls.",
      "Top with granola, chia seeds, and fresh fruit.",
    ],
  },
];

// Recognizes dietary needs mentioned in a free-text request. Only phrases
// that clearly name the restriction count — this deliberately doesn't try
// to infer "healthy" or "light" as a dietary filter, since those are too
// vague to safely exclude recipes on.
const DIETARY_KEYWORDS = {
  vegetarian: ["vegetarian"],
  vegan: ["vegan"],
  "gluten-free": ["gluten free", "gluten-free", "glutenfree"],
  "dairy-free": ["dairy free", "dairy-free", "dairyfree", "lactose free", "lactose-free"],
  "nut-free": ["nut free", "nut-free", "nutfree"],
};

function detectDietaryFilters(text) {
  const found = [];
  for (const key of Object.keys(DIETARY_KEYWORDS)) {
    if (DIETARY_KEYWORDS[key].some((p) => text.includes(p))) found.push(key);
  }
  return found;
}

// Looks for "for 4", "serves 6", "6 people", "4 servings" in the request.
function parseServingsFromRequest(text) {
  const t = (text || "").toLowerCase();
  let m = t.match(/for\s+(\d+)(?:\s*(?:people|servings))?/);
  if (!m) m = t.match(/serves\s+(\d+)/);
  if (!m) m = t.match(/(\d+)\s*(?:people|servings|guests)/);
  if (!m) m = t.match(/(?:party|group|crowd)\s+of\s+(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

// Ranks every template against the request text. Dietary needs are treated
// as a hard filter (a stated restriction should never be silently ignored)
// unless every template would be excluded, in which case the caller is told
// via `dietaryOk` on the top result rather than getting an empty result.
function matchRecipeTemplates(requestText) {
  const text = (requestText || "").toLowerCase();
  const words = text.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const dietaryFilters = detectDietaryFilters(text);

  let pool = RECIPE_TEMPLATES;
  if (dietaryFilters.length) {
    const filtered = RECIPE_TEMPLATES.filter((t) => dietaryFilters.every((d) => t.dietary.includes(d)));
    if (filtered.length) pool = filtered;
  }

  const timeMatch = text.match(/(\d+)\s*min/);
  const wantsQuick = /\bquick\b|\bfast\b|\beasy\b|\bweeknight\b/.test(text);
  const maxMinutes = timeMatch ? parseInt(timeMatch[1], 10) : (wantsQuick ? 30 : null);

  // Meal-type words matter more than an incidental ingredient-name match
  // (e.g. a parenthetical aside shouldn't outweigh "dinner" actually being
  // in a recipe's own tags), so they're weighted higher. Parenthetical
  // asides in ingredient names (like "certified gluten-free if needed")
  // are notes for the cook, not searchable keywords, so they're stripped
  // before matching.
  const MEAL_WORDS = ["breakfast", "lunch", "dinner", "dessert", "snack", "brunch"];
  function score(t) {
    let s = 0;
    const haystack = [t.title, ...t.tags, ...t.ingredients.map((i) => i.name.replace(/\([^)]*\)/g, ""))]
      .join(" ").toLowerCase();
    for (const w of words) {
      if (!haystack.includes(w)) continue;
      s += MEAL_WORDS.includes(w) ? 2 : 1;
    }
    if (maxMinutes != null && t.timeMinutes <= maxMinutes) s += 1;
    return s;
  }

  return pool
    .map((t) => ({ template: t, score: score(t), dietaryOk: dietaryFilters.every((d) => t.dietary.includes(d)) }))
    .sort((a, b) => b.score - a.score);
}

// Builds a real recipe (title, scaled ingredients, steps) from a free-text
// request. `matchedWell` and `dietaryHonored` are reported honestly so the
// UI can say plainly when a request didn't have a close match, rather than
// implying every result was purpose-built.
function generateRecipe(requestText, desiredServings) {
  const ranked = matchRecipeTemplates(requestText);
  const top = ranked[0];
  const template = top.template;
  const requestedServings = parseServingsFromRequest(requestText);
  const servings = (desiredServings && desiredServings > 0) ? desiredServings
    : (requestedServings && requestedServings > 0) ? requestedServings
    : template.servings;
  const ingredients = template.ingredients.map((i) => ({
    qty: i.qty == null ? null : scaleQty(i.qty, template.servings, servings),
    unit: i.unit,
    name: i.name,
  }));
  return {
    id: template.id,
    title: template.title,
    servings,
    baseServings: template.servings,
    timeMinutes: template.timeMinutes,
    dietary: template.dietary,
    ingredients,
    steps: template.steps,
    matchedWell: top.score > 0,
    dietaryHonored: top.dietaryOk,
    requestedDietary: detectDietaryFilters((requestText || "").toLowerCase()),
  };
}

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

// ---------- Substitution Tips (static curated reference) ----------
// General cooking swaps for when you're missing an ingredient — distinct
// from the Allergen Checker's substitutions, which are specifically about
// avoiding an allergen/dietary restriction rather than "I'm just out of it."
// Organized into folders the same way Recipes/Temperature/Allergen are.
const SUBSTITUTION_CATEGORIES = [
  {
    key: "baking",
    label: "Baking & Leavening",
    icon: "whisk",
    color: "butter",
    entries: [
      { need: "Buttermilk", sub: "1 cup milk + 1 tbsp lemon juice or vinegar", note: "Let it sit 5–10 minutes until slightly thickened." },
      { need: "Baking powder", sub: "1/4 tsp baking soda + 1/2 tsp cream of tartar, per 1 tsp needed", note: "Mix in right before baking — it starts reacting immediately." },
      { need: "Self-rising flour", sub: "1 cup all-purpose flour + 1 1/2 tsp baking powder + 1/4 tsp salt", note: "" },
      { need: "Brown sugar", sub: "1 cup white sugar + 1 tbsp molasses", note: "Use 2 tbsp molasses for a dark-brown-sugar flavor." },
      { need: "Cake flour", sub: "1 cup all-purpose flour, minus 2 tbsp, + 2 tbsp cornstarch", note: "Sift together well before using." },
      { need: "Vanilla extract", sub: "Maple syrup, or almond extract at half the amount", note: "The flavor will shift slightly." },
    ],
  },
  {
    key: "dairy-eggs",
    label: "Dairy & Eggs",
    icon: "egg",
    color: "blush",
    entries: [
      { need: "Eggs, for binding", sub: "1 tbsp ground flaxseed + 3 tbsp water, per egg", note: "Stir and let it sit about 5 minutes to gel." },
      { need: "Eggs, for baking", sub: "1/4 cup unsweetened applesauce or mashed banana, per egg", note: "Adds a little extra sweetness and moisture." },
      { need: "Heavy cream", sub: "3/4 cup milk + 1/4 cup melted butter", note: "Fine for cooking and baking, but it won't whip." },
      { need: "Sour cream", sub: "Plain yogurt, same amount", note: "Full-fat Greek yogurt gives the closest texture." },
      { need: "Butter, in baking", sub: "About 3/4 the amount of a neutral oil", note: "Results will be a bit more tender and moist." },
      { need: "Milk", sub: "Any nut or oat milk, or water with a splash of cream", note: "" },
    ],
  },
  {
    key: "produce",
    label: "Produce & Aromatics",
    icon: "carrot",
    color: "",
    entries: [
      { need: "Fresh garlic", sub: "1/4 tsp garlic powder per clove", note: "" },
      { need: "Fresh onion", sub: "1 tbsp dried minced onion per 1/4 cup fresh, chopped", note: "Rehydrate it in the recipe's liquid first if you can." },
      { need: "Fresh herbs", sub: "Dried herbs, about 1/3 the amount", note: "Add them earlier in cooking so they have time to rehydrate." },
      { need: "Lemon juice", sub: "White vinegar, about half the amount", note: "" },
      { need: "Shallot", sub: "A small onion plus a little extra garlic", note: "" },
      { need: "Fresh ginger", sub: "1/4 tsp ground ginger per tablespoon fresh", note: "" },
    ],
  },
  {
    key: "pantry",
    label: "Pantry & Sauces",
    icon: "jar",
    color: "blush",
    entries: [
      { need: "Cornstarch, for thickening", sub: "Twice the amount of all-purpose flour", note: "" },
      { need: "Breadcrumbs", sub: "Crushed crackers, rolled oats, or panko", note: "" },
      { need: "Wine, in a sauce", sub: "Broth with a splash of vinegar or lemon juice", note: "" },
      { need: "Soy sauce", sub: "Worcestershire sauce, or a well-salted broth", note: "Not gluten-free by default — see the Allergen Checker for that." },
      { need: "Tomato paste", sub: "About 3x the amount of ketchup", note: "Cut back on any added sugar elsewhere in the recipe." },
      { need: "Honey", sub: "Equal parts maple syrup or agave", note: "" },
    ],
  },
];

// Exposed for app.js (browser <script> include, no bundler in Phase 1) and
// for the Node-based test script.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VOLUME_TO_ML, WEIGHT_TO_G, DENSITY_G_PER_CUP, OVEN_TEMP_QUICK_REF, SAFE_MEAT_TEMPS, POPULAR_CONVERSIONS, OVEN_TYPES, ALLERGEN_MAP,
    findDensity, convertUnit, scaleQty, fToC, cToF, altitudeAdjustment, checkAllergens, findIngredientSubstitutions, fmtNum, fmtQty,
    parseOcrText,
    RECIPE_TEMPLATES, detectDietaryFilters, parseServingsFromRequest, matchRecipeTemplates, generateRecipe,
    SUBSTITUTION_CATEGORIES,
  };
}
