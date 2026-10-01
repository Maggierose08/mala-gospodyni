const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const logicSrc = fs.readFileSync(path.join(__dirname, "js/logic.js"), "utf8");
const appSrc = fs.readFileSync(path.join(__dirname, "js/app.js"), "utf8");

const dom = new JSDOM(html, { url: "http://localhost/mala-gospodyni/index.html", runScripts: "dangerously", resources: "usable" });
const { window } = dom;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { fail++; console.error("FAIL:", msg); } }

// Manually inject the two scripts in a single eval call (avoids needing a real
// static file server for <script src>; a separate eval() per file would give
// logic.js's top-level `const`s their own lexical scope, invisible to app.js).
// Note: jsdom does not execute the <script type="module" src="js/firebase-init.js">
// tag (module scripts referencing cross-origin CDN imports aren't runnable
// here), so window.MG stays undefined unless a test mocks it below — that
// naturally exercises the signed-out code path everywhere except the
// dedicated mocked-signed-in Profile test at the end.
window.eval(logicSrc + "\n;\n" + appSrc);
window.document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
window.dispatchEvent(new window.Event("DOMContentLoaded"));

function go(hash) {
  window.location.hash = hash;
  window.dispatchEvent(new window.Event("hashchange"));
}

// Save/delete are now async (they await upsertRecipe/deleteRecipe, which in
// turn await window.MG's cloud calls when signed in). Give the microtask
// queue a turn before asserting on their effects.
function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

async function main() {
  // ---- Home screen ----
  go("#/home");
  const homeBoxes = window.document.querySelectorAll(".home-box");
  assert(homeBoxes.length === 6, "home screen shows 6 boxes, got " + homeBoxes.length);
  assert(window.document.querySelectorAll(".quick-link").length === 4, "home screen shows 4 quick links");

  // ---- fmtQty: ingredient quantities display as fractions ----
  assert(window.fmtQty(0.25) === "1/4", "fmtQty(0.25) shows as 1/4, got " + window.fmtQty(0.25));
  assert(window.fmtQty(0.5) === "1/2", "fmtQty(0.5) shows as 1/2, got " + window.fmtQty(0.5));
  assert(window.fmtQty(0.75) === "3/4", "fmtQty(0.75) shows as 3/4, got " + window.fmtQty(0.75));
  assert(window.fmtQty(0.33) === "1/3", "fmtQty(0.33) shows as 1/3 (close enough to 1/3), got " + window.fmtQty(0.33));
  assert(window.fmtQty(1.5) === "1 1/2", "fmtQty(1.5) shows as a mixed number 1 1/2, got " + window.fmtQty(1.5));
  assert(window.fmtQty(2.25) === "2 1/4", "fmtQty(2.25) shows as a mixed number 2 1/4, got " + window.fmtQty(2.25));
  assert(window.fmtQty(4) === "4", "fmtQty(4) shows as a plain whole number, got " + window.fmtQty(4));
  assert(window.fmtQty(2.15) === "2.15", "fmtQty(2.15) falls back to a plain decimal since it isn't close to a common cooking fraction, got " + window.fmtQty(2.15));
  // fmtNum (used for unit-conversion results, not ingredient quantities) is
  // untouched -- it should still show a plain decimal, since "12 1/2 g" for
  // 12.5 grams of sugar would be wrong.
  assert(window.fmtNum(12.5) === "12.5", "fmtNum(12.5) still shows a plain decimal (not a fraction), got " + window.fmtNum(12.5));

  // ---- Recipes list (empty) ----
  go("#/recipes");
  assert(/No recipes saved yet/.test(window.document.getElementById("view").textContent), "empty recipes list shows message");
  assert(/Sign in.*sync/i.test(window.document.getElementById("view").textContent), "recipes list shows local-only sync hint when signed out");
  const folderBoxes = window.document.querySelectorAll("#view .home-box");
  assert(folderBoxes.length === 4, "recipes list shows the 4 category folders (no Uncategorized folder yet, since nothing's saved), got " + folderBoxes.length);
  assert(/Main Courses/.test(window.document.getElementById("view").textContent), "recipes list includes a Main Courses folder");
  assert(/Desserts/.test(window.document.getElementById("view").textContent), "recipes list includes a Desserts folder");
  assert(/Sides/.test(window.document.getElementById("view").textContent), "recipes list includes a Sides folder");
  assert(/Appetizers/.test(window.document.getElementById("view").textContent), "recipes list includes an Appetizers folder");

  // ---- Create a new recipe ----
  go("#/recipe/new");
  assert(!!window.document.getElementById("scan-input"), "scan file input renders on New Recipe form");
  assert(!!window.document.getElementById("scan-reminder"), "scan reminder banner renders (hidden) on New Recipe form");
  assert(window.document.getElementById("scan-reminder").style.display === "none", "scan reminder banner starts hidden");
  window.document.getElementById("recipe-title").value = "Test Banana Bread";
  window.document.getElementById("orig-servings").value = "4";
  const rows = window.document.querySelectorAll(".ing-row");
  assert(rows.length === 1, "new recipe form starts with 1 blank ingredient row");
  rows[0].querySelector(".ing-qty").value = "2";
  rows[0].querySelector(".ing-unit").value = "cup";
  rows[0].querySelector(".ing-name").value = "all-purpose flour";

  window.document.getElementById("add-ingredient-btn").click();
  const rows2 = window.document.querySelectorAll(".ing-row");
  assert(rows2.length === 2, "add-ingredient button adds a row");
  rows2[1].querySelector(".ing-qty").value = "2";
  rows2[1].querySelector(".ing-unit").value = "";
  rows2[1].querySelector(".ing-name").value = "eggs";

  // File it under Desserts via the category pills.
  const dessertPill = Array.from(window.document.querySelectorAll(".category-pill")).find((p) => p.getAttribute("data-category") === "dessert");
  assert(!!dessertPill, "new recipe form shows a Desserts category pill");
  dessertPill.click();
  assert(dessertPill.classList.contains("selected"), "clicking the Desserts pill selects it");

  window.document.getElementById("save-recipe-btn").click();
  await flush();

  const saved = JSON.parse(window.localStorage.getItem("mg_recipes_v1"));
  assert(Array.isArray(saved) && saved.length === 1, "recipe persisted to localStorage");
  assert(saved[0].title === "Test Banana Bread", "saved recipe has correct title");
  assert(saved[0].ingredients.length === 2, "saved recipe has 2 ingredients");
  assert(saved[0].category === "dessert", "saved recipe remembers its chosen category, got: " + saved[0].category);
  assert(window.location.hash === "#/recipes", "saving redirects to recipes list");

  // ---- Recipes list now shows an updated Desserts count ----
  go("#/recipes");
  assert(/Desserts/.test(window.document.getElementById("view").textContent) && /1 recipe/.test(window.document.getElementById("view").textContent), "Desserts folder shows a count of 1");
  assert(window.document.querySelectorAll("#view .home-box").length === 4, "still no Uncategorized folder, since the one recipe was filed under Desserts");

  // ---- Search within own Recipes ----
  const recipesSearchInput = window.document.getElementById("recipes-search");
  assert(!!recipesSearchInput, "Recipes list shows a search box once there's at least one recipe");
  recipesSearchInput.value = "banana";
  recipesSearchInput.dispatchEvent(new window.Event("input"));
  assert(window.document.getElementById("recipes-folders").style.display === "none", "typing a search query hides the folder grid");
  assert(/Test Banana Bread/.test(window.document.getElementById("recipes-search-results").textContent), "search results include a title match");
  recipesSearchInput.value = "flour";
  recipesSearchInput.dispatchEvent(new window.Event("input"));
  assert(/Test Banana Bread/.test(window.document.getElementById("recipes-search-results").textContent), "search also matches on ingredient name");
  recipesSearchInput.value = "nothing matches this";
  recipesSearchInput.dispatchEvent(new window.Event("input"));
  assert(/No recipes match/.test(window.document.getElementById("recipes-search-results").textContent), "search shows a no-match message");
  recipesSearchInput.value = "";
  recipesSearchInput.dispatchEvent(new window.Event("input"));
  assert(window.document.getElementById("recipes-folders").style.display === "", "clearing the search restores the folder grid");

  // ---- Drilling into the Desserts folder shows the recipe ----
  go("#/recipes/dessert");
  assert(/Test Banana Bread/.test(window.document.getElementById("view").textContent), "Desserts folder page shows the saved recipe");
  const dessertBackBtn = window.document.getElementById("back-btn");
  assert(dessertBackBtn.getAttribute("data-back-route") === "#/recipes", "Desserts folder page's back button returns to the Recipes folder grid, not Home");

  const recipeId = saved[0].id;

  // ---- Scale Converter ----
  // The Scale Converter tab is now a folder grid (same pattern as Recipes):
  // "Popular Conversions" and "Convert Your Own" are separate pages.
  go("#/scale");
  const scaleFolderBoxes = window.document.querySelectorAll("#view .home-box");
  assert(scaleFolderBoxes.length === 2, "scale converter shows 2 folders (Popular Conversions, Convert Your Own), got " + scaleFolderBoxes.length);
  assert(/Popular Conversions/.test(window.document.getElementById("view").textContent), "scale converter folder grid includes Popular Conversions");
  assert(/Convert Your Own/.test(window.document.getElementById("view").textContent), "scale converter folder grid includes Convert Your Own");

  // Popular conversions quick-reference table
  go("#/scale/popular");
  const popularBackBtn = window.document.getElementById("back-btn");
  assert(popularBackBtn.getAttribute("data-back-route") === "#/scale", "Popular Conversions page's back button returns to the Scale Converter folder grid");
  const popRows = window.document.querySelectorAll(".temp-ref-table tr");
  assert(popRows.length === 18, "popular conversions table has header + 17 rows, got " + popRows.length);
  const popText = window.document.getElementById("view").textContent;
  assert(/1 kg[\s\S]*2\.2 lb/.test(popText), "popular conversions table includes 1 kg = 2.2 lb");
  assert(!/1 cup[\s\S]{0,20}16 tbsp/.test(popText), "popular conversions table no longer includes 1 cup = 16 tbsp");
  assert(/1 cup flour[\s\S]*120 g/.test(popText), "popular conversions table includes 1 cup flour = 120 g");
  assert(/1 tbsp sugar[\s\S]*12\.5 g/.test(popText), "popular conversions table includes 1 tbsp sugar = 12.5 g");
  assert(/1 cup butter[\s\S]*227 g/.test(popText), "popular conversions table includes 1 cup butter = 227 g");

  // "Convert Your Own" — saved recipe + ad-hoc entry
  go("#/scale/convert/" + recipeId);
  const convertBackBtn = window.document.getElementById("back-btn");
  assert(convertBackBtn.getAttribute("data-back-route") === "#/scale", "Convert Your Own page's back button returns to the Scale Converter folder grid");

  const targetInput = window.document.getElementById("target-servings");
  assert(targetInput.value == "4", "scale defaults target servings to original servings");
  targetInput.value = "8";
  targetInput.dispatchEvent(new window.Event("input"));
  const scaledRows = window.document.querySelectorAll("#scale-output .scaled-row");
  assert(scaledRows.length === 2, "scale output shows a row per ingredient");
  assert(/4 cup/.test(scaledRows[0].textContent), "doubling 4->8 servings doubles 2 cup flour to 4 cup, got: " + scaledRows[0].textContent);

  // per-ingredient convert-to
  const firstConvertSelect = window.document.querySelector("#scale-output select");
  firstConvertSelect.value = "g";
  firstConvertSelect.dispatchEvent(new window.Event("change"));
  assert(/480 g/.test(window.document.getElementById("scale-output").textContent), "4 cup flour converts to ~480g via density table");

  // "Convert your own ingredients" section (merged scan + manual entry) —
  // scan itself can't run headlessly (needs the real OCR engine + network),
  // but the surrounding controls are wired regardless of whether a scan ever
  // happened, and the section starts with one blank row pre-populated (like
  // the New Recipe form), so exercise it directly.
  assert(!!window.document.getElementById("scale-scan-input"), "scale converter shows its own scan control");
  assert(window.document.getElementById("scale-scan-reminder").style.display === "none", "scan-accuracy disclaimer stays hidden until a scan happens");
  assert(/Convert Your Own/.test(window.document.body.textContent), "scale converter's Convert Your Own page shows that title");
  assert(/Or use a saved recipe/.test(window.document.body.textContent), "scale converter labels the saved-recipe picker section");
  const adhocRow = window.document.querySelector("#adhoc-scale-ingredient-rows .ing-row");
  assert(!!adhocRow, "convert-your-own-ingredients section starts with one blank ingredient row");
  adhocRow.querySelector(".ing-qty").value = "1";
  adhocRow.querySelector(".ing-unit").value = "cup";
  adhocRow.querySelector(".ing-name").value = "sugar";
  adhocRow.querySelector(".ing-qty").dispatchEvent(new window.Event("input"));
  window.document.getElementById("adhoc-orig-servings").value = "2";
  window.document.getElementById("adhoc-orig-servings").dispatchEvent(new window.Event("input"));
  window.document.getElementById("adhoc-target-servings").value = "4";
  window.document.getElementById("adhoc-target-servings").dispatchEvent(new window.Event("input"));
  assert(/2 cup/.test(window.document.getElementById("adhoc-scale-output").textContent), "ad-hoc scale card scales a manually-entered ingredient (1 cup sugar, 2->4 servings = 2 cup), got: " + window.document.getElementById("adhoc-scale-output").textContent);

  // ---- Allergen Checker ----
  // The Allergen Checker tab is now a folder grid (same pattern as Recipes,
  // Scale Converter, and Temperature Converter): "Check Your Own
  // Ingredients" (a quick one-ingredient-at-a-time substitution lookup) and
  // "Measurement Differences" (the fuller whole-recipe checker) are
  // separate pages.
  go("#/allergen");
  const allergenFolderBoxes = window.document.querySelectorAll("#view .home-box");
  assert(allergenFolderBoxes.length === 2, "allergen checker shows 2 folders (Check Your Own Ingredients, Measurement Differences), got " + allergenFolderBoxes.length);
  const allergenHomeText = window.document.getElementById("view").textContent;
  assert(/Check Your Own Ingredients/.test(allergenHomeText), "allergen folder grid includes Check Your Own Ingredients");
  assert(/Measurement Differences/.test(allergenHomeText), "allergen folder grid includes Measurement Differences");

  // "Check Your Own Ingredients" — type one ingredient, substitutions
  // appear below (no allergen checkboxes needed, unlike Measurement
  // Differences — it looks up every category at once).
  go("#/allergen/check");
  const checkBackBtn = window.document.getElementById("back-btn");
  assert(checkBackBtn.getAttribute("data-back-route") === "#/allergen", "Check Your Own Ingredients page's back button returns to the Allergen Checker folder grid");
  const ingredientCheckInput = window.document.getElementById("ingredient-check-input");
  ingredientCheckInput.value = "milk";
  ingredientCheckInput.dispatchEvent(new window.Event("input"));
  const ingredientCheckResults = window.document.getElementById("ingredient-check-results").textContent;
  assert(/dairy/i.test(ingredientCheckResults) && /almond, oat, or soy milk/i.test(ingredientCheckResults), "typing 'milk' shows the dairy substitution suggestion, got: " + ingredientCheckResults);

  ingredientCheckInput.value = "soy sauce";
  ingredientCheckInput.dispatchEvent(new window.Event("input"));
  const soySauceResults = window.document.getElementById("ingredient-check-results").textContent;
  assert(/gluten/i.test(soySauceResults) && /soy/i.test(soySauceResults), "typing 'soy sauce' shows both its gluten and soy substitution suggestions, got: " + soySauceResults);

  ingredientCheckInput.value = "carrot";
  ingredientCheckInput.dispatchEvent(new window.Event("input"));
  assert(/no common allergy substitutions/i.test(window.document.getElementById("ingredient-check-results").textContent), "typing an ingredient with no known allergen match shows an honest no-match message");

  ingredientCheckInput.value = "";
  ingredientCheckInput.dispatchEvent(new window.Event("input"));
  assert(window.document.getElementById("ingredient-check-results").textContent === "", "clearing the ingredient field clears the results");

  // "Measurement Differences" — the fuller whole-recipe checker, typed in
  // by hand only (no photo scan here anymore) plus the saved-recipe picker.
  go("#/allergen/measurements/" + recipeId);
  const measurementsBackBtn = window.document.getElementById("back-btn");
  assert(measurementsBackBtn.getAttribute("data-back-route") === "#/allergen", "Measurement Differences page's back button returns to the Allergen Checker folder grid");
  assert(!window.document.getElementById("allergen-scan-input"), "Measurement Differences no longer shows a photo-scan control");
  assert(/Or use a saved recipe/.test(window.document.body.textContent), "Measurement Differences labels the saved-recipe picker section");

  const glutenChk = Array.from(window.document.querySelectorAll(".saved-allergen-chk")).find((c) => c.value === "gluten");
  const eggChk = Array.from(window.document.querySelectorAll(".saved-allergen-chk")).find((c) => c.value === "egg");
  glutenChk.checked = true;
  eggChk.checked = true;
  window.document.getElementById("saved-check-allergens-btn").click();
  const results = window.document.getElementById("saved-allergen-results").textContent;
  assert(/flour/i.test(results) && /gluten-free/i.test(results), "allergen checker flags flour for gluten");
  assert(/eggs/i.test(results) && /flaxseed/i.test(results), "allergen checker flags eggs with flaxseed ratio");

  const adhocAllergenRow = window.document.querySelector("#adhoc-allergen-ingredient-rows .ing-row");
  assert(!!adhocAllergenRow, "measurement differences section starts with one blank ingredient row");
  adhocAllergenRow.querySelector(".ing-name").value = "milk";
  const adhocDairyChk = Array.from(window.document.querySelectorAll(".adhoc-allergen-allergen-chk")).find((c) => c.value === "dairy");
  adhocDairyChk.checked = true;
  window.document.getElementById("adhoc-allergen-check-allergens-btn").click();
  const adhocResults = window.document.getElementById("adhoc-allergen-allergen-results").textContent;
  assert(/milk/i.test(adhocResults) && /dairy/i.test(adhocResults), "ad-hoc allergen card flags a manually-entered ingredient, got: " + adhocResults);

  // ---- Temperature Converter ----
  // The Temperature Converter tab is now a folder grid (same pattern as
  // Recipes and Scale Converter): Oven Type, Quick Reference, Convert Any
  // Temperature, Altitude Adjustment, and Safe Meat Temperatures are
  // separate pages.
  go("#/temp");
  const tempFolderBoxes = window.document.querySelectorAll("#view .home-box");
  assert(tempFolderBoxes.length === 5, "temperature converter shows 5 folders, got " + tempFolderBoxes.length);
  const tempHomeText = window.document.getElementById("view").textContent;
  assert(/Oven Type/.test(tempHomeText), "temp folder grid includes Oven Type");
  assert(/Quick Reference/.test(tempHomeText), "temp folder grid includes Quick Reference");
  assert(/Convert Any Temperature/.test(tempHomeText), "temp folder grid includes Convert Any Temperature");
  assert(/Altitude Adjustment/.test(tempHomeText), "temp folder grid includes Altitude Adjustment");
  assert(/Safe Meat Temperatures/.test(tempHomeText), "temp folder grid includes Safe Meat Temperatures");

  // Oven type — the "check a temperature for your oven" note now lives
  // here (moved off the Convert Any Temperature page along with the rest
  // of the oven-type feature).
  go("#/temp/oven");
  const ovenBackBtn = window.document.getElementById("back-btn");
  assert(ovenBackBtn.getAttribute("data-back-route") === "#/temp", "Oven Type page's back button returns to the Temperature Converter folder grid");

  const ovenSelect = window.document.getElementById("oven-type-select");
  assert(ovenSelect.value === "electric", "oven type defaults to electric");
  assert(/no adjustment is usually needed/i.test(window.document.getElementById("oven-type-info").textContent), "electric oven info shows the no-adjustment-needed summary");

  const ovenCheckF = window.document.getElementById("oven-check-f");
  ovenCheckF.value = "350";
  ovenCheckF.dispatchEvent(new window.Event("input"));
  assert(window.document.getElementById("oven-check-result").textContent === "", "no oven-adjustment note shown for the default electric oven");

  ovenSelect.value = "gas";
  ovenSelect.dispatchEvent(new window.Event("change"));
  assert(/hot spots/i.test(window.document.getElementById("oven-type-info").textContent), "gas oven info mentions hot spots");
  assert(window.document.getElementById("oven-check-result").textContent === "", "no numeric oven-adjustment note shown for gas (no agreed-on offset)");

  ovenSelect.value = "convection";
  ovenSelect.dispatchEvent(new window.Event("change"));
  assert(/25.F/.test(window.document.getElementById("oven-type-info").textContent), "convection oven info mentions the 25°F rule of thumb");
  assert(/325.F/.test(window.document.getElementById("oven-check-result").textContent), "convection adjustment note suggests 325°F for a 350°F recipe, got: " + window.document.getElementById("oven-check-result").textContent);

  // Quick reference
  go("#/temp/quick-ref");
  const quickRefBackBtn = window.document.getElementById("back-btn");
  assert(quickRefBackBtn.getAttribute("data-back-route") === "#/temp", "Quick Reference page's back button returns to the Temperature Converter folder grid");
  assert(window.document.querySelectorAll(".temp-ref-table tr").length === 12, "temp quick-reference table has header + 11 rows");

  // Convert any temperature
  go("#/temp/convert");
  const convertTempBackBtn = window.document.getElementById("back-btn");
  assert(convertTempBackBtn.getAttribute("data-back-route") === "#/temp", "Convert Any Temperature page's back button returns to the Temperature Converter folder grid");
  const tempF = window.document.getElementById("temp-f");
  tempF.value = "350";
  tempF.dispatchEvent(new window.Event("input"));
  assert(window.document.getElementById("temp-c").value === "176.67", "350F converts to 176.67C, got " + window.document.getElementById("temp-c").value);

  // Altitude adjustment
  go("#/temp/altitude");
  const altitudeBackBtn = window.document.getElementById("back-btn");
  assert(altitudeBackBtn.getAttribute("data-back-route") === "#/temp", "Altitude Adjustment page's back button returns to the Temperature Converter folder grid");
  const elevInput = window.document.getElementById("elevation-ft");
  elevInput.value = "6000";
  elevInput.dispatchEvent(new window.Event("input"));
  assert(/oven temperature/.test(window.document.getElementById("altitude-result").textContent), "altitude adjustment shows guidance at 6000ft");

  // Safe meat temperatures (static USDA reference)
  go("#/temp/safe-meat");
  const safeMeatBackBtn = window.document.getElementById("back-btn");
  assert(safeMeatBackBtn.getAttribute("data-back-route") === "#/temp", "Safe Meat Temperatures page's back button returns to the Temperature Converter folder grid");
  const safeMeatText = window.document.getElementById("view").textContent;
  assert(/food thermometer/i.test(safeMeatText), "safe meat temperatures page tells you to use a food thermometer");
  assert(/Ground meat/.test(safeMeatText) && /160.F/.test(safeMeatText), "safe meat temperatures include ground meat at 160°F");
  assert(/All poultry/.test(safeMeatText) && /165.F/.test(safeMeatText), "safe meat temperatures include poultry at 165°F");
  assert(/Fish & shellfish/.test(safeMeatText) && /145.F/.test(safeMeatText), "safe meat temperatures include fish & shellfish at 145°F");
  assert(window.document.querySelectorAll("#view .card").length === 8, "safe meat temperatures page shows all 8 entries as cards");

  // ---- Recipe Creator ----
  go("#/create");
  assert(!!window.document.getElementById("recipe-request"), "recipe creator shows a request field");
  assert(window.document.getElementById("generated-recipe-card").style.display === "none", "generated recipe card starts hidden until a recipe is created");

  window.document.getElementById("recipe-request").value = "quick vegetarian pasta dinner for 6";
  window.document.getElementById("generate-recipe-btn").click();
  assert(window.document.getElementById("generated-recipe-card").style.display === "block", "generated recipe card shows after clicking Create Recipe");
  assert(/Pasta Primavera/i.test(window.document.getElementById("generated-recipe-title").textContent), "matches a vegetarian pasta recipe for that request, got: " + window.document.getElementById("generated-recipe-title").textContent);
  assert(/6 servings/.test(window.document.getElementById("generated-recipe-meta").textContent), "scales to the 6 servings requested, got: " + window.document.getElementById("generated-recipe-meta").textContent);

  const groceryRows = window.document.querySelectorAll("#grocery-list .grocery-row");
  assert(groceryRows.length > 0, "grocery list shows a row per ingredient");
  const firstGroceryChk = groceryRows[0].querySelector(".grocery-chk");
  firstGroceryChk.checked = true;
  firstGroceryChk.dispatchEvent(new window.Event("change"));
  assert(groceryRows[0].classList.contains("have"), "checking a grocery item marks it as already-have");

  const stepItems = window.document.querySelectorAll("#generated-recipe-steps li");
  assert(stepItems.length > 0, "generated recipe shows its cooking steps");

  const recipesBefore = JSON.parse(window.localStorage.getItem("mg_recipes_v1") || "[]");
  window.document.getElementById("save-generated-recipe-btn").click();
  await flush();
  const recipesAfter = JSON.parse(window.localStorage.getItem("mg_recipes_v1") || "[]");
  assert(recipesAfter.length === recipesBefore.length + 1, "saving the generated recipe adds it to My Recipes");
  assert(/Pasta Primavera/i.test(recipesAfter[recipesAfter.length - 1].title), "the saved recipe is the generated one");

  window.document.getElementById("try-another-btn").click();
  assert(window.document.getElementById("generated-recipe-card").style.display === "none", "'Try another idea' hides the result card again");
  assert(window.document.getElementById("recipe-request").value === "", "'Try another idea' clears the request field");

  // A dietary need that can't be fully honored (or a request with no good
  // match at all) should say so plainly rather than pretending it fits.
  window.document.getElementById("recipe-request").value = "asdkjqwoe unrecognizable nonsense zzz";
  window.document.getElementById("generate-recipe-btn").click();
  assert(/didn.t find a close match/i.test(window.document.getElementById("generated-recipe-notes").textContent), "an unmatched request is flagged honestly instead of implying a perfect fit");

  // ---- Profile (signed out) ----
  go("#/profile");
  assert(!!window.document.getElementById("tab-signin"), "profile page (signed out) shows Sign In tab");
  assert(!!window.document.getElementById("signin-email"), "profile page (signed out) defaults to the sign-in form");
  window.document.getElementById("tab-signup").click();
  assert(!!window.document.getElementById("signup-username"), "switching to Create Account tab shows a username field");
  window.document.getElementById("tab-signin").click(); // leave it back on Sign In for a clean default next run

  assert(!!window.document.getElementById("forgot-password-btn"), "sign-in form shows a Forgot password? link");
  window.document.getElementById("forgot-password-btn").click(); // no email entered yet
  assert(/enter your email/i.test(window.document.getElementById("reset-status").textContent), "forgot password without an email asks for one first");
  window.document.getElementById("signin-email").value = "test@example.com";
  window.document.getElementById("forgot-password-btn").click(); // window.MG isn't loaded yet in this test
  assert(/still connecting/i.test(window.document.getElementById("reset-status").textContent), "forgot password before window.MG loads shows a friendly retry message, not a crash");

  // Sign In and Create Account should show the same friendly message when
  // clicked before window.MG has finished loading, instead of throwing
  // "Cannot read properties of undefined" straight out of the click handler.
  window.document.getElementById("signin-password").value = "testpassword123";
  window.document.getElementById("signin-btn").click(); // window.MG isn't loaded yet in this test
  assert(/still connecting/i.test(window.document.getElementById("view").textContent), "sign in before window.MG loads shows a friendly retry message, not a crash");

  window.document.getElementById("tab-signup").click();
  window.document.getElementById("signup-username").value = "testuser";
  window.document.getElementById("signup-email").value = "test2@example.com";
  window.document.getElementById("signup-password").value = "testpassword123";
  window.document.getElementById("signup-btn").click(); // window.MG isn't loaded yet in this test
  assert(/still connecting/i.test(window.document.getElementById("view").textContent), "create account before window.MG loads shows a friendly retry message, not a crash");
  window.document.getElementById("tab-signin").click(); // leave it back on Sign In for a clean default next run

  // ---- Edit + delete recipe ----
  go("#/recipe/edit/" + recipeId);
  assert(window.document.getElementById("recipe-title").value === "Test Banana Bread", "edit form prefills existing title");
  assert(window.document.querySelectorAll(".ing-row").length === 2, "edit form prefills existing ingredient rows");
  const prefilledDessertPill = Array.from(window.document.querySelectorAll(".category-pill")).find((p) => p.getAttribute("data-category") === "dessert");
  assert(prefilledDessertPill.classList.contains("selected"), "edit form prefills the recipe's existing category (Desserts)");

  // ---- Recipe photos: upload UI renders, but only "Add Photo" (no
  // Remove button) since this recipe has no photo yet ----
  assert(!!window.document.getElementById("recipe-photo-input"), "edit form renders a hidden photo file input");
  assert(window.document.getElementById("recipe-photo-btn").textContent === "Add Photo", "photo button reads 'Add Photo' when the recipe has none yet");
  assert(!window.document.getElementById("recipe-photo-remove-btn"), "no Remove Photo button when the recipe has no photo");
  assert(window.document.getElementById("recipe-photo-preview").style.display === "none", "photo preview stays hidden with no photo");

  // ---- Print: fills the (normally hidden) #print-area and calls window.print() ----
  let printCalled = false;
  const realPrint = window.print;
  window.print = () => { printCalled = true; };
  window.document.getElementById("print-recipe-btn").click();
  assert(printCalled, "clicking Print calls window.print()");
  const printArea = window.document.getElementById("print-area");
  assert(!!printArea, "Print creates a #print-area element");
  assert(/Test Banana Bread/.test(printArea.textContent), "#print-area is filled with the recipe's title");
  assert(/all-purpose flour/.test(printArea.textContent), "#print-area is filled with the recipe's ingredients");
  window.print = realPrint;

  // ---- Share: prefers navigator.share(), falls back to the clipboard ----
  let sharedWith = null;
  window.navigator.share = (data) => { sharedWith = data; return Promise.resolve(); };
  window.document.getElementById("share-recipe-btn").click();
  await flush();
  assert(!!sharedWith && /Test Banana Bread/.test(sharedWith.text), "Share uses navigator.share() with the recipe's text when it's available");
  delete window.navigator.share;

  let clipboardText = null;
  window.navigator.clipboard = { writeText: (t) => { clipboardText = t; return Promise.resolve(); } };
  const realAlert = window.alert;
  let alertMsg = "";
  window.alert = (m) => { alertMsg = m; };
  window.document.getElementById("share-recipe-btn").click();
  await flush();
  assert(!!clipboardText && /Test Banana Bread/.test(clipboardText), "Share falls back to copying the recipe text to the clipboard when navigator.share() isn't available");
  assert(/clipboard/i.test(alertMsg), "Share fallback tells the person it copied the recipe to their clipboard");
  window.alert = realAlert;

  // ---- New-recipe form has no Print/Share/Delete (nothing saved yet to act on) ----
  go("#/recipe/new");
  assert(!window.document.getElementById("print-recipe-btn"), "New Recipe form has no Print button");
  assert(!window.document.getElementById("share-recipe-btn"), "New Recipe form has no Share button");
  go("#/recipe/edit/" + recipeId); // back to the recipe under test before deleting it below

  window.document.getElementById("delete-recipe-btn").click(); // triggers confirm() -> jsdom default confirm returns false
  await flush();
  // jsdom's window.confirm returns false by default, so the recipe should NOT be deleted yet.
  // (Compared by id, not total count, since other tests — e.g. Recipe Creator — may have saved additional recipes by this point.)
  let stillThere = JSON.parse(window.localStorage.getItem("mg_recipes_v1"));
  assert(stillThere.some((r) => r.id === recipeId), "delete without confirmation leaves recipe intact (jsdom confirm() defaults false)");

  // Force-confirm delete by monkey-patching confirm to true and re-invoking the handler logic directly.
  window.confirm = () => true;
  window.document.getElementById("delete-recipe-btn").click();
  await flush();
  stillThere = JSON.parse(window.localStorage.getItem("mg_recipes_v1"));
  assert(!stillThere.some((r) => r.id === recipeId), "delete with confirmation removes the recipe");

  // ---- Meal Planning (local, signed out) ----
  go("#/meal-plan");
  assert(/No meal planned yet/.test(window.document.getElementById("view").textContent), "week view shows a placeholder for days with nothing planned");
  assert(/Sign in.*sync/i.test(window.document.getElementById("view").textContent), "meal plan shows local-only sync hint when signed out");
  assert(window.document.querySelectorAll("[data-open-mealplan-day]").length === 7, "week view shows all 7 days");
  assert(/Today/.test(window.document.getElementById("view").textContent), "week view labels today's box");

  // Save a fresh recipe to plan a meal with (independent of whatever earlier
  // tests left in localStorage).
  go("#/recipe/new");
  window.document.getElementById("recipe-title").value = "Test Meal Plan Soup";
  window.document.getElementById("orig-servings").value = "4";
  const mpRows = window.document.querySelectorAll(".ing-row");
  mpRows[0].querySelector(".ing-qty").value = "2";
  mpRows[0].querySelector(".ing-unit").value = "cup";
  mpRows[0].querySelector(".ing-name").value = "chicken broth";
  window.document.getElementById("save-recipe-btn").click();
  await flush();
  const mpRecipes = JSON.parse(window.localStorage.getItem("mg_recipes_v1"));
  const soupRecipe = mpRecipes.find((r) => r.title === "Test Meal Plan Soup");
  assert(!!soupRecipe, "meal-plan test recipe saved");

  // Plan it for today via the day picker.
  const todayISO = window.isoDate(new Date());
  go("#/meal-plan/day/" + todayISO);
  const soupCard = Array.from(window.document.querySelectorAll("[data-pick-mealplan]")).find((n) => n.getAttribute("data-pick-mealplan") === soupRecipe.id);
  assert(!!soupCard, "day picker lists the saved test recipe");
  soupCard.click();
  await flush();
  const wsISO = window.isoDate(window.startOfWeek(new Date()));
  assert(window.location.hash === "#/meal-plan/week/" + wsISO, "picking a recipe redirects back to that day's week view");

  const mpMap = JSON.parse(window.localStorage.getItem("mg_meal_plan_v1"));
  assert(mpMap[todayISO] === soupRecipe.id, "meal plan persisted to localStorage");

  go("#/meal-plan");
  assert(new RegExp(soupRecipe.title).test(window.document.getElementById("view").textContent), "week view shows the planned recipe's title");

  // ---- Grocery List (built from the planned recipe) ----
  go("#/meal-plan/grocery/" + wsISO);
  assert(/chicken broth/.test(window.document.getElementById("view").textContent), "grocery list includes the planned recipe's ingredient");
  assert(/2 cup/.test(window.document.getElementById("view").textContent), "grocery list shows the ingredient's quantity and unit");

  const groceryCb = window.document.querySelector("[data-grocery-key]");
  assert(!!groceryCb, "grocery list renders a checkbox for the ingredient");
  groceryCb.checked = true;
  groceryCb.dispatchEvent(new window.Event("change"));
  let groceryState = JSON.parse(window.localStorage.getItem("mg_grocery_v1"));
  assert(groceryState[wsISO].checked[window.ingredientKey("chicken broth", "cup")] === true, "checking a grocery item persists to localStorage");
  assert(groceryCb.closest(".grocery-row").classList.contains("have"), "checked grocery item gets the strikethrough 'have' class");

  // Add a manual extra item.
  window.document.getElementById("grocery-extra-input").value = "paper towels";
  window.document.getElementById("grocery-add-btn").click();
  await flush();
  groceryState = JSON.parse(window.localStorage.getItem("mg_grocery_v1"));
  assert(groceryState[wsISO].extra.some((x) => x.text === "paper towels"), "adding an extra item persists to localStorage");
  assert(/paper towels/.test(window.document.getElementById("view").textContent), "grocery list shows the newly added extra item");

  const removeBtn = window.document.querySelector("[data-remove-extra]");
  assert(!!removeBtn, "extra item shows a remove button");
  removeBtn.click();
  await flush();
  groceryState = JSON.parse(window.localStorage.getItem("mg_grocery_v1"));
  assert(!groceryState[wsISO].extra.some((x) => x.text === "paper towels"), "removing an extra item removes it from localStorage");

  // ---- Clear the day ----
  go("#/meal-plan/day/" + todayISO);
  assert(!!window.document.getElementById("meal-plan-clear-btn"), "day picker shows a Clear button once a recipe is planned");
  window.document.getElementById("meal-plan-clear-btn").click();
  await flush();
  const mpMapAfterClear = JSON.parse(window.localStorage.getItem("mg_meal_plan_v1"));
  assert(!mpMapAfterClear[todayISO], "clearing a day removes it from the meal plan");

  // ---- Week navigation ----
  // Each check starts from a fresh go() render, rather than chaining clicks,
  // since a button's own location.hash= assignment isn't guaranteed to
  // trigger a hashchange-driven re-render inside jsdom the way go() does.
  go("#/meal-plan/week/" + wsISO);
  window.document.getElementById("meal-plan-next-week").click();
  assert(window.location.hash === "#/meal-plan/week/" + window.isoDate(window.addDays(window.startOfWeek(new Date()), 7)), "Next week button navigates forward 7 days");

  go("#/meal-plan/week/" + wsISO);
  window.document.getElementById("meal-plan-prev-week").click();
  assert(window.location.hash === "#/meal-plan/week/" + window.isoDate(window.addDays(window.startOfWeek(new Date()), -7)), "Previous week button navigates back 7 days");

  // ---- Settings: dark mode toggle ----
  go("#/settings");
  const themeBtn = window.document.getElementById("theme-switch-btn");
  assert(!!themeBtn, "Settings page renders a dark-mode toggle");
  assert(window.document.documentElement.getAttribute("data-theme") === "light", "theme starts light by default");
  assert(!themeBtn.classList.contains("on"), "theme switch starts off (light)");
  themeBtn.click();
  assert(window.document.documentElement.getAttribute("data-theme") === "dark", "clicking the theme switch turns dark mode on");
  assert(themeBtn.classList.contains("on"), "theme switch shows on once dark mode is active");
  assert(window.localStorage.getItem("mg_theme_v1") === "dark", "dark mode choice is persisted to localStorage");
  go("#/settings"); // re-render: the toggle should reflect the persisted choice
  assert(window.document.getElementById("theme-switch-btn").classList.contains("on"), "revisiting Settings shows dark mode still on");
  window.document.getElementById("theme-switch-btn").click(); // back to light, so later tests render in the default theme
  assert(window.document.documentElement.getAttribute("data-theme") === "light", "clicking again switches back to light mode");
  assert(/roadmap/i.test(window.document.getElementById("view").textContent), "Settings page is honest that a metric unit toggle isn't built yet");

  // ---- Friends & Family: signed out ----
  go("#/friends");
  assert(/Sign in/i.test(window.document.getElementById("view").textContent), "Friends & Family prompts sign-in when signed out");
  assert(!window.document.getElementById("friend-lookup-btn"), "no lookup form renders for Friends & Family when signed out");

  // ---- Substitution Tips (folders, static content, no sign-in needed) ----
  go("#/substitutions");
  const subBoxes = window.document.querySelectorAll("#view .home-box");
  assert(subBoxes.length === 4, "substitutions home shows the 4 folders, got " + subBoxes.length);
  ["Baking & Leavening", "Dairy & Eggs", "Produce & Aromatics", "Pantry & Sauces"].forEach((label) => {
    assert(new RegExp(label.replace("&", "&amp;")).test(window.document.getElementById("view").innerHTML) || window.document.getElementById("view").textContent.includes(label), "substitutions home includes a " + label + " folder");
  });

  go("#/substitutions/baking");
  assert(window.document.getElementById("back-btn").getAttribute("data-back-route") === "#/substitutions", "substitution category back button returns to #/substitutions");
  assert(/Buttermilk/.test(window.document.getElementById("view").textContent), "Baking & Leavening substitutions include Buttermilk");
  assert(/Baking powder/.test(window.document.getElementById("view").textContent), "Baking & Leavening substitutions include Baking powder");

  go("#/substitutions/dairy-eggs");
  assert(/for binding/.test(window.document.getElementById("view").textContent), "Dairy & Eggs substitutions include an egg-binding swap");

  go("#/substitutions/produce");
  assert(/Fresh garlic/.test(window.document.getElementById("view").textContent), "Produce & Aromatics substitutions include Fresh garlic");

  go("#/substitutions/pantry");
  assert(/Soy sauce/.test(window.document.getElementById("view").textContent), "Pantry & Sauces substitutions include Soy sauce");

  // ---- Community Recipes (signed out / window.MG unavailable) ----
  go("#/community");
  await flush();
  assert(/aren't available/i.test(window.document.getElementById("community-status").textContent), "community list shows an unavailable message when window.MG isn't loaded yet, got: " + window.document.getElementById("community-status").textContent);

  // ---- Forgot password (window.MG loaded, but signed out) ----
  // Set the hash and re-render directly, then flush once before touching
  // anything: jsdom sometimes redelivers a "hashchange" it already fired
  // synchronously a moment later (an extra async re-render), which would
  // otherwise blow away the status text this test checks right after.
  window.location.hash = "#/profile";
  window.MG = { getCurrentUser: () => null, resetPassword: async () => {} };
  window.render();
  await flush();
  window.document.getElementById("signin-email").value = "test@example.com";
  window.document.getElementById("forgot-password-btn").click();
  await flush();
  assert(/check your email/i.test(window.document.getElementById("reset-status").textContent), "forgot password sends a reset email once window.MG is loaded");
  window.MG = undefined;

  // ---- Profile (signed in, non-admin) — mocked window.MG, since real
  // Firebase can't run inside jsdom (no network, no module-script CDN
  // imports) ----
  const mockUser = { uid: "u1", email: "test@example.com", username: "testchef", contactInfo: "", avatar: "", isAdmin: false, emailVerified: false };
  let verifyResendCount = 0;
  let deleteAccountLog = [];
  window.MG = {
    getCurrentUser: () => mockUser,
    getCloudRecipes: () => [],
    saveContactInfo: async (info) => { mockUser.contactInfo = info; },
    saveAvatar: async (dataUrl) => { mockUser.avatar = dataUrl; },
    changeUsername: async (u) => { mockUser.username = u; window.dispatchEvent(new window.Event("mg-auth-changed")); return u; },
    signOutUser: async () => { /* not invoked in this test */ },
    migrateLocalToCloud: async () => {},
    resendVerificationEmail: async () => { verifyResendCount++; },
    refreshEmailVerified: async () => { /* stays unverified until the test below flips it */ },
    deleteAccount: async (password) => {
      if (password !== "correcthorse") throw new Error("That email/password combination isn't right.");
      deleteAccountLog.push("deleted:" + mockUser.uid);
    },
  };
  go("#/profile");
  assert(window.document.getElementById("username-input").value === "testchef", "profile page shows the signed-in username once window.MG reports a user");
  assert(!!window.document.getElementById("sign-out-btn"), "profile page shows a Sign Out button when signed in");
  assert(!window.document.getElementById("tab-signin"), "profile page hides the sign-in form once signed in");
  assert(!!window.document.getElementById("avatar-btn"), "profile page shows a Change Photo button for any signed-in user");
  assert(!window.document.getElementById("grant-lookup-btn"), "profile page hides the friends & family admin panel for a non-admin user");

  // ---- Email verification banner ----
  assert(!!window.document.getElementById("resend-verify-btn"), "profile shows a verification banner for an unverified account");
  window.document.getElementById("resend-verify-btn").click();
  await flush();
  assert(verifyResendCount === 1, "Resend Verification Email calls window.MG.resendVerificationEmail");
  assert(/Sent/i.test(window.document.getElementById("verify-status").textContent), "resend button shows a confirmation once sent");
  window.document.getElementById("recheck-verify-btn").click();
  await flush();
  assert(/Not verified yet/i.test(window.document.getElementById("verify-status").textContent), "re-checking before the link is clicked reports still-unverified");
  mockUser.emailVerified = true;
  // No need to dispatch "mg-auth-changed" here to prove the point -- the
  // banner condition is read straight off getCurrentUser() at render time,
  // so it's already gone on the very next synchronous render now that
  // mockUser.emailVerified is true.
  go("#/profile");
  assert(!window.document.getElementById("resend-verify-btn"), "verification banner disappears once the account is verified");

  window.document.getElementById("username-input").value = "new_handle";
  window.document.getElementById("save-username-btn").click();
  await flush();
  assert(mockUser.username === "new_handle", "saving a new username calls window.MG.changeUsername");
  assert(window.document.getElementById("username-input").value === "new_handle", "profile page shows the updated username after saving");

  // ---- Delete account ----
  window.document.getElementById("delete-account-btn").click();
  assert(!!window.document.getElementById("confirm-delete-account-btn"), "Delete My Account opens a password-confirmation box");
  window.document.getElementById("confirm-delete-account-btn").click();
  await flush();
  assert(/enter your password/i.test(window.document.getElementById("delete-account-status").textContent), "confirming with no password shows a message instead of calling window.MG.deleteAccount");
  assert(deleteAccountLog.length === 0, "no password means window.MG.deleteAccount is not called yet");

  window.document.getElementById("delete-account-password").value = "wrongpassword";
  const realConfirm = window.confirm;
  window.confirm = () => true;
  window.document.getElementById("confirm-delete-account-btn").click();
  await flush();
  assert(/Couldn't delete/i.test(window.document.getElementById("delete-account-status").textContent), "a wrong password surfaces window.MG.deleteAccount's error");
  assert(deleteAccountLog.length === 0, "a wrong password does not delete the account");

  window.document.getElementById("delete-account-password").value = "correcthorse";
  window.document.getElementById("confirm-delete-account-btn").click();
  await flush();
  assert(deleteAccountLog.includes("deleted:u1"), "the correct password calls window.MG.deleteAccount");
  window.confirm = realConfirm;

  // ---- Community Recipes: sharing from the recipe form, browsing, saving a
  // copy, and reporting — all via a mocked window.MG, since real Firebase
  // can't run inside jsdom ----
  let mockCloudRecipes = [];
  let mockCloudMealPlan = {};
  let communityPool = [
    { id: "friend1_abc", title: "Golabki", servings: 6, ingredients: [{ qty: 1, unit: "lb", name: "ground beef" }], steps: "Roll and bake.", category: "main", authorUid: "friend1", authorUsername: "babcia_anna", sourceRecipeId: "abc" },
    { id: "friend2_xyz", title: "Fruit Salad", servings: 4, ingredients: [{ qty: 2, unit: "cup", name: "mixed fruit" }], steps: "Mix.", category: "", authorUid: "friend2", authorUsername: "ciocia_ewa", sourceRecipeId: "xyz" },
  ];
  // Seeded with one comment from someone other than testchef (the signed-in
  // user below) or Golabki's author, so the delete-button visibility rules
  // (comment author / recipe author / admin) have something real to check.
  let mockComments = {
    friend1_abc: [{ id: "c_seed", text: "Made this last week, delicious!", authorUid: "friend3", authorUsername: "other_cook" }],
  };
  let mockCommentCounter = 0;
  const shareLog = [];
  const reportLog = [];
  const friendShareLog = [];
  let sharedInboxMock = [
    { id: "share1", recipe: { title: "Kielbasa Stew", servings: 6, ingredients: [{ qty: 2, unit: "lb", name: "kielbasa" }], steps: "Simmer.", category: "main" }, fromUid: "friend2", fromUsername: "ciocia_ewa" },
  ];
  window.MG = {
    ready: Promise.resolve(),
    getCurrentUser: () => mockUser,
    isAdmin: () => !!mockUser.isAdmin,
    getCloudRecipes: () => mockCloudRecipes,
    upsertRecipe: async (r) => {
      const idx = mockCloudRecipes.findIndex((x) => x.id === r.id);
      if (idx >= 0) mockCloudRecipes[idx] = r; else mockCloudRecipes.push(r);
    },
    deleteRecipeCloud: async (id) => { mockCloudRecipes = mockCloudRecipes.filter((r) => r.id !== id); },
    shareToCommunity: async (r) => {
      shareLog.push("share:" + r.id);
      communityPool = communityPool.filter((c) => c.sourceRecipeId !== r.id);
      communityPool.push({ id: "testchef_" + r.id, title: r.title, servings: r.servings, ingredients: r.ingredients, steps: r.steps, category: r.category, authorUid: mockUser.uid, authorUsername: mockUser.username, sourceRecipeId: r.id });
    },
    unshareFromCommunity: async (id) => {
      shareLog.push("unshare:" + id);
      communityPool = communityPool.filter((c) => c.sourceRecipeId !== id);
    },
    fetchCommunityRecipes: async () => communityPool.slice(),
    reportCommunityRecipe: async (id, reason) => { reportLog.push({ id, reason }); },
    migrateLocalToCloud: async () => {},
    getCloudMealPlan: () => mockCloudMealPlan,
    upsertMealPlanEntry: async (date, recipeId) => { mockCloudMealPlan[date] = recipeId; },
    deleteMealPlanEntryCloud: async (date) => { delete mockCloudMealPlan[date]; },
    fetchComments: async (id) => (mockComments[id] || []).slice(),
    postComment: async (id, text) => {
      if (!mockComments[id]) mockComments[id] = [];
      mockComments[id].push({ id: "c_" + (mockCommentCounter++), text, authorUid: mockUser.uid, authorUsername: mockUser.username });
    },
    deleteComment: async (id, commentId) => {
      mockComments[id] = (mockComments[id] || []).filter((c) => c.id !== commentId);
    },
    lookupPublicProfile: async (username) => {
      const key = username.trim().toLowerCase();
      if (key === "babcia_anna") return { uid: "friend1", username: "babcia_anna", avatar: "" };
      throw new Error("No account found with that username.");
    },
    shareRecipeToFriend: async (friendUid, recipe) => {
      friendShareLog.push({ friendUid, recipe });
    },
    listSharedWithMe: async () => sharedInboxMock.slice(),
    dismissSharedItem: async (shareId) => {
      sharedInboxMock = sharedInboxMock.filter((i) => i.id !== shareId);
    },
  };

  // New recipe form shows the Share checkbox once signed in.
  go("#/recipe/new");
  assert(!!window.document.getElementById("share-community-checkbox"), "recipe form shows a Share to Community checkbox when signed in");
  assert(!window.document.getElementById("share-community-checkbox").checked, "share checkbox starts unchecked for a new recipe");

  window.document.getElementById("recipe-title").value = "Test Pierogi";
  window.document.getElementById("share-community-checkbox").checked = true;
  window.document.getElementById("save-recipe-btn").click();
  await flush();
  const savedShared = mockCloudRecipes.find((r) => r.title === "Test Pierogi");
  assert(!!savedShared, "saving a signed-in recipe calls window.MG.upsertRecipe");
  assert(savedShared.shared === true, "the saved recipe is marked shared when the checkbox was checked");
  assert(shareLog.includes("share:" + savedShared.id), "checking Share and saving calls window.MG.shareToCommunity");

  // Editing that recipe and unchecking Share calls unshareFromCommunity.
  go("#/recipe/edit/" + savedShared.id);
  assert(window.document.getElementById("share-community-checkbox").checked, "edit form shows the checkbox checked for an already-shared recipe");
  window.document.getElementById("share-community-checkbox").checked = false;
  window.document.getElementById("save-recipe-btn").click();
  await flush();
  assert(shareLog.includes("unshare:" + savedShared.id), "unchecking Share and saving calls window.MG.unshareFromCommunity");

  // ---- Community Recipes: folders, searching, viewing, saving a copy, reporting ----

  // Folders should still show (at a 0 count each) when nothing's been
  // shared yet, rather than disappearing entirely -- same convention as
  // the Recipes tab's own folder grid.
  const savedCommunityPool = communityPool;
  communityPool = [];
  go("#/community");
  await flush();
  assert(window.document.querySelectorAll("#community-folders .home-box").length === 4, "community recipes still shows the 4 folders when nothing's been shared yet, got " + window.document.querySelectorAll("#community-folders .home-box").length);
  assert(/No one has shared a recipe yet/.test(window.document.getElementById("community-folders").textContent), "empty community pool shows the friendly note above the folders");
  communityPool = savedCommunityPool;

  go("#/community");
  await flush();
  const communityFolderBoxes = window.document.querySelectorAll("#community-folders .home-box");
  assert(communityFolderBoxes.length === 5, "community recipes shows the 4 category folders plus Uncategorized, got " + communityFolderBoxes.length);
  const communityFoldersText = window.document.getElementById("community-folders").textContent;
  assert(/Main Courses/.test(communityFoldersText) && /1 recipe/.test(communityFoldersText), "Main Courses folder shows a count of 1");
  assert(/Uncategorized/.test(communityFoldersText), "community recipes shows an Uncategorized folder for the recipe with no category");

  go("#/community/category/main");
  const communityCategoryBackBtn = window.document.getElementById("back-btn");
  assert(communityCategoryBackBtn.getAttribute("data-back-route") === "#/community", "community category page's back button returns to Community Recipes");
  await flush();
  assert(/babcia_anna/.test(window.document.getElementById("community-category-list").textContent), "Main Courses folder shows Golabki's author, got: " + window.document.getElementById("community-category-list").textContent);
  assert(!/Fruit Salad/.test(window.document.getElementById("community-category-list").textContent), "Main Courses folder doesn't show the uncategorized Fruit Salad");

  go("#/community");
  await flush();
  window.document.getElementById("community-search").value = "nothing-matches-this";
  window.document.getElementById("community-search").dispatchEvent(new window.Event("input"));
  assert(window.document.getElementById("community-folders").style.display === "none", "searching hides the folder grid");
  assert(/No community recipes match/.test(window.document.getElementById("community-search-results").textContent), "searching with no matches shows a no-results message");

  window.document.getElementById("community-search").value = "golabki";
  window.document.getElementById("community-search").dispatchEvent(new window.Event("input"));
  assert(/babcia_anna/.test(window.document.getElementById("community-search-results").textContent), "searching for golabki finds it across categories");

  window.document.getElementById("community-search").value = "";
  window.document.getElementById("community-search").dispatchEvent(new window.Event("input"));
  assert(window.document.getElementById("community-folders").style.display !== "none", "clearing the search brings the folder grid back");

  go("#/community/category/main");
  await flush();
  const communityId = window.document.querySelector("[data-open-community]").getAttribute("data-open-community");
  go("#/community/" + communityId);
  await flush();
  assert(/babcia_anna/.test(window.document.getElementById("community-detail-body").textContent), "community detail page shows the recipe's author");
  assert(/Golabki/.test(window.document.getElementById("community-detail-body").textContent), "community detail page shows the recipe title");

  window.document.getElementById("save-copy-btn").click();
  await flush();
  assert(mockCloudRecipes.some((r) => r.title === "Golabki" && r.shared === false), "Save a Copy adds the community recipe to My Recipes, unshared by default");

  window.document.getElementById("report-recipe-btn").click();
  assert(!!window.document.getElementById("submit-report-btn"), "clicking Report reveals a reason field and submit button");
  window.document.getElementById("report-reason").value = "wrong ingredients";
  window.document.getElementById("submit-report-btn").click();
  await flush();
  assert(reportLog.some((r) => r.id === communityId && r.reason === "wrong ingredients"), "submitting a report calls window.MG.reportCommunityRecipe with the reason");
  assert(/reported/i.test(window.document.getElementById("report-box").textContent), "report box shows a thank-you confirmation after submitting");

  // ---- Comments on a community recipe ----
  go("#/community/" + communityId);
  await flush();
  assert(!!window.document.getElementById("comment-input"), "signed-in users get a comment input on a community recipe");
  assert(/other_cook/.test(window.document.getElementById("comments-list").textContent), "existing comments show their author");
  assert(/delicious/.test(window.document.getElementById("comments-list").textContent), "existing comments show their text");
  const otherCommentRow = window.document.querySelector('[data-comment-id="c_seed"]');
  assert(!!otherCommentRow && !otherCommentRow.querySelector("[data-delete-comment]"), "a comment from someone else (not you or the recipe's author) has no delete button");

  window.document.getElementById("comment-input").value = "This turned out great, thanks for sharing!";
  window.document.getElementById("post-comment-btn").click();
  await flush();
  assert(mockComments[communityId].some((c) => c.text === "This turned out great, thanks for sharing!" && c.authorUid === mockUser.uid), "posting a comment calls window.MG.postComment as the signed-in user");
  // mockUser.username was changed to "new_handle" by the earlier Profile test.
  assert(new RegExp(mockUser.username).test(window.document.getElementById("comments-list").textContent), "the newly posted comment appears in the list right away");

  const ownCommentId = mockComments[communityId].find((c) => c.authorUid === mockUser.uid).id;
  const ownCommentRow = window.document.querySelector(`[data-comment-id="${ownCommentId}"]`);
  assert(!!ownCommentRow && !!ownCommentRow.querySelector("[data-delete-comment]"), "your own comment shows a delete button");

  ownCommentRow.querySelector("[data-delete-comment]").click();
  await flush();
  assert(!mockComments[communityId].some((c) => c.id === ownCommentId), "deleting your own comment calls window.MG.deleteComment and removes it");

  // ---- Friends & Family (signed in): send a recipe, view the inbox ----
  go("#/friends");
  assert(!!window.document.getElementById("friend-lookup-btn"), "Friends & Family shows the send form once signed in");
  await flush();
  assert(/Kielbasa Stew/.test(window.document.getElementById("shared-with-me-list").textContent), "inbox lists a recipe shared with you");
  assert(/ciocia_ewa/.test(window.document.getElementById("shared-with-me-list").textContent), "inbox shows who shared it");

  window.document.getElementById("friend-username").value = "nobody_here";
  window.document.getElementById("friend-lookup-btn").click();
  await flush();
  assert(/Couldn't look that up/.test(window.document.getElementById("friend-lookup-status").textContent), "looking up an unknown friend shows an error");

  window.document.getElementById("friend-username").value = "babcia_anna";
  window.document.getElementById("friend-lookup-btn").click();
  await flush();
  assert(/babcia_anna/.test(window.document.getElementById("friend-lookup-preview").textContent), "a successful lookup previews the friend's username");
  const friendRecipeSelect = window.document.getElementById("friend-send-recipe");
  assert(!!friendRecipeSelect && friendRecipeSelect.options.length > 0, "send form offers a choice of your own recipes");
  window.document.getElementById("friend-send-btn").click();
  await flush();
  assert(friendShareLog.some((s) => s.friendUid === "friend1"), "Send Recipe calls window.MG.shareRecipeToFriend with the looked-up friend's uid");

  // Add a shared recipe to My Recipes, then dismiss it from the inbox.
  go("#/friends");
  await flush();
  window.document.querySelector('[data-add-share="share1"]').click();
  await flush();
  assert(mockCloudRecipes.some((r) => r.title === "Kielbasa Stew"), "Add to My Recipes copies the shared recipe via window.MG.upsertRecipe");
  assert(!sharedInboxMock.some((i) => i.id === "share1"), "adding a shared recipe also clears it from the inbox");
  assert(!/Kielbasa Stew/.test(window.document.getElementById("shared-with-me-list").textContent), "inbox no longer shows the added recipe");

  // ---- Meal Planning (signed in, cloud sync via mocked window.MG) ----
  go("#/meal-plan");
  assert(/Synced to your account/.test(window.document.getElementById("view").textContent), "meal plan shows the cloud-synced hint once signed in");

  const mpTodayISO = window.isoDate(new Date());
  go("#/meal-plan/day/" + mpTodayISO);
  const pierogiCard = Array.from(window.document.querySelectorAll("[data-pick-mealplan]")).find((n) => n.getAttribute("data-pick-mealplan") === savedShared.id);
  assert(!!pierogiCard, "day picker lists the signed-in user's cloud recipes");
  pierogiCard.click();
  await flush();
  assert(mockCloudMealPlan[mpTodayISO] === savedShared.id, "picking a recipe while signed in calls window.MG.upsertMealPlanEntry");

  go("#/meal-plan/day/" + mpTodayISO);
  assert(!!window.document.getElementById("meal-plan-clear-btn"), "day picker shows Clear once a cloud-synced recipe is planned");
  window.document.getElementById("meal-plan-clear-btn").click();
  await flush();
  assert(!mockCloudMealPlan[mpTodayISO], "clearing a day while signed in calls window.MG.deleteMealPlanEntryCloud");

  // ---- Profile (signed in, admin) — mocked window.MG with isAdmin:true ----
  const grants = [{ uid: "u2", grantedTo: "janes_kitchen", granted: true }];
  const adminUser = { uid: "admin1", email: "maggie13a2z@gmail.com", username: "maggie", contactInfo: "", avatar: "", isAdmin: true, emailVerified: true };
  let reportsMock = [
    { id: "r1", communityRecipeId: "friend1_abc", reporterUid: "u9", reason: "wrong ingredients", recipeTitle: "Golabki", recipeAuthor: "babcia_anna" },
  ];
  const removedRecipeIds = [];
  window.MG = {
    getCurrentUser: () => adminUser,
    getCloudRecipes: () => [],
    saveContactInfo: async () => {},
    saveAvatar: async () => {},
    changeUsername: async (u) => { adminUser.username = u; return u; },
    signOutUser: async () => {},
    migrateLocalToCloud: async () => {},
    listGrants: async () => grants.slice(),
    lookupUserForGrant: async (username) => {
      const key = username.trim().toLowerCase();
      if (key === "new_friend") return { uid: "u3", username: "new_friend", avatar: "", email: "newfriend@example.com", contactInfo: "555-1234" };
      throw new Error("No account found with that username.");
    },
    grantFriendAccess: async (username) => { grants.push({ uid: "u3", grantedTo: username, granted: true }); return username; },
    revokeFriendAccess: async (uid) => { const i = grants.findIndex((g) => g.uid === uid); if (i >= 0) grants.splice(i, 1); },
    isAdmin: () => true,
    listReports: async () => reportsMock.slice(),
    dismissReport: async (reportId) => { reportsMock = reportsMock.filter((r) => r.id !== reportId); },
    removeReportedRecipe: async (communityRecipeId, reportId) => {
      removedRecipeIds.push(communityRecipeId);
      reportsMock = reportsMock.filter((r) => r.id !== reportId);
    },
  };
  go("#/profile");
  assert(!!window.document.getElementById("grant-lookup-btn"), "profile page shows the friends & family admin panel for the admin account");
  await flush();
  assert(/janes_kitchen/.test(window.document.getElementById("grants-list").textContent), "admin panel lists an existing grant, got: " + window.document.getElementById("grants-list").textContent);

  // Looking up an unknown username shows an error and grants nothing.
  window.document.getElementById("grant-username").value = "nonexistent_user";
  window.document.getElementById("grant-lookup-btn").click();
  await flush();
  assert(/Couldn't look that up/.test(window.document.getElementById("grant-status").textContent), "looking up an unknown username shows an error, got: " + window.document.getElementById("grant-status").textContent);
  assert(!grants.some((g) => g.grantedTo === "nonexistent_user"), "a failed lookup grants nothing");

  // Looking up a real username shows a preview (so the admin can visually
  // confirm it's the right person) WITHOUT granting anything yet.
  window.document.getElementById("grant-username").value = "new_friend";
  window.document.getElementById("grant-lookup-btn").click();
  await flush();
  assert(/new_friend/.test(window.document.getElementById("grant-preview").textContent), "looking up a username shows a preview with that username, got: " + window.document.getElementById("grant-preview").textContent);
  assert(/newfriend@example.com/.test(window.document.getElementById("grant-preview").textContent), "the preview shows the looked-up account's email");
  assert(!grants.some((g) => g.grantedTo === "new_friend"), "looking up a username does not grant access by itself");

  // Cancel clears the preview without granting.
  window.document.getElementById("grant-cancel-btn").click();
  assert(window.document.getElementById("grant-preview").innerHTML === "", "Cancel clears the lookup preview");
  assert(!grants.some((g) => g.grantedTo === "new_friend"), "canceling a preview grants nothing");

  // Looking it up again and confirming actually grants access.
  window.document.getElementById("grant-lookup-btn").click();
  await flush();
  window.document.getElementById("grant-confirm-btn").click();
  await flush();
  assert(grants.some((g) => g.grantedTo === "new_friend"), "confirming the preview calls window.MG.grantFriendAccess");
  assert(/new_friend/.test(window.document.getElementById("grants-list").textContent), "admin panel list refreshes to show the newly granted friend");
  assert(window.document.getElementById("grant-preview").innerHTML === "", "the preview clears after confirming");

  const revokeBtn = window.document.querySelector('.revoke-grant-btn[data-uid="u2"]');
  revokeBtn.click();
  await flush();
  assert(!grants.some((g) => g.uid === "u2"), "revoking a grant calls window.MG.revokeFriendAccess");
  assert(!/janes_kitchen/.test(window.document.getElementById("grants-list").textContent), "admin panel list refreshes after a revoke");

  assert(!!window.document.getElementById("review-reports-btn"), "admin profile shows a Review Reports button");
  window.document.getElementById("review-reports-btn").click();
  assert(window.location.hash === "#/admin/reports", "Review Reports navigates to the admin reports screen");

  // ---- Admin: review reports ----
  go("#/admin/reports");
  await flush();
  assert(/Golabki/.test(window.document.getElementById("reports-list").textContent), "reports list shows the reported recipe's title");
  assert(/babcia_anna/.test(window.document.getElementById("reports-list").textContent), "reports list shows the reported recipe's author");
  assert(/wrong ingredients/.test(window.document.getElementById("reports-list").textContent), "reports list shows the report's reason");

  const dismissReportBtn = window.document.querySelector('[data-dismiss-report="r1"]');
  const removeReportBtn = window.document.querySelector('[data-remove-report="r1"]');
  assert(!!dismissReportBtn && !!removeReportBtn, "each report row offers Dismiss and Remove Recipe");

  // A non-admin can't see this screen at all.
  window.MG.isAdmin = () => false;
  go("#/admin/reports");
  assert(/Only the app owner/i.test(window.document.getElementById("view").textContent), "a non-admin visiting #/admin/reports is turned away");
  window.MG.isAdmin = () => true;

  go("#/admin/reports");
  await flush();
  window.document.querySelector('[data-remove-report="r1"]').click();
  await flush();
  assert(removedRecipeIds.includes("friend1_abc"), "Remove Recipe calls window.MG.removeReportedRecipe with the community recipe id");
  assert(!reportsMock.some((r) => r.id === "r1"), "removing the recipe also clears its report");
  assert(/all clear/i.test(window.document.getElementById("reports-list").textContent), "reports list shows an all-clear message once empty");

  window.MG = undefined; // don't leak the mock into anything after this point

  console.log(pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
}

main();
