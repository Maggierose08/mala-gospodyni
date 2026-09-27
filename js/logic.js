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

// Exposed for app.js (browser <script> include, no bundler in Phase 1) and
// for the Node-based test script.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    VOLUME_TO_ML, WEIGHT_TO_G, DENSITY_G_PER_CUP, OVEN_TEMP_QUICK_REF, POPULAR_CONVERSIONS, OVEN_TYPES, ALLERGEN_MAP,
    findDensity, convertUnit, scaleQty, fToC, cToF, altitudeAdjustment, checkAllergens, fmtNum,
    parseOcrText,
    RECIPE_TEMPLATES, detectDietaryFilters, parseServingsFromRequest, matchRecipeTemplates, generateRecipe,
  };
}
