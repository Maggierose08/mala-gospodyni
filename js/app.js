// ============================================================
// Mała Gospodyni — Phase 1 app shell (UI + routing + storage).
// Depends on logic.js being loaded first.
// ============================================================

// ---------- Simple line-drawing icons (inline SVG, sage/pastel friendly) ----------
const ICONS = {
  pot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-4Z"/><path d="M2 10h20"/><path d="M7 10V7a2 2 0 0 1 2-2M17 10V7a2 2 0 0 0-2-2"/><path d="M9 3.5h1M14 3.5h1"/></svg>`,
  scale: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 2 13a3.5 3.5 0 0 0 6 0L5 7Z"/><path d="M19 7l-3 6a3.5 3.5 0 0 0 6 0l-3-6Z"/><path d="M8 21h8"/></svg>`,
  leaf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4C10 4 4 10 4 18v2h2c8 0 14-6 14-16Z"/><path d="M6 20c2-6 6-10 12-12"/></svg>`,
  thermo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a2 2 0 0 0-2 2v9.3a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2Z"/><path d="M12 8v6"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.6"/><path d="M2.5 20c.6-3.6 3-5.5 5.5-5.5s4.9 1.9 5.5 5.5"/><path d="M13.5 15c2-.3 4 .8 4.6 3.2"/></svg>`,
  person: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4 20c1-4.3 4-6.5 8-6.5s7 2.2 8 6.5"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.4-2-3.4-2.3.8a7.6 7.6 0 0 0-1.7-1L15 3.6h-4l-.4 2.4a7.6 7.6 0 0 0-1.7 1l-2.3-.8-2 3.4L6.6 11a7.7 7.7 0 0 0 0 2l-2 1.4 2 3.4 2.3-.8a7.6 7.6 0 0 0 1.7 1l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 1.7-1l2.3.8 2-3.4-2-1.4Z"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2V5Z"/><path d="M20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 0 2-2V5Z"/></svg>`,
  swap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.3"/></svg>`,
  wand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 15 9"/><path d="M17 3v3M22 8h-3M17.5 5.5l-2 2"/><path d="M6 3v3M9 5H6M6.5 3.5l-1 1"/><path d="M19 15v3M21 18h-3"/></svg>`,
  utensils: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v7a2 2 0 0 0 2 2v11"/><path d="M7 2v5M10 2v5"/><path d="M17 2c-1.7 0-3 2-3 5s1.3 5 3 5v10"/></svg>`,
  cupcake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10h10l-1.4 8.8a2 2 0 0 1-2 1.7h-3.2a2 2 0 0 1-2-1.7L7 10Z"/><path d="M8 10a4 4 0 0 1 8 0"/><path d="M12 3v3M9.3 4.6l1.2 1.3M14.7 4.6l-1.2 1.3"/></svg>`,
  bowl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M12 11V8M8.5 11l-1-2.5M15.5 11l1-2.5"/></svg>`,
  skewer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 20 4"/><circle cx="9" cy="15" r="2"/><circle cx="13" cy="11" r="2"/><circle cx="17" cy="7" r="2"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>`,
};

// Recipes are organized into these folders (plus an "uncategorized" bucket
// for anything not yet filed) — shown as a home-screen-style grid on the
// Recipes tab, and offered as a set of pick-one buttons on the recipe form.
const RECIPE_CATEGORIES = [
  { key: "main", label: "Main Courses", icon: "utensils", color: "butter" },
  { key: "dessert", label: "Desserts", icon: "cupcake", color: "blush" },
  { key: "side", label: "Sides", icon: "bowl", color: "" },
  { key: "appetizer", label: "Appetizers", icon: "skewer", color: "blush" },
];

// ---------- Storage ----------
// Signed out: recipes live in this browser's localStorage, exactly as in
// Phase 1. Signed in: recipes live in Firestore (via window.MG, set up by
// firebase-init.js) and sync across every device you're signed into — the
// local cloudRecipes cache below is kept fresh by its "mg-recipes-changed"
// event, so reads here stay synchronous either way.
const STORAGE_KEY = "mg_recipes_v1";

function hasCloud() {
  return typeof window.MG !== "undefined";
}

function isSignedIn() {
  return hasCloud() && !!window.MG.getCurrentUser();
}

function getLocalRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Could not read saved recipes", e);
    return [];
  }
}

function saveLocalRecipes(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function getRecipes() {
  if (isSignedIn()) return window.MG.getCloudRecipes();
  return getLocalRecipes();
}

function getRecipe(id) {
  return getRecipes().find((r) => r.id === id) || null;
}

// Returns a promise so callers that need to know when a cloud write has
// actually gone through can await it; signed-out (localStorage) writes are
// synchronous under the hood but still return a resolved promise, so the
// calling code doesn't need an if/else for the two modes.
function upsertRecipe(recipe) {
  if (isSignedIn()) return window.MG.upsertRecipe(recipe);
  const list = getLocalRecipes();
  const idx = list.findIndex((r) => r.id === recipe.id);
  if (idx >= 0) list[idx] = recipe;
  else list.push(recipe);
  saveLocalRecipes(list);
  return Promise.resolve();
}

function deleteRecipe(id) {
  if (isSignedIn()) return window.MG.deleteRecipeCloud(id);
  saveLocalRecipes(getLocalRecipes().filter((r) => r.id !== id));
  return Promise.resolve();
}

function newId() {
  return "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Small helpers ----------
function el(html) {
  const div = document.createElement("div");
  div.innerHTML = html.trim();
  return div.firstElementChild;
}

// ---------- Scan a Recipe (OCR, fully in-browser via bundled Tesseract) ----------
// A worker is created once and reused across scans (creating one loads the
// ~6MB OCR engine + language data, so we don't want to repeat that per scan).
let ocrWorkerPromise = null;
function getOcrWorker(onProgress) {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = Tesseract.createWorker("eng", undefined, {
      workerPath: "js/vendor/tesseract/worker.min.js",
      corePath: "js/vendor/tesseract/tesseract-core-simd-lstm.js",
      langPath: "js/vendor/tesseract/lang",
      gzip: true,
      logger: (m) => { if (onProgress) onProgress(m); },
    });
  }
  return ocrWorkerPromise;
}

function renderScanControl(idPrefix, label) {
  return `
    <div class="scan-box">
      <label for="${idPrefix}-input" class="btn secondary" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
        ${ICONS.camera} ${label || "Scan a Recipe"}
      </label>
      <input type="file" id="${idPrefix}-input" accept="image/*" style="display:none;">
      <span class="hint" style="display:block;margin:4px 0 0;">Choose a photo you've already taken, or take a new one.</span>
      <div id="${idPrefix}-status" class="hint" style="margin-top:6px;"></div>
      <div id="${idPrefix}-preview"></div>
    </div>
  `;
}

// Wires a scan control to run OCR on the chosen photo and hand the parsed
// {title, ingredients, steps} result to `onResult`.
function wireScanControl(idPrefix, onResult) {
  const input = document.getElementById(`${idPrefix}-input`);
  const status = document.getElementById(`${idPrefix}-status`);
  const preview = document.getElementById(`${idPrefix}-preview`);
  if (!input) return;

  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    preview.innerHTML = "";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.cssText = "max-width:160px;max-height:160px;border-radius:8px;margin-top:8px;display:block;";
    preview.appendChild(img);

    status.textContent = "Loading the scanner (first time only, this can take a bit)…";
    try {
      const worker = await getOcrWorker((m) => {
        if (m.status === "recognizing text") {
          status.textContent = `Reading your photo… ${Math.round((m.progress || 0) * 100)}%`;
        } else if (m.status) {
          status.textContent = m.status + "…";
        }
      });
      status.textContent = "Reading your photo…";
      const { data } = await worker.recognize(file);
      const parsed = parseOcrText(data.text || "");
      status.textContent = "Done — please check the fields below against your photo before saving.";
      onResult(parsed);
    } catch (err) {
      console.error("OCR scan failed", err);
      status.textContent = "Sorry, that photo couldn't be read. Try a clearer or better-lit photo, or type the recipe in by hand.";
    }
  });
}

// `backRoute` defaults to Home, but a drill-down page (like a recipe
// category, nested under the Recipes tab) can pass its parent route instead
// so the back arrow returns there rather than skipping past it.
function pageHeader(title, backRoute) {
  return `<div class="page-header">
    <button class="back-btn" id="back-btn" title="Back" data-back-route="${backRoute || "#/home"}">←</button>
    <h1>${title}</h1>
  </div>`;
}

// ---------- View: Home ----------
function renderHome() {
  return `
    <div class="home-grid">
      <div class="home-box" data-route="#/recipes">${ICONS.pot}<span>Recipes</span></div>
      <div class="home-box blush" data-route="#/scale">${ICONS.scale}<span>Scale Converter</span></div>
      <div class="home-box butter" data-route="#/allergen">${ICONS.leaf}<span>Allergen Checker</span></div>
      <div class="home-box" data-route="#/temp">${ICONS.thermo}<span>Temperature Converter</span></div>
      <div class="home-box blush" data-route="#/create">${ICONS.wand}<span>Recipe Creator</span></div>
    </div>
    <div class="quick-links">
      <div class="quick-link" data-route="#/community">${ICONS.book} Community Recipes</div>
      <div class="quick-link" data-route="#/substitutions">${ICONS.swap} Substitution Tips</div>
    </div>
  `;
}

// ---------- View: Recipes (folders) ----------
function renderRecipeCardRows(recipes) {
  return recipes.length
    ? recipes.map((r) => `
        <div class="recipe-card" data-open-recipe="${r.id}">
          <div>
            <div class="rc-title">${escapeHtml(r.title || "(untitled recipe)")}</div>
            <div class="rc-meta">${r.servings || "?"} servings · ${(r.ingredients || []).length} ingredients</div>
          </div>
          <span>›</span>
        </div>`).join("")
    : `<p class="muted-msg">No recipes here yet.</p>`;
}

function renderRecipesList() {
  const recipes = getRecipes();
  const uncategorized = recipes.filter((r) => !r.category);

  const syncNote = isSignedIn()
    ? `<p class="hint">☁ Synced to your account — these recipes follow you to any device you sign into.</p>`
    : `<p class="hint">💾 Saved on this device only. <a href="#/profile">Sign in</a> to sync recipes across your phone and computer.</p>`;

  const folderTiles = RECIPE_CATEGORIES.map((c) => {
    const count = recipes.filter((r) => r.category === c.key).length;
    return `
      <div class="home-box ${c.color}" data-route="#/recipes/${c.key}">
        ${ICONS[c.icon]}<span>${c.label}</span>
        <span class="hint" style="margin:0;">${count} recipe${count === 1 ? "" : "s"}</span>
      </div>`;
  }).join("");

  const uncategorizedTile = uncategorized.length ? `
    <div class="home-box" data-route="#/recipes/uncategorized">
      ${ICONS.folder}<span>Uncategorized</span>
      <span class="hint" style="margin:0;">${uncategorized.length} recipe${uncategorized.length === 1 ? "" : "s"}</span>
    </div>` : "";

  const emptyNote = recipes.length ? "" : `<p class="muted-msg">No recipes saved yet — add your first one below.</p>`;

  return `
    ${pageHeader("Recipes")}
    ${syncNote}
    ${emptyNote}
    <div class="home-grid">
      ${folderTiles}
      ${uncategorizedTile}
    </div>
    <div class="recipe-actions">
      <button class="btn" id="new-recipe-btn">+ New Recipe</button>
    </div>
  `;
}

function renderRecipeCategory(categoryKey) {
  const meta = RECIPE_CATEGORIES.find((c) => c.key === categoryKey);
  const label = meta ? meta.label : "Uncategorized";
  const recipes = getRecipes().filter((r) => (meta ? r.category === categoryKey : !r.category));
  return `
    ${pageHeader(label, "#/recipes")}
    ${renderRecipeCardRows(recipes)}
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- View: New / Edit Recipe ----------
function renderRecipeForm(id) {
  const existing = id ? getRecipe(id) : null;
  const title = existing ? "Edit Recipe" : "New Recipe";
  return `
    ${pageHeader(title)}
    <div class="card">
      <h2>Scan a Recipe</h2>
      <p class="hint">Have a photo of this recipe already? Scan it to fill in the fields below — then double-check everything before saving.</p>
      ${renderScanControl("scan", "Upload a Photo")}
      <div id="scan-reminder" class="disclaimer" style="display:none;">
        <strong>Please check this carefully:</strong> automatic scanning can misread handwriting, smudges, or unusual formatting.
        Compare everything below against your original recipe before you save it.
      </div>
    </div>
    <div class="card">
      <div class="row-flex">
        <div class="field" style="flex:2; min-width:200px;">
          <label for="recipe-title">Recipe title</label>
          <input type="text" id="recipe-title" placeholder="e.g. Grandma's Banana Bread" value="${existing ? escapeHtml(existing.title) : ""}">
        </div>
        <div class="field" style="min-width:130px;">
          <label for="orig-servings">Original servings</label>
          <input type="number" id="orig-servings" min="0" step="any" value="${existing ? existing.servings : 4}">
        </div>
      </div>

      <label>Ingredients</label>
      <div class="ing-header"><span>Qty</span><span>Unit</span><span>Ingredient</span><span></span></div>
      <div id="ingredient-rows"></div>
      <button class="btn secondary" type="button" id="add-ingredient-btn">+ Add Ingredient</button>

      <div style="margin-top:16px;">
        <label for="recipe-steps">Steps (optional)</label>
        <textarea id="recipe-steps" placeholder="1. Preheat oven...">${existing ? escapeHtml(existing.steps || "") : ""}</textarea>
      </div>

      <div style="margin-top:16px;">
        <label>File this recipe under</label>
        <p class="hint">Pick a folder so it's easy to find later in the Recipes tab. Tap it again to remove it from that folder.</p>
        <div class="category-pills" id="category-pills">
          ${RECIPE_CATEGORIES.map((c) => `
            <button type="button" class="category-pill${existing && existing.category === c.key ? " selected" : ""}" data-category="${c.key}">
              ${ICONS[c.icon]} ${c.label}
            </button>`).join("")}
        </div>
      </div>

      <div class="recipe-actions">
        <button class="btn" id="save-recipe-btn">Save Recipe</button>
        ${existing ? `<button class="btn danger" id="delete-recipe-btn">Delete</button>` : ""}
      </div>
    </div>
    <p class="hint">Tip: type the ingredient name clearly (e.g. "all-purpose flour") — it helps the Scale Converter and Allergen Checker recognize it later.</p>
  `;
}

const UNIT_OPTIONS = [
  { value: "", label: "none / each" },
  { value: "tsp", label: "tsp" }, { value: "tbsp", label: "tbsp" }, { value: "cup", label: "cup" },
  { value: "fl oz", label: "fl oz" }, { value: "mL", label: "mL" }, { value: "L", label: "L" },
  { value: "g", label: "g" }, { value: "kg", label: "kg" }, { value: "oz", label: "oz" }, { value: "lb", label: "lb" },
];

function buildUnitSelect(selected, extraFirstOption) {
  const select = document.createElement("select");
  if (extraFirstOption) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = extraFirstOption;
    select.appendChild(opt);
  }
  for (const u of UNIT_OPTIONS) {
    if (extraFirstOption && u.value === "") continue;
    const opt = document.createElement("option");
    opt.value = u.value;
    opt.textContent = u.label;
    select.appendChild(opt);
  }
  if (selected !== undefined) select.value = selected;
  return select;
}

function addIngredientRow(container, qty, unit, name, onRemove) {
  const row = document.createElement("div");
  row.className = "ing-row";

  const qtyInput = document.createElement("input");
  qtyInput.type = "number"; qtyInput.step = "any"; qtyInput.min = "0";
  qtyInput.value = qty !== undefined ? qty : "";
  qtyInput.placeholder = "1"; qtyInput.className = "ing-qty";

  const unitSelect = buildUnitSelect(unit || "");
  unitSelect.className = "ing-unit";

  const nameInput = document.createElement("input");
  nameInput.type = "text"; nameInput.value = name || "";
  nameInput.placeholder = "e.g. all-purpose flour"; nameInput.className = "ing-name";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button"; removeBtn.className = "remove-btn"; removeBtn.title = "Remove ingredient";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => { row.remove(); if (onRemove) onRemove(); });

  row.appendChild(qtyInput);
  row.appendChild(unitSelect);
  row.appendChild(nameInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
  return row;
}

function readIngredientRows(container) {
  return Array.from(container.querySelectorAll(".ing-row")).map((row) => ({
    qty: parseFloat(row.querySelector(".ing-qty").value),
    unit: row.querySelector(".ing-unit").value,
    name: row.querySelector(".ing-name").value,
  }));
}

function wireRecipeForm(id) {
  const existing = id ? getRecipe(id) : null;
  const rowsContainer = document.getElementById("ingredient-rows");

  if (existing && existing.ingredients && existing.ingredients.length) {
    existing.ingredients.forEach((i) => addIngredientRow(rowsContainer, i.qty, i.unit, i.name));
  } else {
    addIngredientRow(rowsContainer, "", "", "");
  }

  document.getElementById("add-ingredient-btn").addEventListener("click", () => {
    addIngredientRow(rowsContainer, "", "", "");
  });

  wireScanControl("scan", (parsed) => {
    if (parsed.title) document.getElementById("recipe-title").value = parsed.title;
    if (parsed.ingredients.length) {
      rowsContainer.innerHTML = "";
      parsed.ingredients.forEach((i) => addIngredientRow(rowsContainer, i.qty, i.unit, i.name));
    }
    if (parsed.steps) document.getElementById("recipe-steps").value = parsed.steps;
    document.getElementById("scan-reminder").style.display = "block";
  });

  // Category pills are a single-select (with tap-to-deselect) — no hidden
  // <select>, just a class toggle, with the chosen key tracked here.
  let selectedCategory = existing && existing.category ? existing.category : "";
  document.querySelectorAll(".category-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const key = pill.getAttribute("data-category");
      selectedCategory = selectedCategory === key ? "" : key;
      document.querySelectorAll(".category-pill").forEach((p) => {
        p.classList.toggle("selected", p.getAttribute("data-category") === selectedCategory);
      });
    });
  });

  const saveBtn = document.getElementById("save-recipe-btn");
  saveBtn.addEventListener("click", async () => {
    const title = document.getElementById("recipe-title").value.trim();
    const servings = parseFloat(document.getElementById("orig-servings").value);
    const steps = document.getElementById("recipe-steps").value;
    const ingredients = readIngredientRows(rowsContainer).filter((i) => i.name.trim() || !isNaN(i.qty));
    if (!title) { alert("Please give the recipe a title before saving."); return; }
    const recipe = {
      id: existing ? existing.id : newId(),
      title, servings: isNaN(servings) ? 0 : servings, ingredients, steps,
      category: selectedCategory,
    };
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      await upsertRecipe(recipe);
      location.hash = "#/recipes";
    } catch (err) {
      console.error("Could not save recipe", err);
      alert("Sorry, that recipe couldn't be saved: " + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Recipe";
    }
  });

  const deleteBtn = document.getElementById("delete-recipe-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (confirm("Delete this recipe? This can't be undone.")) {
        try {
          await deleteRecipe(existing.id);
          location.hash = "#/recipes";
        } catch (err) {
          console.error("Could not delete recipe", err);
          alert("Sorry, that recipe couldn't be deleted: " + (err.message || err));
        }
      }
    });
  }
}

// ---------- Shared: pick a saved recipe ----------
function renderRecipePicker(selectedId, routePrefix) {
  const recipes = getRecipes();
  if (!recipes.length) {
    return `<p class="muted-msg">You don't have any saved recipes yet. <a href="#/recipes">Add one first</a>.</p>`;
  }
  return `<div class="pick-list">${recipes.map((r) => `
    <div class="pick-item ${r.id === selectedId ? "selected" : ""}" data-pick-recipe="${r.id}" data-route-prefix="${routePrefix}">
      ${escapeHtml(r.title || "(untitled recipe)")}
    </div>`).join("")}</div>`;
}

// Renders one scaled-ingredient line plus its per-ingredient "convert to"
// picker into `output`. Shared by the saved-recipe Scale Converter and the
// ad-hoc (scanned-but-not-saved) one below, so the two stay in sync.
function appendScaledIngredientRow(output, item, scaled) {
  const unitLabel = item.unit || "";
  const nameText = (item.name || "").trim() || "(unnamed ingredient)";

  const line = document.createElement("div");
  line.className = "scaled-row";

  const left = document.createElement("span");
  left.textContent = nameText;

  const rightWrap = document.createElement("span");
  rightWrap.className = "scaled-amt";
  rightWrap.textContent = `${fmtNum(scaled)} ${unitLabel}`;

  line.appendChild(left);
  line.appendChild(rightWrap);
  output.appendChild(line);

  // per-ingredient convert-to picker
  const convertRow = document.createElement("div");
  convertRow.style.cssText = "display:flex;align-items:center;gap:8px;margin:-2px 0 8px;";
  const convertSelect = buildUnitSelect("", "convert to…");
  convertSelect.style.maxWidth = "160px";
  const convertedOut = document.createElement("span");
  convertedOut.style.fontSize = "0.85rem";
  convertedOut.style.color = "var(--sage-dark)";
  convertSelect.addEventListener("change", () => {
    if (!convertSelect.value) { convertedOut.textContent = ""; return; }
    const result = convertUnit(scaled, item.unit, convertSelect.value, item.name);
    if (result.ok) {
      convertedOut.textContent = `${result.approximate ? "≈" : "="} ${fmtNum(result.value)} ${convertSelect.value}`;
      convertedOut.style.color = "var(--sage-dark)";
    } else if (result.reason === "no-density") {
      convertedOut.textContent = "can't convert — unknown ingredient density";
      convertedOut.style.color = "var(--danger)";
    } else {
      convertedOut.textContent = "can't convert between these units";
      convertedOut.style.color = "var(--danger)";
    }
  });
  convertRow.appendChild(convertSelect);
  convertRow.appendChild(convertedOut);
  output.appendChild(convertRow);
}

function renderPopularConversionsTable() {
  return `
    <div class="card">
      <h2>Popular conversions</h2>
      <table class="temp-ref-table">
        <tr><th>Amount</th><th>Equals</th></tr>
        ${POPULAR_CONVERSIONS.map((c) => `<tr><td>${c.label}</td><td>${c.approx ? "≈" : "="} ${c.value} ${c.unit}</td></tr>`).join("")}
      </table>
    </div>
  `;
}

// ---------- View: Scale Converter ----------
// Split into two folders (same pattern as the Recipes tab): a static
// reference table, and the "convert your own" workspace (manual entry,
// scan, and the saved-recipe picker + live output).
function renderScaleHome() {
  return `
    ${pageHeader("Scale Converter")}
    <div class="home-grid">
      <div class="home-box butter" data-route="#/scale/popular">${ICONS.book}<span>Popular Conversions</span></div>
      <div class="home-box blush" data-route="#/scale/convert">${ICONS.scale}<span>Convert Your Own</span></div>
    </div>
  `;
}

function renderScalePopular() {
  return `
    ${pageHeader("Popular Conversions", "#/scale")}
    ${renderPopularConversionsTable()}
  `;
}

function renderScaleConvert(id) {
  const recipe = id ? getRecipe(id) : null;
  let body = `
    ${pageHeader("Convert Your Own", "#/scale")}
    <div class="card">
      <p class="hint">Add ingredients by hand below, or scan a photo of a recipe you haven't saved yet — no need to save it first.</p>
      ${renderScanControl("scale-scan", "Scan a Photo Instead")}
      <div id="scale-scan-reminder" class="disclaimer" style="display:none;">
        <strong>Please check this carefully:</strong> automatic scanning can misread handwriting, smudges, or unusual formatting.
        Compare the ingredients below against your photo, and fix anything wrong, before trusting the scaled amounts.
      </div>
      <div class="row-flex" style="margin-top:12px;">
        <div class="field" style="min-width:160px;">
          <label for="adhoc-orig-servings">Original servings</label>
          <input type="number" id="adhoc-orig-servings" min="0" step="any" value="4">
        </div>
      </div>
      <label>Ingredients</label>
      <div class="ing-header"><span>Qty</span><span>Unit</span><span>Ingredient</span><span></span></div>
      <div id="adhoc-scale-ingredient-rows"></div>
      <button class="btn secondary" type="button" id="adhoc-scale-add-ingredient-btn">+ Add Ingredient</button>
      <div class="row-flex" style="margin-top:14px;">
        <div class="field" style="min-width:160px;">
          <label for="adhoc-target-servings">Scale to how many servings?</label>
          <input type="number" id="adhoc-target-servings" min="0" step="any" value="4">
        </div>
      </div>
      <div id="adhoc-scale-output"></div>
    </div>
    <p class="section-label">Or use a saved recipe</p>
    ${renderRecipePicker(id, "#/scale/convert/")}
  `;
  if (recipe) {
    body += `
      <div class="card">
        <h2>${escapeHtml(recipe.title)}</h2>
        <div class="row-flex">
          <div class="field" style="min-width:160px;">
            <label for="target-servings">Scale to how many servings?</label>
            <input type="number" id="target-servings" min="0" step="any" value="${recipe.servings || 4}">
          </div>
        </div>
        <p class="hint">Every ingredient amount below updates live as you change servings.</p>
        <div id="scale-output"></div>
      </div>
    `;
  }
  return body;
}

function wireScaleConvert(id) {
  // ---- Convert your own ingredients (blank by default; scan to fill in) ----
  const adhocRows = document.getElementById("adhoc-scale-ingredient-rows");
  const adhocOrigServings = document.getElementById("adhoc-orig-servings");
  const adhocTargetServings = document.getElementById("adhoc-target-servings");
  const adhocOutput = document.getElementById("adhoc-scale-output");
  const scanReminder = document.getElementById("scale-scan-reminder");

  function adhocRecompute() {
    const origServings = parseFloat(adhocOrigServings.value);
    const target = parseFloat(adhocTargetServings.value);
    const items = readIngredientRows(adhocRows).filter((i) => i.name.trim() || !isNaN(i.qty));
    adhocOutput.innerHTML = "";
    for (const item of items) {
      const scaled = scaleQty(item.qty, origServings, isNaN(target) ? 0 : target);
      appendScaledIngredientRow(adhocOutput, item, scaled);
    }
    if (!items.length) {
      adhocOutput.innerHTML = '<p class="muted-msg">Add at least one ingredient above to see scaled amounts.</p>';
    }
  }

  // Start with one blank editable row, like the New Recipe form.
  addIngredientRow(adhocRows, "", "", "", adhocRecompute);

  document.getElementById("adhoc-scale-add-ingredient-btn").addEventListener("click", () => {
    addIngredientRow(adhocRows, "", "", "", adhocRecompute);
    adhocRecompute();
  });
  adhocOrigServings.addEventListener("input", adhocRecompute);
  adhocTargetServings.addEventListener("input", adhocRecompute);
  adhocRows.addEventListener("input", adhocRecompute);
  adhocRows.addEventListener("change", adhocRecompute);

  wireScanControl("scale-scan", (parsed) => {
    scanReminder.style.display = "block";
    adhocRows.innerHTML = "";
    if (parsed.ingredients.length) {
      parsed.ingredients.forEach((i) => addIngredientRow(adhocRows, i.qty, i.unit, i.name, adhocRecompute));
    } else {
      addIngredientRow(adhocRows, "", "", "", adhocRecompute);
    }
    adhocRecompute();
  });

  adhocRecompute();

  // ---- Saved recipe ----
  const recipe = id ? getRecipe(id) : null;
  if (!recipe) return;
  const targetInput = document.getElementById("target-servings");
  const output = document.getElementById("scale-output");

  function recompute() {
    const target = parseFloat(targetInput.value);
    output.innerHTML = "";
    for (const item of recipe.ingredients || []) {
      const scaled = scaleQty(item.qty, recipe.servings, isNaN(target) ? 0 : target);
      appendScaledIngredientRow(output, item, scaled);
    }
    if (!(recipe.ingredients || []).length) {
      output.innerHTML = '<p class="muted-msg">This recipe has no ingredients yet.</p>';
    }
  }

  targetInput.addEventListener("input", recompute);
  recompute();
}

// ---------- View: Allergen Checker ----------
// Shared by the saved-recipe and ad-hoc (scanned-but-not-saved) Allergen
// Checker flows — the checkbox row, check button, and results container.
function renderAllergenCheckBlock(idPrefix) {
  return `
    <p class="hint">Select the categories you need to avoid, then check.</p>
    <div class="allergen-checks">
      <label><input type="checkbox" class="${idPrefix}-allergen-chk" value="dairy"> Dairy</label>
      <label><input type="checkbox" class="${idPrefix}-allergen-chk" value="egg"> Egg</label>
      <label><input type="checkbox" class="${idPrefix}-allergen-chk" value="gluten"> Gluten</label>
      <label><input type="checkbox" class="${idPrefix}-allergen-chk" value="nuts"> Nuts</label>
      <label><input type="checkbox" class="${idPrefix}-allergen-chk" value="soy"> Soy</label>
    </div>
    <div class="recipe-actions">
      <button class="btn" id="${idPrefix}-check-allergens-btn">Check My Recipe</button>
    </div>
    <div id="${idPrefix}-allergen-results" class="allergen-results-box" style="margin-top:14px;"></div>
  `;
}

const ALLERGEN_DISCLAIMER = `
  <div class="disclaimer">
    <strong>Please note:</strong> these are general cooking substitution ideas and approximate ratios only —
    a starting point to adjust by taste and texture, not verified medical or allergy-safety advice. Product
    formulations change, and cross-contamination is a real risk. If you or someone you're cooking for has a
    serious allergy, always check ingredient labels yourself and consult a doctor or allergist — do not rely
    on this tool for safety decisions.
  </div>
`;

function wireAllergenChecker(idPrefix, getIngredientNames) {
  const btn = document.getElementById(`${idPrefix}-check-allergens-btn`);
  if (!btn) return;
  btn.addEventListener("click", () => {
    const selected = Array.from(document.querySelectorAll(`.${idPrefix}-allergen-chk:checked`)).map((c) => c.value);
    const resultsDiv = document.getElementById(`${idPrefix}-allergen-results`);
    if (!selected.length) {
      resultsDiv.innerHTML = '<p class="muted-msg">Select at least one category above, then check again.</p>';
      return;
    }
    const names = getIngredientNames().filter((n) => n && n.trim());
    if (!names.length) {
      resultsDiv.innerHTML = '<p class="muted-msg">This recipe has no named ingredients yet.</p>';
      return;
    }
    const matches = checkAllergens(names, selected);
    if (!matches.length) {
      resultsDiv.innerHTML = '<p class="muted-msg">No matches found for the selected categories in this recipe.</p>';
      return;
    }
    resultsDiv.innerHTML = matches.map((m) => `
      <div class="match">
        <span class="ing-name">${escapeHtml(m.ingredient)}</span><span class="cat-tag">${m.label}</span>
        <div style="margin-top:4px;">${m.suggestion}</div>
      </div>`).join("");
  });
}

function renderAllergen(id) {
  const recipe = id ? getRecipe(id) : null;
  let body = `
    ${pageHeader("Allergen Checker")}
    <div class="card">
      <h2>Check your own ingredients</h2>
      <p class="hint">Add ingredients by hand below, or scan a photo of a recipe you haven't saved yet — no need to save it first.</p>
      ${renderScanControl("allergen-scan", "Scan a Photo Instead")}
      <div id="allergen-scan-reminder" class="disclaimer" style="display:none;">
        <strong>Please check this carefully:</strong> automatic scanning can misread handwriting, smudges, or unusual formatting.
        Compare the ingredients below against your photo, and fix anything wrong — accuracy matters most here.
      </div>
      <label style="margin-top:12px;">Ingredients</label>
      <div class="ing-header"><span>Qty</span><span>Unit</span><span>Ingredient</span><span></span></div>
      <div id="adhoc-allergen-ingredient-rows"></div>
      <button class="btn secondary" type="button" id="adhoc-allergen-add-ingredient-btn">+ Add Ingredient</button>
      <div style="margin-top:14px;">
        ${renderAllergenCheckBlock("adhoc-allergen")}
      </div>
      ${ALLERGEN_DISCLAIMER}
    </div>
    <p class="section-label">Or use a saved recipe</p>
    ${renderRecipePicker(id, "#/allergen/")}
  `;
  if (recipe) {
    body += `
      <div class="card">
        <h2>${escapeHtml(recipe.title)}</h2>
        ${renderAllergenCheckBlock("saved")}
        ${ALLERGEN_DISCLAIMER}
      </div>
    `;
  }
  return body;
}

function wireAllergen(id) {
  // ---- Check your own ingredients (blank by default; scan to fill in) ----
  const adhocRows = document.getElementById("adhoc-allergen-ingredient-rows");
  const scanReminder = document.getElementById("allergen-scan-reminder");

  // Start with one blank editable row, like the New Recipe form.
  addIngredientRow(adhocRows, "", "", "");

  document.getElementById("adhoc-allergen-add-ingredient-btn").addEventListener("click", () => {
    addIngredientRow(adhocRows, "", "", "");
  });

  wireScanControl("allergen-scan", (parsed) => {
    scanReminder.style.display = "block";
    adhocRows.innerHTML = "";
    if (parsed.ingredients.length) {
      parsed.ingredients.forEach((i) => addIngredientRow(adhocRows, i.qty, i.unit, i.name));
    } else {
      addIngredientRow(adhocRows, "", "", "");
    }
  });

  wireAllergenChecker("adhoc-allergen", () => readIngredientRows(adhocRows).map((i) => i.name));

  // ---- Saved recipe ----
  const recipe = id ? getRecipe(id) : null;
  if (!recipe) return;
  wireAllergenChecker("saved", () => (recipe.ingredients || []).map((i) => i.name));
}

// ---------- View: Temperature Converter ----------
function renderOvenTypeCard() {
  return `
    <div class="card">
      <h2>Oven type</h2>
      <p class="hint">Recipes are usually written for a standard electric oven — select yours for tips on what to watch for.</p>
      <div class="row-flex" style="margin-bottom:10px;">
        <div class="field" style="min-width:220px;">
          <label for="oven-type-select">Your oven</label>
          <select id="oven-type-select">
            ${Object.keys(OVEN_TYPES).map((key) => `<option value="${key}">${OVEN_TYPES[key].label}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="oven-type-info"></div>
    </div>
  `;
}

function renderOvenTypeInfo(key) {
  const info = OVEN_TYPES[key];
  if (!info) return "";
  return `
    <p class="hint">${info.summary}</p>
    <ul style="margin:6px 0 0; padding-left:20px; font-size:0.88rem; color:var(--ink);">
      ${info.tips.map((t) => `<li style="margin-bottom:4px;">${t}</li>`).join("")}
    </ul>
  `;
}

function renderTemp() {
  return `
    ${pageHeader("Temperature Converter")}
    ${renderOvenTypeCard()}
    <div class="card">
      <h2>Quick reference</h2>
      <table class="temp-ref-table">
        <tr><th>°F</th><th>°C</th></tr>
        ${OVEN_TEMP_QUICK_REF.map((r) => `<tr><td>${r.f}°F</td><td>${r.c}°C</td></tr>`).join("")}
      </table>
    </div>
    <div class="card">
      <h2>Convert any temperature</h2>
      <div class="temp-widget">
        <div class="temp-field"><input type="number" id="temp-f" step="any" placeholder="350"><label for="temp-f" style="margin:0;">°F</label></div>
        <span>=</span>
        <div class="temp-field"><input type="number" id="temp-c" step="any" placeholder="177"><label for="temp-c" style="margin:0;">°C</label></div>
      </div>
      <p id="temp-oven-adjust" class="hint" style="margin-top:8px;"></p>
    </div>
    <div class="card">
      <h2>Altitude adjustment</h2>
      <p class="hint">Rule-of-thumb guidance only — the right adjustment depends on the specific recipe.</p>
      <div class="row-flex">
        <div class="field" style="min-width:160px;">
          <label for="elevation-ft">Your elevation (feet)</label>
          <input type="number" id="elevation-ft" min="0" step="any" placeholder="e.g. 5000">
        </div>
      </div>
      <p id="altitude-result" class="hint" style="margin-top:6px;"></p>
    </div>
  `;
}

function wireTemp() {
  const ovenSelect = document.getElementById("oven-type-select");
  const ovenInfo = document.getElementById("oven-type-info");
  const tempF = document.getElementById("temp-f");
  const tempC = document.getElementById("temp-c");
  const ovenAdjust = document.getElementById("temp-oven-adjust");

  function updateOvenAdjustNote() {
    const info = OVEN_TYPES[ovenSelect.value];
    const f = parseFloat(tempF.value);
    if (!info || !info.offsetF || tempF.value === "" || isNaN(f)) {
      ovenAdjust.textContent = "";
      return;
    }
    const adjustedF = f + info.offsetF;
    ovenAdjust.textContent = `For a ${info.label.toLowerCase()} oven, try around ${fmtNum(adjustedF)}°F (${fmtNum(fToC(adjustedF))}°C) instead, and check a few minutes early.`;
  }

  ovenSelect.addEventListener("change", () => {
    ovenInfo.innerHTML = renderOvenTypeInfo(ovenSelect.value);
    updateOvenAdjustNote();
  });
  ovenInfo.innerHTML = renderOvenTypeInfo(ovenSelect.value);

  tempF.addEventListener("input", () => {
    if (tempF.value === "") { tempC.value = ""; ovenAdjust.textContent = ""; return; }
    const f = parseFloat(tempF.value);
    if (!isNaN(f)) tempC.value = fmtNum(fToC(f));
    updateOvenAdjustNote();
  });
  tempC.addEventListener("input", () => {
    if (tempC.value === "") { tempF.value = ""; ovenAdjust.textContent = ""; return; }
    const c = parseFloat(tempC.value);
    if (!isNaN(c)) tempF.value = fmtNum(cToF(c));
    updateOvenAdjustNote();
  });

  const elevationInput = document.getElementById("elevation-ft");
  const altResult = document.getElementById("altitude-result");
  elevationInput.addEventListener("input", () => {
    const ft = parseFloat(elevationInput.value);
    if (elevationInput.value === "" || isNaN(ft)) { altResult.textContent = ""; return; }
    altResult.textContent = altitudeAdjustment(ft).message;
  });
}

// ---------- View: Recipe Creator ----------
// Turns a free-text request into a real recipe + grocery list, matched
// against RECIPE_TEMPLATES (logic.js) rather than an outside AI service —
// see the comment above RECIPE_TEMPLATES for why. Kept as module-level
// state (like profileMode below) so the generated recipe survives re-wiring
// but not a full navigation away from the page.
let lastGeneratedRecipe = null;

function renderRecipeCreator() {
  return `
    ${pageHeader("Recipe Creator")}
    <div class="card">
      <h2>What would you like to make?</h2>
      <p class="hint">Describe what you're after — a protein, cuisine, meal type, how many people, any dietary needs, how much time you have. For example: "a quick vegetarian pasta for 4" or "gluten-free dinner for 6".</p>
      <div class="field" style="margin-bottom:12px;">
        <label for="recipe-request">Your request</label>
        <textarea id="recipe-request" placeholder="e.g. a quick chicken dinner for 4, dairy-free"></textarea>
      </div>
      <div class="row-flex">
        <div class="field" style="min-width:200px;">
          <label for="recipe-request-servings">Servings (optional)</label>
          <input type="number" id="recipe-request-servings" min="1" step="1" placeholder="uses your request, or the recipe's default">
        </div>
      </div>
      <div class="recipe-actions">
        <button class="btn" id="generate-recipe-btn">Create Recipe</button>
      </div>
      <p class="hint" style="margin-top:10px;">
        This matches your request against a library of real recipes built into the app — not an outside AI — and scales the closest one to your servings. That keeps it free and working offline, but it won't always be a perfect fit for an unusual request.
      </p>
    </div>
    <div class="card" id="generated-recipe-card" style="display:none;">
      <h2 id="generated-recipe-title"></h2>
      <p class="hint" id="generated-recipe-meta"></p>
      <div id="generated-recipe-notes"></div>

      <label>Grocery list</label>
      <p class="hint">Check off anything you already have on hand — what's left is what to buy.</p>
      <div id="grocery-list"></div>

      <div style="margin-top:16px;">
        <label>Steps</label>
        <ol id="generated-recipe-steps" style="padding-left:20px; font-size:0.95rem;"></ol>
      </div>

      <div class="recipe-actions">
        <button class="btn" id="save-generated-recipe-btn">Save this recipe</button>
        <button class="btn secondary" id="try-another-btn">Try another idea</button>
      </div>
    </div>
  `;
}

function renderGroceryList(ingredients) {
  return ingredients.map((item, idx) => {
    const qtyText = item.qty == null ? "" : `${fmtNum(item.qty)} `;
    const unitText = item.unit ? `${item.unit} ` : "";
    return `
      <label class="grocery-row" for="grocery-${idx}">
        <input type="checkbox" id="grocery-${idx}" class="grocery-chk">
        <span class="grocery-text">${escapeHtml(qtyText + unitText + item.name)}</span>
      </label>
    `;
  }).join("");
}

function wireRecipeCreator() {
  const requestInput = document.getElementById("recipe-request");
  const servingsInput = document.getElementById("recipe-request-servings");
  const generateBtn = document.getElementById("generate-recipe-btn");
  const resultCard = document.getElementById("generated-recipe-card");
  const titleEl = document.getElementById("generated-recipe-title");
  const metaEl = document.getElementById("generated-recipe-meta");
  const notesEl = document.getElementById("generated-recipe-notes");
  const groceryEl = document.getElementById("grocery-list");
  const stepsEl = document.getElementById("generated-recipe-steps");
  const saveBtn = document.getElementById("save-generated-recipe-btn");
  const tryAnotherBtn = document.getElementById("try-another-btn");

  function generate() {
    const request = requestInput.value.trim();
    if (!request) { alert("Tell me a little about what you'd like to make first."); return; }
    const servingsVal = parseFloat(servingsInput.value);
    const recipe = generateRecipe(request, isNaN(servingsVal) ? null : servingsVal);
    lastGeneratedRecipe = recipe;

    titleEl.textContent = recipe.title;
    metaEl.textContent = `${fmtNum(recipe.servings)} servings · about ${recipe.timeMinutes} minutes`;

    let notesHtml = "";
    if (!recipe.matchedWell) {
      notesHtml += `<p class="hint">I didn't find a close match for that exact request, so here's a recipe from the library you might like instead — try naming a protein, cuisine, or meal type for a closer match next time.</p>`;
    }
    if (recipe.requestedDietary.length && !recipe.dietaryHonored) {
      notesHtml += `<div class="disclaimer">I couldn't find a recipe in the library that's fully ${recipe.requestedDietary.join(" + ")} for this request — please double-check the ingredients below before making this.</div>`;
    }
    notesEl.innerHTML = notesHtml;

    groceryEl.innerHTML = renderGroceryList(recipe.ingredients);
    groceryEl.querySelectorAll(".grocery-chk").forEach((chk) => {
      chk.addEventListener("change", () => {
        chk.closest(".grocery-row").classList.toggle("have", chk.checked);
      });
    });

    stepsEl.innerHTML = recipe.steps
      .map((s) => `<li style="margin-bottom:6px;">${escapeHtml(s)}</li>`)
      .join("");

    resultCard.style.display = "block";
    if (resultCard.scrollIntoView) resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  generateBtn.addEventListener("click", generate);

  saveBtn.addEventListener("click", async () => {
    if (!lastGeneratedRecipe) return;
    const g = lastGeneratedRecipe;
    const recipe = {
      id: newId(),
      title: g.title,
      servings: g.servings,
      ingredients: g.ingredients.map((i) => ({ qty: i.qty, unit: i.unit, name: i.name })),
      steps: g.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n"),
    };
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      await upsertRecipe(recipe);
      saveBtn.textContent = "Saved!";
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save this recipe";
      }, 1500);
    } catch (err) {
      console.error("Could not save recipe", err);
      alert("Sorry, that recipe couldn't be saved: " + (err.message || err));
      saveBtn.disabled = false;
      saveBtn.textContent = "Save this recipe";
    }
  });

  tryAnotherBtn.addEventListener("click", () => {
    resultCard.style.display = "none";
    lastGeneratedRecipe = null;
    requestInput.value = "";
    servingsInput.value = "";
    requestInput.focus();
  });
}

// ---------- View: Profile (Phase 2 — accounts & sync) ----------
let profileMode = "signin"; // "signin" | "signup" — remembers which tab was showing across re-renders
let profileError = "";
let migrationDismissed = false;

function renderProfile() {
  if (hasCloud() && isSignedIn()) {
    const user = window.MG.getCurrentUser();
    const localCount = migrationDismissed ? 0 : getLocalRecipes().length;
    return `
      ${pageHeader("Profile")}
      <div class="card">
        <h2>Signed in</h2>
        <div class="avatar-row">
          ${user.avatar
            ? `<img class="avatar-preview" src="${user.avatar}" alt="Your profile picture">`
            : `<div class="avatar-preview placeholder">${ICONS.person}</div>`}
          <div>
            <p class="hint" style="margin-bottom:8px;">${escapeHtml(user.email)}</p>
            <input type="file" id="avatar-input" accept="image/*" style="display:none;">
            <button class="btn secondary" type="button" id="avatar-btn">Change Photo</button>
          </div>
        </div>
        <p id="avatar-status" class="hint"></p>
        <div class="field">
          <label for="username-input">Username <span class="muted-msg">(what friends will search for you by)</span></label>
          <input type="text" id="username-input" value="${escapeHtml(user.username || "")}">
        </div>
        <div class="recipe-actions">
          <button class="btn" id="save-username-btn">Save Username</button>
        </div>
        <p id="username-status" class="hint"></p>
        <div class="field">
          <label for="contact-info">Contact info <span class="muted-msg">(for friends &amp; family, coming later — optional)</span></label>
          <input type="text" id="contact-info" placeholder="e.g. a phone number or note" value="${escapeHtml(user.contactInfo || "")}">
        </div>
        <div class="recipe-actions">
          <button class="btn" id="save-contact-btn">Save</button>
        </div>
        <p id="profile-status" class="hint"></p>
      </div>
      ${localCount > 0 ? `
      <div class="card">
        <h2>Recipes on this device</h2>
        <p class="hint">You have ${localCount} recipe${localCount === 1 ? "" : "s"} saved on this device from before you signed in. Add ${localCount === 1 ? "it" : "them"} to your account so ${localCount === 1 ? "it syncs" : "they sync"} everywhere?</p>
        <div class="recipe-actions">
          <button class="btn" id="migrate-btn">Add to my account</button>
          <button class="btn secondary" id="dismiss-migrate-btn">Not now</button>
        </div>
      </div>` : ""}
      ${user.isAdmin ? `
      <div class="card">
        <h2>Friends &amp; Family free access</h2>
        <p class="hint">Give a specific person full access with no subscription, ever — enforced by the database itself, so no one else can grant this to themselves.</p>
        <div class="row-flex">
          <div class="field" style="flex:1; min-width:160px;">
            <label for="grant-username">Their username</label>
            <input type="text" id="grant-username" placeholder="e.g. janes_kitchen">
          </div>
        </div>
        <div class="recipe-actions">
          <button class="btn" id="grant-btn">Grant free access</button>
        </div>
        <p id="grant-status" class="hint"></p>
        <div id="grants-list" style="margin-top:10px;">Loading current list…</div>
      </div>` : ""}
      <div class="card">
        <button class="btn danger" id="sign-out-btn">Sign Out</button>
      </div>
    `;
  }

  return `
    ${pageHeader("Profile")}
    <div class="card">
      <div class="row-flex" style="margin-bottom:16px;">
        <button class="btn ${profileMode === "signin" ? "" : "secondary"}" type="button" id="tab-signin" style="flex:1;">Sign In</button>
        <button class="btn ${profileMode === "signup" ? "" : "secondary"}" type="button" id="tab-signup" style="flex:1;">Create Account</button>
      </div>
      ${profileError ? `<div class="disclaimer">${escapeHtml(profileError)}</div>` : ""}
      ${profileMode === "signup" ? `
        <div class="field">
          <label for="signup-username">Username</label>
          <input type="text" id="signup-username" placeholder="e.g. maggies_kitchen">
        </div>
        <div class="field">
          <label for="signup-email">Email</label>
          <input type="email" id="signup-email" placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="signup-password">Password</label>
          <input type="password" id="signup-password" placeholder="At least 6 characters">
        </div>
        <div class="recipe-actions">
          <button class="btn" id="signup-btn">Create Account</button>
        </div>
      ` : `
        <div class="field">
          <label for="signin-email">Email</label>
          <input type="email" id="signin-email" placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="signin-password">Password</label>
          <input type="password" id="signin-password" placeholder="Your password">
        </div>
        <div class="recipe-actions">
          <button class="btn" id="signin-btn">Sign In</button>
        </div>
        <button class="link-btn" type="button" id="forgot-password-btn">Forgot password?</button>
        <p id="reset-status" class="hint"></p>
      `}
      <p class="hint">Signing in lets your recipes follow you to any phone or computer. Without an account, recipes stay saved on this device only.</p>
    </div>
  `;
}

// Reads an image file, crops it to a square, and shrinks it to a small
// (200x200) JPEG data URL — small enough to store directly on the user's
// Firestore profile document, so profile pictures don't need Firebase
// Storage (which requires a paid billing plan) or any other paid service.
function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Sorry, that photo couldn't be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like a valid image."));
      img.onload = () => {
        const size = 200;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderGrantRow(g) {
  return `
    <div class="grant-row" data-uid="${g.uid}">
      <span>${escapeHtml(g.grantedTo || g.uid)}</span>
      <button type="button" class="remove-btn revoke-grant-btn" data-uid="${g.uid}" title="Revoke free access">×</button>
    </div>`;
}

function wireProfile() {
  if (hasCloud() && isSignedIn()) {
    const avatarInput = document.getElementById("avatar-input");
    const avatarBtn = document.getElementById("avatar-btn");
    const avatarStatus = document.getElementById("avatar-status");
    avatarBtn.addEventListener("click", () => avatarInput.click());
    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files[0];
      if (!file) return;
      avatarBtn.disabled = true;
      avatarStatus.textContent = "Uploading…";
      try {
        const dataUrl = await fileToAvatarDataUrl(file);
        await window.MG.saveAvatar(dataUrl);
        avatarStatus.textContent = "Saved.";
        // "mg-auth-changed" (fired by saveAvatar) triggers the re-render.
      } catch (err) {
        avatarStatus.textContent = "Couldn't save that photo: " + (err.message || err);
        avatarBtn.disabled = false;
      }
    });

    const grantBtn = document.getElementById("grant-btn");
    if (grantBtn) {
      const grantStatus = document.getElementById("grant-status");
      const grantsList = document.getElementById("grants-list");

      function loadGrants() {
        window.MG.listGrants().then((list) => {
          grantsList.innerHTML = list.length
            ? list.map(renderGrantRow).join("")
            : `<p class="muted-msg">No one has free access yet.</p>`;
          grantsList.querySelectorAll(".revoke-grant-btn").forEach((btn) => {
            btn.addEventListener("click", async () => {
              btn.disabled = true;
              try {
                await window.MG.revokeFriendAccess(btn.getAttribute("data-uid"));
                loadGrants();
              } catch (err) {
                alert("Couldn't revoke access: " + (err.message || err));
                btn.disabled = false;
              }
            });
          });
        }).catch((err) => {
          grantsList.innerHTML = `<p class="muted-msg">Couldn't load the list: ${escapeHtml(err.message || String(err))}</p>`;
        });
      }
      loadGrants();

      grantBtn.addEventListener("click", async () => {
        const usernameInput = document.getElementById("grant-username");
        const username = usernameInput.value.trim();
        if (!username) { grantStatus.textContent = "Please enter a username."; return; }
        grantBtn.disabled = true;
        grantStatus.textContent = "Granting…";
        try {
          const granted = await window.MG.grantFriendAccess(username);
          grantStatus.textContent = `${granted} now has free access.`;
          usernameInput.value = "";
          loadGrants();
        } catch (err) {
          grantStatus.textContent = "Couldn't grant access: " + (err.message || err);
        }
        grantBtn.disabled = false;
      });
    }

    const saveUsernameBtn = document.getElementById("save-username-btn");
    saveUsernameBtn.addEventListener("click", async () => {
      const status = document.getElementById("username-status");
      const newUsername = document.getElementById("username-input").value.trim();
      if (!newUsername) { status.textContent = "Please enter a username."; return; }
      saveUsernameBtn.disabled = true;
      status.textContent = "Saving…";
      try {
        await window.MG.changeUsername(newUsername);
        status.textContent = "Saved.";
        // "mg-auth-changed" (fired by changeUsername) triggers the re-render.
      } catch (err) {
        status.textContent = "Couldn't save: " + (err.message || err);
        saveUsernameBtn.disabled = false;
      }
    });

    const saveBtn = document.getElementById("save-contact-btn");
    saveBtn.addEventListener("click", async () => {
      const status = document.getElementById("profile-status");
      saveBtn.disabled = true;
      try {
        await window.MG.saveContactInfo(document.getElementById("contact-info").value.trim());
        status.textContent = "Saved.";
      } catch (err) {
        status.textContent = "Couldn't save: " + (err.message || err);
      }
      saveBtn.disabled = false;
    });

    const migrateBtn = document.getElementById("migrate-btn");
    if (migrateBtn) {
      migrateBtn.addEventListener("click", async () => {
        migrateBtn.disabled = true;
        migrateBtn.textContent = "Adding…";
        try {
          await window.MG.migrateLocalToCloud(getLocalRecipes());
          saveLocalRecipes([]);
          render();
        } catch (err) {
          alert("Sorry, those recipes couldn't be added to your account: " + (err.message || err));
          migrateBtn.disabled = false;
          migrateBtn.textContent = "Add to my account";
        }
      });
    }
    const dismissBtn = document.getElementById("dismiss-migrate-btn");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => { migrationDismissed = true; render(); });
    }

    const signOutBtn = document.getElementById("sign-out-btn");
    signOutBtn.addEventListener("click", async () => {
      signOutBtn.disabled = true;
      try {
        await window.MG.signOutUser();
      } catch (err) {
        alert("Sorry, something went wrong signing out: " + (err.message || err));
        signOutBtn.disabled = false;
      }
    });
    return;
  }

  const tabSignin = document.getElementById("tab-signin");
  const tabSignup = document.getElementById("tab-signup");
  tabSignin.addEventListener("click", () => { profileMode = "signin"; profileError = ""; render(); });
  tabSignup.addEventListener("click", () => { profileMode = "signup"; profileError = ""; render(); });

  const signinBtn = document.getElementById("signin-btn");
  if (signinBtn) {
    signinBtn.addEventListener("click", async () => {
      const email = document.getElementById("signin-email").value.trim();
      const password = document.getElementById("signin-password").value;
      if (!email || !password) { profileError = "Please enter both an email and a password."; render(); return; }
      if (!hasCloud()) { profileError = "Still connecting — please wait a moment and try again."; render(); return; }
      signinBtn.disabled = true;
      signinBtn.textContent = "Signing in…";
      try {
        await window.MG.signIn(email, password);
        profileError = "";
        // "mg-auth-changed" (fired by firebase-init.js) triggers the re-render.
      } catch (err) {
        profileError = err.message || "Sorry, something went wrong signing in.";
        render();
      }
    });
  }

  const forgotBtn = document.getElementById("forgot-password-btn");
  if (forgotBtn) {
    forgotBtn.addEventListener("click", async () => {
      const status = document.getElementById("reset-status");
      const email = document.getElementById("signin-email").value.trim();
      if (!email) { status.textContent = "Enter your email above first, then click this again."; return; }
      if (!hasCloud()) { status.textContent = "Still connecting — please try again in a moment."; return; }
      forgotBtn.disabled = true;
      status.textContent = "Sending…";
      try {
        await window.MG.resetPassword(email);
        status.textContent = "Check your email for a link to reset your password.";
      } catch (err) {
        status.textContent = "Couldn't send that: " + (err.message || err);
      }
      forgotBtn.disabled = false;
    });
  }

  const signupBtn = document.getElementById("signup-btn");
  if (signupBtn) {
    signupBtn.addEventListener("click", async () => {
      const username = document.getElementById("signup-username").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;
      if (!username || !email || !password) { profileError = "Please fill in a username, email, and password."; render(); return; }
      if (!hasCloud()) { profileError = "Still connecting — please wait a moment and try again."; render(); return; }
      signupBtn.disabled = true;
      signupBtn.textContent = "Creating…";
      try {
        await window.MG.signUp(email, password, username);
        profileError = "";
      } catch (err) {
        profileError = err.message || "Sorry, something went wrong creating your account.";
        render();
      }
    });
  }
}

// ---------- Stub views (Phase 2 / 3 features) ----------
function renderStub(title, phaseNote) {
  return `
    ${pageHeader(title)}
    <div class="stub-note">
      <strong>${title}</strong> is planned but not built yet — ${phaseNote}
    </div>
  `;
}

// ---------- Router ----------
const routes = {
  "#/home": { render: renderHome },
  "#/recipes": { render: renderRecipesList },
  "#/recipe/new": { render: () => renderRecipeForm(null), wire: () => wireRecipeForm(null) },
  "#/friends": { render: () => renderStub("Friends & Family", "sharing recipes with friends and family is coming in a future update, now that accounts are in place.") },
  "#/settings": { render: () => renderStub("Settings", "unit system and theme are coming in a later phase — for now the app uses US customary units and light mode.") },
  "#/profile": { render: renderProfile, wire: wireProfile },
  "#/create": { render: renderRecipeCreator, wire: wireRecipeCreator },
  "#/community": { render: () => renderStub("Community Recipes", "this arrives in Phase 3, alongside moderation and the premium tier.") },
  "#/substitutions": { render: () => renderStub("Substitution Tips", "this arrives in Phase 3, alongside moderation and the premium tier.") },
};

function currentRoute() {
  const hash = location.hash || "#/home";
  const parts = hash.split("/");
  if (hash.startsWith("#/recipe/edit/")) return { name: "edit-recipe", id: parts[3] };
  if (hash.startsWith("#/recipes/")) return { name: "recipe-category", category: parts[2] };
  if (hash.startsWith("#/scale/convert/")) return { name: "scale-convert", id: parts[3] };
  if (hash === "#/scale/convert") return { name: "scale-convert", id: null };
  if (hash === "#/scale/popular") return { name: "scale-popular" };
  if (hash === "#/scale") return { name: "scale-home" };
  if (hash.startsWith("#/allergen/")) return { name: "allergen", id: parts[2] };
  if (hash === "#/allergen") return { name: "allergen", id: null };
  if (hash === "#/temp") return { name: "temp" };
  if (routes[hash]) return { name: hash };
  return { name: "#/home" };
}

function render() {
  const route = currentRoute();
  const view = document.getElementById("view");

  if (route.name === "edit-recipe") {
    view.innerHTML = renderRecipeForm(route.id);
    wireRecipeForm(route.id);
  } else if (route.name === "recipe-category") {
    view.innerHTML = renderRecipeCategory(route.category);
  } else if (route.name === "scale-home") {
    view.innerHTML = renderScaleHome();
  } else if (route.name === "scale-popular") {
    view.innerHTML = renderScalePopular();
  } else if (route.name === "scale-convert") {
    view.innerHTML = renderScaleConvert(route.id);
    wireScaleConvert(route.id);
  } else if (route.name === "allergen") {
    view.innerHTML = renderAllergen(route.id);
    wireAllergen(route.id);
  } else if (route.name === "temp") {
    view.innerHTML = renderTemp();
    wireTemp();
  } else {
    const r = routes[route.name] || routes["#/home"];
    view.innerHTML = r.render();
    if (r.wire) r.wire();
  }

  wireGlobalClicks();
}

function wireGlobalClicks() {
  document.querySelectorAll("[data-route]").forEach((n) => {
    n.addEventListener("click", () => { location.hash = n.getAttribute("data-route"); });
  });
  document.querySelectorAll("[data-open-recipe]").forEach((n) => {
    n.addEventListener("click", () => { location.hash = "#/recipe/edit/" + n.getAttribute("data-open-recipe"); });
  });
  document.querySelectorAll("[data-pick-recipe]").forEach((n) => {
    n.addEventListener("click", () => {
      location.hash = n.getAttribute("data-route-prefix") + n.getAttribute("data-pick-recipe");
    });
  });
  const newBtn = document.getElementById("new-recipe-btn");
  if (newBtn) newBtn.addEventListener("click", () => { location.hash = "#/recipe/new"; });
  const backBtn = document.getElementById("back-btn");
  if (backBtn) backBtn.addEventListener("click", () => { location.hash = backBtn.getAttribute("data-back-route") || "#/home"; });
}

// Re-render the current view when sign-in state changes or cloud recipes
// update (e.g. a save from another device) — only for views whose content
// actually depends on that data, so e.g. the Temperature Converter doesn't
// needlessly reset mid-typing.
function refreshIfRelevant(routeNames) {
  if (routeNames.includes(currentRoute().name)) render();
}

// Swaps the topbar's person icon for the signed-in user's own profile
// picture (if they've set one), or back to the plain icon when signed out.
function updateProfileButton() {
  const btn = document.getElementById("profile-btn");
  const user = hasCloud() ? window.MG.getCurrentUser() : null;
  btn.innerHTML = user && user.avatar
    ? `<img class="avatar-img" src="${user.avatar}" alt="Your profile">`
    : ICONS.person;
}

window.addEventListener("mg-auth-changed", () => {
  updateProfileButton();
  refreshIfRelevant(["#/profile", "#/recipes", "recipe-category", "scale-convert", "allergen"]);
});
window.addEventListener("mg-recipes-changed", () => refreshIfRelevant(["#/recipes", "recipe-category", "scale-convert", "allergen", "#/profile"]));

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("brand-home-btn").innerHTML = `<img src="data:image/png;base64,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" alt="" class="brand-mark"> <span>Mała Gospodyni</span>`;
  updateProfileButton();
  document.getElementById("brand-home-btn").addEventListener("click", () => { location.hash = "#/home"; });
  document.getElementById("profile-btn").addEventListener("click", () => { location.hash = "#/profile"; });
  if (!location.hash) location.hash = "#/home";
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker registration failed", e));
  }
});
