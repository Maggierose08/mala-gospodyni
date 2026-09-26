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
};

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

function pageHeader(title) {
  return `<div class="page-header">
    <button class="back-btn" id="back-btn" title="Back to Home">←</button>
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
    </div>
    <div class="quick-links">
      <div class="quick-link" data-route="#/community">${ICONS.book} Community Recipes</div>
      <div class="quick-link" data-route="#/substitutions">${ICONS.swap} Substitution Tips</div>
    </div>
  `;
}

// ---------- View: Recipes list ----------
function renderRecipesList() {
  const recipes = getRecipes();
  const rows = recipes.length
    ? recipes.map((r) => `
        <div class="recipe-card" data-open-recipe="${r.id}">
          <div>
            <div class="rc-title">${escapeHtml(r.title || "(untitled recipe)")}</div>
            <div class="rc-meta">${r.servings || "?"} servings · ${(r.ingredients || []).length} ingredients</div>
          </div>
          <span>›</span>
        </div>`).join("")
    : `<p class="muted-msg">No recipes saved yet — add your first one below.</p>`;

  const syncNote = isSignedIn()
    ? `<p class="hint">☁ Synced to your account — these recipes follow you to any device you sign into.</p>`
    : `<p class="hint">💾 Saved on this device only. <a href="#/profile">Sign in</a> to sync recipes across your phone and computer.</p>`;

  return `
    ${pageHeader("Recipes")}
    ${syncNote}
    ${rows}
    <div class="recipe-actions">
      <button class="btn" id="new-recipe-btn">+ New Recipe</button>
    </div>
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

function addIngredientRow(container, qty, unit, name) {
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
  removeBtn.addEventListener("click", () => row.remove());

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

// ---------- View: Scale Converter ----------
function renderScale(id) {
  const recipe = id ? getRecipe(id) : null;
  let body = pageHeader("Scale Converter") + renderRecipePicker(id, "#/scale/");
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

function wireScale(id) {
  const recipe = id ? getRecipe(id) : null;
  if (!recipe) return;
  const targetInput = document.getElementById("target-servings");
  const output = document.getElementById("scale-output");

  function recompute() {
    const target = parseFloat(targetInput.value);
    output.innerHTML = "";
    for (const item of recipe.ingredients || []) {
      const scaled = scaleQty(item.qty, recipe.servings, isNaN(target) ? 0 : target);
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
    if (!(recipe.ingredients || []).length) {
      output.innerHTML = '<p class="muted-msg">This recipe has no ingredients yet.</p>';
    }
  }

  targetInput.addEventListener("input", recompute);
  recompute();
}

// ---------- View: Allergen Checker ----------
function renderAllergen(id) {
  const recipe = id ? getRecipe(id) : null;
  let body = pageHeader("Allergen Checker") + renderRecipePicker(id, "#/allergen/");
  if (recipe) {
    body += `
      <div class="card">
        <h2>${escapeHtml(recipe.title)}</h2>
        <p class="hint">Select the categories you need to avoid, then check.</p>
        <div class="allergen-checks">
          <label><input type="checkbox" class="allergen-chk" value="dairy"> Dairy</label>
          <label><input type="checkbox" class="allergen-chk" value="egg"> Egg</label>
          <label><input type="checkbox" class="allergen-chk" value="gluten"> Gluten</label>
          <label><input type="checkbox" class="allergen-chk" value="nuts"> Nuts</label>
          <label><input type="checkbox" class="allergen-chk" value="soy"> Soy</label>
        </div>
        <div class="recipe-actions">
          <button class="btn" id="check-allergens-btn">Check My Recipe</button>
        </div>
        <div id="allergen-results" style="margin-top:14px;"></div>
        <div class="disclaimer">
          <strong>Please note:</strong> these are general cooking substitution ideas and approximate ratios only —
          a starting point to adjust by taste and texture, not verified medical or allergy-safety advice. Product
          formulations change, and cross-contamination is a real risk. If you or someone you're cooking for has a
          serious allergy, always check ingredient labels yourself and consult a doctor or allergist — do not rely
          on this tool for safety decisions.
        </div>
      </div>
    `;
  }
  return body;
}

function wireAllergen(id) {
  const recipe = id ? getRecipe(id) : null;
  if (!recipe) return;
  document.getElementById("check-allergens-btn").addEventListener("click", () => {
    const selected = Array.from(document.querySelectorAll(".allergen-chk:checked")).map((c) => c.value);
    const resultsDiv = document.getElementById("allergen-results");
    if (!selected.length) {
      resultsDiv.innerHTML = '<p class="muted-msg">Select at least one category above, then check again.</p>';
      return;
    }
    const names = (recipe.ingredients || []).map((i) => i.name).filter((n) => n && n.trim());
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

// ---------- View: Temperature Converter ----------
function renderTemp() {
  return `
    ${pageHeader("Temperature Converter")}
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
  const tempF = document.getElementById("temp-f");
  const tempC = document.getElementById("temp-c");
  tempF.addEventListener("input", () => {
    if (tempF.value === "") { tempC.value = ""; return; }
    const f = parseFloat(tempF.value);
    if (!isNaN(f)) tempC.value = fmtNum(fToC(f));
  });
  tempC.addEventListener("input", () => {
    if (tempC.value === "") { tempF.value = ""; return; }
    const c = parseFloat(tempC.value);
    if (!isNaN(c)) tempF.value = fmtNum(cToF(c));
  });

  const elevationInput = document.getElementById("elevation-ft");
  const altResult = document.getElementById("altitude-result");
  elevationInput.addEventListener("input", () => {
    const ft = parseFloat(elevationInput.value);
    if (elevationInput.value === "" || isNaN(ft)) { altResult.textContent = ""; return; }
    altResult.textContent = altitudeAdjustment(ft).message;
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
        <p class="hint">👤 <strong>${escapeHtml(user.username || user.email)}</strong><br>${escapeHtml(user.email)}</p>
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
      `}
      <p class="hint">Signing in lets your recipes follow you to any phone or computer. Without an account, recipes stay saved on this device only.</p>
    </div>
  `;
}

function wireProfile() {
  if (hasCloud() && isSignedIn()) {
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

  const signupBtn = document.getElementById("signup-btn");
  if (signupBtn) {
    signupBtn.addEventListener("click", async () => {
      const username = document.getElementById("signup-username").value.trim();
      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;
      if (!username || !email || !password) { profileError = "Please fill in a username, email, and password."; render(); return; }
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
  "#/community": { render: () => renderStub("Community Recipes", "this arrives in Phase 3, alongside moderation and the premium tier.") },
  "#/substitutions": { render: () => renderStub("Substitution Tips", "this arrives in Phase 3, alongside moderation and the premium tier.") },
};

function currentRoute() {
  const hash = location.hash || "#/home";
  const parts = hash.split("/");
  if (hash.startsWith("#/recipe/edit/")) return { name: "edit-recipe", id: parts[3] };
  if (hash.startsWith("#/scale/")) return { name: "scale", id: parts[2] };
  if (hash === "#/scale") return { name: "scale", id: null };
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
  } else if (route.name === "scale") {
    view.innerHTML = renderScale(route.id);
    wireScale(route.id);
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
  if (backBtn) backBtn.addEventListener("click", () => { location.hash = "#/home"; });
}

// Re-render the current view when sign-in state changes or cloud recipes
// update (e.g. a save from another device) — only for views whose content
// actually depends on that data, so e.g. the Temperature Converter doesn't
// needlessly reset mid-typing.
function refreshIfRelevant(routeNames) {
  if (routeNames.includes(currentRoute().name)) render();
}
window.addEventListener("mg-auth-changed", () => refreshIfRelevant(["#/profile", "#/recipes", "scale", "allergen"]));
window.addEventListener("mg-recipes-changed", () => refreshIfRelevant(["#/recipes", "scale", "allergen", "#/profile"]));

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("brand-home-btn").innerHTML = `${ICONS.pot} <span>Mała Gospodyni</span>`;
  document.getElementById("profile-btn").innerHTML = ICONS.person;
  document.getElementById("brand-home-btn").addEventListener("click", () => { location.hash = "#/home"; });
  document.getElementById("profile-btn").addEventListener("click", () => { location.hash = "#/profile"; });
  if (!location.hash) location.hash = "#/home";
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Service worker registration failed", e));
  }
});
