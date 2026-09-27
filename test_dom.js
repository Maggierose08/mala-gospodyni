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
  assert(homeBoxes.length === 5, "home screen shows 5 boxes, got " + homeBoxes.length);
  assert(window.document.querySelectorAll(".quick-link").length === 2, "home screen shows 2 quick links");

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

  // ---- Drilling into the Desserts folder shows the recipe ----
  go("#/recipes/dessert");
  assert(/Test Banana Bread/.test(window.document.getElementById("view").textContent), "Desserts folder page shows the saved recipe");
  const dessertBackBtn = window.document.getElementById("back-btn");
  assert(dessertBackBtn.getAttribute("data-back-route") === "#/recipes", "Desserts folder page's back button returns to the Recipes folder grid, not Home");

  const recipeId = saved[0].id;

  // ---- Scale Converter ----
  go("#/scale/" + recipeId);

  // Popular conversions quick-reference table
  const popRows = window.document.querySelectorAll(".temp-ref-table tr");
  assert(popRows.length === 18, "popular conversions table has header + 17 rows, got " + popRows.length);
  const popText = window.document.getElementById("view").textContent;
  assert(/1 kg[\s\S]*2\.2 lb/.test(popText), "popular conversions table includes 1 kg = 2.2 lb");
  assert(!/1 cup[\s\S]{0,20}16 tbsp/.test(popText), "popular conversions table no longer includes 1 cup = 16 tbsp");
  assert(/1 cup flour[\s\S]*120 g/.test(popText), "popular conversions table includes 1 cup flour = 120 g");
  assert(/1 tbsp sugar[\s\S]*12\.5 g/.test(popText), "popular conversions table includes 1 tbsp sugar = 12.5 g");
  assert(/1 cup butter[\s\S]*227 g/.test(popText), "popular conversions table includes 1 cup butter = 227 g");

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
  assert(/Convert your own ingredients/.test(window.document.body.textContent), "scale converter has a merged 'convert your own ingredients' section");
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
  go("#/allergen/" + recipeId);
  const glutenChk = Array.from(window.document.querySelectorAll(".saved-allergen-chk")).find((c) => c.value === "gluten");
  const eggChk = Array.from(window.document.querySelectorAll(".saved-allergen-chk")).find((c) => c.value === "egg");
  glutenChk.checked = true;
  eggChk.checked = true;
  window.document.getElementById("saved-check-allergens-btn").click();
  const results = window.document.getElementById("saved-allergen-results").textContent;
  assert(/flour/i.test(results) && /gluten-free/i.test(results), "allergen checker flags flour for gluten");
  assert(/eggs/i.test(results) && /flaxseed/i.test(results), "allergen checker flags eggs with flaxseed ratio");

  // "Check your own ingredients" section (merged scan + manual entry) — same
  // pre-populated-blank-row pattern as Scale Converter above.
  assert(!!window.document.getElementById("allergen-scan-input"), "allergen checker shows its own scan control");
  assert(window.document.getElementById("allergen-scan-reminder").style.display === "none", "scan-accuracy disclaimer stays hidden until a scan happens");
  assert(/Check your own ingredients/.test(window.document.body.textContent), "allergen checker has a merged 'check your own ingredients' section");
  assert(/Or use a saved recipe/.test(window.document.body.textContent), "allergen checker labels the saved-recipe picker section");
  const adhocAllergenRow = window.document.querySelector("#adhoc-allergen-ingredient-rows .ing-row");
  assert(!!adhocAllergenRow, "check-your-own-ingredients section starts with one blank ingredient row");
  adhocAllergenRow.querySelector(".ing-name").value = "milk";
  const adhocDairyChk = Array.from(window.document.querySelectorAll(".adhoc-allergen-allergen-chk")).find((c) => c.value === "dairy");
  adhocDairyChk.checked = true;
  window.document.getElementById("adhoc-allergen-check-allergens-btn").click();
  const adhocResults = window.document.getElementById("adhoc-allergen-allergen-results").textContent;
  assert(/milk/i.test(adhocResults) && /dairy/i.test(adhocResults), "ad-hoc allergen card flags a manually-entered ingredient, got: " + adhocResults);

  // ---- Temperature Converter ----
  go("#/temp");
  assert(window.document.querySelectorAll(".temp-ref-table tr").length === 12, "temp quick-reference table has header + 11 rows");
  const tempF = window.document.getElementById("temp-f");
  tempF.value = "350";
  tempF.dispatchEvent(new window.Event("input"));
  assert(window.document.getElementById("temp-c").value === "176.67", "350F converts to 176.67C, got " + window.document.getElementById("temp-c").value);

  // Oven type selector
  const ovenSelect = window.document.getElementById("oven-type-select");
  assert(ovenSelect.value === "electric", "oven type defaults to electric");
  assert(/no adjustment is usually needed/i.test(window.document.getElementById("oven-type-info").textContent), "electric oven info shows the no-adjustment-needed summary");
  assert(window.document.getElementById("temp-oven-adjust").textContent === "", "no oven-adjustment note shown for the default electric oven");

  ovenSelect.value = "gas";
  ovenSelect.dispatchEvent(new window.Event("change"));
  assert(/hot spots/i.test(window.document.getElementById("oven-type-info").textContent), "gas oven info mentions hot spots");
  assert(window.document.getElementById("temp-oven-adjust").textContent === "", "no numeric oven-adjustment note shown for gas (no agreed-on offset)");

  ovenSelect.value = "convection";
  ovenSelect.dispatchEvent(new window.Event("change"));
  assert(/25.F/.test(window.document.getElementById("oven-type-info").textContent), "convection oven info mentions the 25°F rule of thumb");
  assert(/325.F/.test(window.document.getElementById("temp-oven-adjust").textContent), "convection adjustment note suggests 325°F for a 350°F recipe, got: " + window.document.getElementById("temp-oven-adjust").textContent);

  const elevInput = window.document.getElementById("elevation-ft");
  elevInput.value = "6000";
  elevInput.dispatchEvent(new window.Event("input"));
  assert(/oven temperature/.test(window.document.getElementById("altitude-result").textContent), "altitude adjustment shows guidance at 6000ft");

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

  // ---- Edit + delete recipe ----
  go("#/recipe/edit/" + recipeId);
  assert(window.document.getElementById("recipe-title").value === "Test Banana Bread", "edit form prefills existing title");
  assert(window.document.querySelectorAll(".ing-row").length === 2, "edit form prefills existing ingredient rows");
  const prefilledDessertPill = Array.from(window.document.querySelectorAll(".category-pill")).find((p) => p.getAttribute("data-category") === "dessert");
  assert(prefilledDessertPill.classList.contains("selected"), "edit form prefills the recipe's existing category (Desserts)");
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

  // ---- Stub pages don't crash ----
  ["#/friends", "#/settings", "#/community", "#/substitutions"].forEach((h) => {
    go(h);
    assert(/not built yet/i.test(window.document.getElementById("view").textContent), "stub page renders for " + h);
  });

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
  const mockUser = { uid: "u1", email: "test@example.com", username: "testchef", contactInfo: "", avatar: "", isAdmin: false };
  window.MG = {
    getCurrentUser: () => mockUser,
    getCloudRecipes: () => [],
    saveContactInfo: async (info) => { mockUser.contactInfo = info; },
    saveAvatar: async (dataUrl) => { mockUser.avatar = dataUrl; },
    changeUsername: async (u) => { mockUser.username = u; window.dispatchEvent(new window.Event("mg-auth-changed")); return u; },
    signOutUser: async () => { /* not invoked in this test */ },
    migrateLocalToCloud: async () => {},
  };
  go("#/profile");
  assert(window.document.getElementById("username-input").value === "testchef", "profile page shows the signed-in username once window.MG reports a user");
  assert(!!window.document.getElementById("sign-out-btn"), "profile page shows a Sign Out button when signed in");
  assert(!window.document.getElementById("tab-signin"), "profile page hides the sign-in form once signed in");
  assert(!!window.document.getElementById("avatar-btn"), "profile page shows a Change Photo button for any signed-in user");
  assert(!window.document.getElementById("grant-btn"), "profile page hides the friends & family admin panel for a non-admin user");

  window.document.getElementById("username-input").value = "new_handle";
  window.document.getElementById("save-username-btn").click();
  await flush();
  assert(mockUser.username === "new_handle", "saving a new username calls window.MG.changeUsername");
  assert(window.document.getElementById("username-input").value === "new_handle", "profile page shows the updated username after saving");

  // ---- Profile (signed in, admin) — mocked window.MG with isAdmin:true ----
  const grants = [{ uid: "u2", grantedTo: "janes_kitchen", granted: true }];
  const adminUser = { uid: "admin1", email: "maggie13a2z@gmail.com", username: "maggie", contactInfo: "", avatar: "", isAdmin: true };
  window.MG = {
    getCurrentUser: () => adminUser,
    getCloudRecipes: () => [],
    saveContactInfo: async () => {},
    saveAvatar: async () => {},
    changeUsername: async (u) => { adminUser.username = u; return u; },
    signOutUser: async () => {},
    migrateLocalToCloud: async () => {},
    listGrants: async () => grants.slice(),
    grantFriendAccess: async (username) => { grants.push({ uid: "u3", grantedTo: username, granted: true }); return username; },
    revokeFriendAccess: async (uid) => { const i = grants.findIndex((g) => g.uid === uid); if (i >= 0) grants.splice(i, 1); },
  };
  go("#/profile");
  assert(!!window.document.getElementById("grant-btn"), "profile page shows the friends & family admin panel for the admin account");
  await flush();
  assert(/janes_kitchen/.test(window.document.getElementById("grants-list").textContent), "admin panel lists an existing grant, got: " + window.document.getElementById("grants-list").textContent);

  window.document.getElementById("grant-username").value = "new_friend";
  window.document.getElementById("grant-btn").click();
  await flush();
  assert(grants.some((g) => g.grantedTo === "new_friend"), "granting a username calls window.MG.grantFriendAccess");
  assert(/new_friend/.test(window.document.getElementById("grants-list").textContent), "admin panel list refreshes to show the newly granted friend");

  const revokeBtn = window.document.querySelector('.revoke-grant-btn[data-uid="u2"]');
  revokeBtn.click();
  await flush();
  assert(!grants.some((g) => g.uid === "u2"), "revoking a grant calls window.MG.revokeFriendAccess");
  assert(!/janes_kitchen/.test(window.document.getElementById("grants-list").textContent), "admin panel list refreshes after a revoke");

  window.MG = undefined; // don't leak the mock into anything after this point

  console.log(pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
}

main();
