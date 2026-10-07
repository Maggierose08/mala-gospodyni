// ============================================================
// Mała Gospodyni — Firebase bridge (Phase 2: accounts + cross-device sync).
//
// This is an ES module (loaded via <script type="module">), so it can use
// modern `import` syntax straight from Firebase's CDN — no build step needed.
// The rest of the app (logic.js, app.js) is plain, non-module script, so
// this file exposes what they need on `window.MG` plus two events:
//   "mg-auth-changed"      — fired whenever sign-in state changes
//   "mg-recipes-changed"   — fired whenever the signed-in user's cloud
//                            recipes are updated (by this device or another)
//   "mg-meal-plan-changed" — fired whenever the signed-in user's cloud
//                            meal plan is updated (by this device or another)
// ============================================================

import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  updateProfile, sendPasswordResetEmail, sendEmailVerification,
  deleteUser, reauthenticateWithCredential, EmailAuthProvider,
  verifyBeforeUpdateEmail,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache,
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, onSnapshot, runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// The one account allowed to grant free ("comped") access to friends &
// family, and to see the full list of who currently has it. This is only
// a convenience check for the UI (so the admin panel doesn't render for
// anyone else) — the real enforcement lives entirely in the Firestore
// security rules, which check this same email server-side on every single
// read/write to the "grants" collection. Changing this constant here does
// NOT grant anyone anything; only publishing matching security rules does.
const ADMIN_EMAIL = "malagospodyni@gmail.com";

const firebaseConfig = {
  apiKey: "AIzaSyD29WcDaRhoxUmPWXx_aOQlYtfYC2IUHKs",
  authDomain: "mala-gospodyni.firebaseapp.com",
  projectId: "mala-gospodyni",
  storageBucket: "mala-gospodyni.firebasestorage.app",
  messagingSenderId: "887852993313",
  appId: "1:887852993313:web:c376beea0be9bba3a38c60",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Offline persistence: recipes stay readable/editable without a connection
// and sync up once it's back, same spirit as the rest of the PWA.
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

let currentUser = null; // { uid, email, username } | null
let cloudRecipes = [];
let recipesUnsubscribe = null;
let cloudMealPlan = {}; // { "<yyyy-mm-dd>": "<recipeId>", ... }
let mealPlanUnsubscribe = null;
let resolveReady;
const ready = new Promise((resolve) => { resolveReady = resolve; });

function dispatch(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function recipeDocRef(uid, recipeId) {
  return doc(db, "users", uid, "recipes", recipeId);
}

// A user's own meal plan: one doc per calendar day, holding the recipe
// planned for it -- same shape/rules as their private recipes, just a
// separate subcollection so the two lists never mix.
function mealPlanDocRef(uid, date) {
  return doc(db, "users", uid, "mealPlan", date);
}

// A shared/public copy of a recipe lives in its own top-level collection
// (not nested under the owning user, since anyone needs to be able to read
// it) with a deterministic id, so re-sharing an already-shared recipe
// updates the same doc instead of creating a duplicate.
function communityDocId(uid, recipeId) {
  return uid + "_" + recipeId;
}
function communityDocRef(uid, recipeId) {
  return doc(db, "communityRecipes", communityDocId(uid, recipeId));
}

// A small, PUBLIC mirror of just {username, avatar} for each account -- kept
// in sync whenever either one changes (see claimUsername / changeUsername /
// saveAvatar below). Lets any signed-in user look a friend up by username
// (for Friends & Family sharing) without being able to read their email or
// contact info, which stay locked to "users/{uid}" (own account + admin only).
function publicProfileRef(uid) {
  return doc(db, "publicProfiles", uid);
}

// A lowercased-email -> uid index, the same shape and purpose as
// "usernames" below, so Friends & Family lookup can find someone by either
// their username or their email. Kept in sync at signup (claimUsername)
// and self-healed for any account that doesn't have one yet (accounts
// created before this existed) by ensureEmailLookup, called once per
// sign-in below.
function emailLookupRef(email) {
  return doc(db, "emailLookup", (email || "").trim().toLowerCase());
}

async function ensureEmailLookup(user) {
  if (!user.email) return;
  try {
    const ref = emailLookupRef(user.email);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().uid !== user.uid) {
      await setDoc(ref, { uid: user.uid });
    }
  } catch (e) {
    console.error("Could not sync email lookup", e);
  }
}

// Keeps users/{uid}.email in sync if the account's real sign-in email ever
// changes after signup (e.g. via MG.changeEmail) -- that field is only ever
// written once, at signup, so without this it would silently go stale.
// Also retires the OLD email's "emailLookup" entry so Friends & Family can
// no longer find this account under an email it doesn't use anymore;
// ensureEmailLookup (called alongside this) takes care of creating the
// entry for the new email. Fire-and-forget, same pattern as that function.
async function syncAccountEmailIfChanged(uid, oldEmail, newEmail) {
  if (!newEmail || oldEmail === newEmail) return;
  try {
    await setDoc(doc(db, "users", uid), { email: newEmail }, { merge: true });
  } catch (e) {
    console.error("Could not update stored email", e);
  }
  if (oldEmail) {
    try {
      const oldRef = emailLookupRef(oldEmail);
      const snap = await getDoc(oldRef);
      if (snap.exists() && snap.data().uid === uid) {
        await deleteDoc(oldRef);
      }
    } catch (e) {
      console.error("Could not clean up old email lookup", e);
    }
  }
}

function subscribeToRecipes(uid) {
  if (recipesUnsubscribe) recipesUnsubscribe();
  recipesUnsubscribe = onSnapshot(
    collection(db, "users", uid, "recipes"),
    (snap) => {
      cloudRecipes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      dispatch("mg-recipes-changed", { recipes: cloudRecipes });
    },
    (err) => {
      console.error("Recipe sync error", err);
    }
  );
}

function subscribeToMealPlan(uid) {
  if (mealPlanUnsubscribe) mealPlanUnsubscribe();
  mealPlanUnsubscribe = onSnapshot(
    collection(db, "users", uid, "mealPlan"),
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = d.data().recipeId; });
      cloudMealPlan = map;
      dispatch("mg-meal-plan-changed", { mealPlan: cloudMealPlan });
    },
    (err) => {
      console.error("Meal plan sync error", err);
    }
  );
}

onAuthStateChanged(auth, async (user) => {
  if (recipesUnsubscribe) { recipesUnsubscribe(); recipesUnsubscribe = null; }
  if (mealPlanUnsubscribe) { mealPlanUnsubscribe(); mealPlanUnsubscribe = null; }
  cloudRecipes = [];
  cloudMealPlan = {};

  if (user) {
    let username = user.displayName || "";
    let contactInfo = "";
    let avatar = "";
    let storedEmail = "";
    const isAdmin = user.email === ADMIN_EMAIL;
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        username = userSnap.data().username || username;
        contactInfo = userSnap.data().contactInfo || "";
        avatar = userSnap.data().avatar || "";
        storedEmail = userSnap.data().email || "";
      }
    } catch (e) {
      console.error("Could not load profile", e);
    }
    // Free ("comped") access for friends & family: the admin account always
    // has it; anyone else only has it if a "grants/{uid}" document exists
    // for them — which only the admin account can ever create (enforced by
    // the Firestore security rules, not by this check).
    let hasFreeAccess = isAdmin;
    if (!isAdmin) {
      try {
        const grantSnap = await getDoc(doc(db, "grants", user.uid));
        hasFreeAccess = grantSnap.exists() && grantSnap.data().granted === true;
      } catch (e) {
        console.error("Could not check free-access status", e);
      }
    }
    currentUser = { uid: user.uid, email: user.email, username, contactInfo, avatar, isAdmin, hasFreeAccess, emailVerified: user.emailVerified };
    subscribeToRecipes(user.uid);
    subscribeToMealPlan(user.uid);
    // Fire-and-forget (errors are caught inside) -- doesn't need to block
    // sign-in finishing, it just needs to happen eventually.
    ensureEmailLookup(user);
    syncAccountEmailIfChanged(user.uid, storedEmail, user.email);
  } else {
    currentUser = null;
  }

  dispatch("mg-auth-changed", { user: currentUser });
  if (resolveReady) { resolveReady(); resolveReady = null; }
});

// ---------- Username <-> uid, enforced unique via a transaction ----------
// The "usernames" collection's document id IS the (lowercased) username, so
// two people racing to claim the same one is resolved atomically by
// Firestore serializing the transaction — the second one simply fails.
function validateUsername(raw) {
  const clean = (raw || "").trim();
  if (clean.length < 3) throw new Error("Username needs to be at least 3 characters.");
  if (!/^[A-Za-z0-9_.-]+$/.test(clean)) throw new Error("Username can only use letters, numbers, and _ . -");
  return clean;
}

async function claimUsername(uid, email, username) {
  const clean = validateUsername(username);
  const key = clean.toLowerCase();
  const usernameRef = doc(db, "usernames", key);
  const userRef = doc(db, "users", uid);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(usernameRef);
    if (existing.exists()) throw new Error("That username is already taken — try another.");
    tx.set(usernameRef, { uid });
    tx.set(userRef, { username: clean, email, contactInfo: "", createdAt: serverTimestamp() });
    tx.set(publicProfileRef(uid), { username: clean, avatar: "" });
    tx.set(emailLookupRef(email), { uid });
  });
  return clean;
}

function friendlyAuthError(err) {
  const code = err && err.code;
  const map = {
    "auth/email-already-in-use": "That email already has an account — try signing in instead.",
    "auth/invalid-email": "That doesn't look like a valid email address.",
    "auth/weak-password": "Password needs to be at least 6 characters.",
    "auth/invalid-credential": "That email/password combination isn't right.",
    "auth/wrong-password": "That email/password combination isn't right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/too-many-requests": "Too many tries — please wait a bit and try again.",
    "auth/network-request-failed": "Couldn't reach the server — check your connection and try again.",
  };
  return map[code] || (err && err.message) || "Something went wrong. Please try again.";
}

window.MG = {
  ready,
  getCurrentUser: () => currentUser,
  getCloudRecipes: () => cloudRecipes,
  getCloudMealPlan: () => cloudMealPlan,
  isAdmin: () => !!(currentUser && currentUser.isAdmin),
  hasFreeAccess: () => !!(currentUser && currentUser.hasFreeAccess),

  signUp: async (email, password, username) => {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
    try {
      const cleanUsername = await claimUsername(cred.user.uid, email, username);
      await updateProfile(cred.user, { displayName: cleanUsername });
    } catch (err) {
      // Username claim failed after the account was created — the account
      // still exists, so surface the specific error rather than a generic one.
      throw new Error(err.message || "Could not finish setting up your account.");
    }
    // Best-effort: not being able to send this shouldn't block account
    // creation -- the Profile page also offers a "Resend" button for later.
    try {
      await sendEmailVerification(cred.user);
    } catch (err) {
      console.error("Could not send verification email", err);
    }
  },

  signIn: async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  },

  signOutUser: async () => {
    await signOut(auth);
  },

  // Firebase never stores or exposes the actual password (only a one-way
  // hash), so "recovering" it isn't possible for anyone, including us —
  // this sends an email with a link to set a new one instead.
  resetPassword: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  },

  saveContactInfo: async (contactInfo) => {
    if (!currentUser) throw new Error("Not signed in.");
    await setDoc(doc(db, "users", currentUser.uid), { contactInfo }, { merge: true });
    currentUser.contactInfo = contactInfo;
  },

  // Changing your username frees up the old one (so someone else could
  // claim it) and atomically claims the new one — same uniqueness guarantee
  // as signing up. Firestore's own rules only let a "usernames" mapping be
  // deleted by the uid it was created for, so this can never free up or
  // hijack someone else's username no matter what a client sends.
  changeUsername: async (newUsername) => {
    if (!currentUser) throw new Error("Not signed in.");
    const clean = validateUsername(newUsername);
    const newKey = clean.toLowerCase();
    const oldKey = (currentUser.username || "").toLowerCase();
    if (newKey === oldKey) return clean;
    const newRef = doc(db, "usernames", newKey);
    const oldRef = oldKey ? doc(db, "usernames", oldKey) : null;
    const userRef = doc(db, "users", currentUser.uid);
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(newRef);
      if (existing.exists()) throw new Error("That username is already taken — try another.");
      if (oldRef) tx.delete(oldRef);
      tx.set(newRef, { uid: currentUser.uid });
      tx.set(userRef, { username: clean }, { merge: true });
      tx.set(publicProfileRef(currentUser.uid), { username: clean }, { merge: true });
    });
    try {
      await updateProfile(auth.currentUser, { displayName: clean });
    } catch (e) {
      console.error("Could not update auth display name", e);
    }
    currentUser.username = clean;
    dispatch("mg-auth-changed", { user: currentUser });
    return clean;
  },

  saveAvatar: async (dataUrl) => {
    if (!currentUser) throw new Error("Not signed in.");
    await setDoc(doc(db, "users", currentUser.uid), { avatar: dataUrl }, { merge: true });
    await setDoc(publicProfileRef(currentUser.uid), { avatar: dataUrl }, { merge: true });
    currentUser.avatar = dataUrl;
    dispatch("mg-auth-changed", { user: currentUser });
  },

  // ---- Email verification ----
  resendVerificationEmail: async () => {
    if (!auth.currentUser) throw new Error("Not signed in.");
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
  },

  // Firebase's local user object only reflects verification status as of
  // the last sign-in/token refresh -- reload() re-checks with the server.
  // Only dispatches "mg-auth-changed" when the value actually changed, so
  // calling this on every Profile visit (see app.js) can't turn into a
  // render loop.
  refreshEmailVerified: async () => {
    if (!auth.currentUser || !currentUser) return;
    await auth.currentUser.reload();
    const nowVerified = auth.currentUser.emailVerified;
    if (currentUser.emailVerified !== nowVerified) {
      currentUser.emailVerified = nowVerified;
      dispatch("mg-auth-changed", { user: currentUser });
    }
  },

  // ---- Change the account's sign-in email ----
  // The Firebase console no longer offers a direct "edit email" option (for
  // security reasons), so this is the supported replacement: it re-checks
  // the password, then sends a confirmation LINK to the NEW address. The
  // sign-in email doesn't actually change until that link is opened and
  // clicked FROM THE NEW ADDRESS's inbox -- this account's old email stays
  // the valid sign-in email until then, so nothing breaks if the link is
  // never clicked. Not wired to any UI button yet -- call it from the
  // browser console as window.MG.changeEmail(newEmail, currentPassword)
  // while signed in as the account whose email is changing.
  changeEmail: async (newEmail, password) => {
    if (!currentUser || !auth.currentUser) throw new Error("Not signed in.");
    const clean = (newEmail || "").trim().toLowerCase();
    if (!clean || !clean.includes("@")) throw new Error("Please enter a valid email address.");
    try {
      const cred = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await verifyBeforeUpdateEmail(auth.currentUser, clean);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }
    return `Confirmation link sent to ${clean}. Open it from that inbox to finish changing the sign-in email.`;
  },

  // ---- Friends & family free access (admin-only; enforced by security rules) ----

  // Looks an account up by username WITHOUT granting anything, so the admin
  // can see who they'd actually be granting access to (avatar, username,
  // contact info) before committing -- usernames are easy to mistype or
  // confuse with a similarly-named account, and this is the only visual
  // check before free access is handed out.
  lookupUserForGrant: async (username) => {
    if (!currentUser || !currentUser.isAdmin) throw new Error("Only the app owner can look up an account.");
    const key = (username || "").trim().toLowerCase();
    if (!key) throw new Error("Please enter a username.");
    const usernameSnap = await getDoc(doc(db, "usernames", key));
    if (!usernameSnap.exists()) throw new Error("No account found with that username.");
    const uid = usernameSnap.data().uid;
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) throw new Error("That account's profile couldn't be found.");
    const data = userSnap.data();
    return {
      uid,
      username: data.username || username.trim(),
      avatar: data.avatar || "",
      email: data.email || "",
      contactInfo: data.contactInfo || "",
    };
  },

  grantFriendAccess: async (username) => {
    if (!currentUser || !currentUser.isAdmin) throw new Error("Only the app owner can grant free access.");
    const key = username.trim().toLowerCase();
    if (!key) throw new Error("Please enter a username.");
    const usernameSnap = await getDoc(doc(db, "usernames", key));
    if (!usernameSnap.exists()) throw new Error("No account found with that username.");
    const friendUid = usernameSnap.data().uid;
    await setDoc(doc(db, "grants", friendUid), {
      granted: true,
      grantedTo: username.trim(),
      grantedAt: serverTimestamp(),
    });
    return username.trim();
  },

  revokeFriendAccess: async (uid) => {
    if (!currentUser || !currentUser.isAdmin) throw new Error("Only the app owner can change free access.");
    await deleteDoc(doc(db, "grants", uid));
  },

  listGrants: async () => {
    if (!currentUser || !currentUser.isAdmin) throw new Error("Only the app owner can view this.");
    const snap = await getDocs(collection(db, "grants"));
    const grants = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    // Best-effort: also pull each grantee's current profile, so the list
    // shows their avatar and up-to-date username (not just whatever name
    // was typed in at grant time, which goes stale if they rename later).
    // If this fails (e.g. the security rules haven't been updated yet),
    // the list still renders fine using grantedTo as a fallback.
    await Promise.all(grants.map(async (g) => {
      try {
        const userSnap = await getDoc(doc(db, "users", g.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          g.avatar = data.avatar || "";
          g.username = data.username || g.grantedTo;
        }
      } catch (e) {
        // Fall back silently to grantedTo/no-avatar, handled by the caller.
      }
    }));
    return grants;
  },

  upsertRecipe: async (recipe) => {
    if (!currentUser) throw new Error("Not signed in.");
    await setDoc(recipeDocRef(currentUser.uid, recipe.id), {
      title: recipe.title,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      category: recipe.category || null,
      shared: !!recipe.shared,
      photo: recipe.photo || "",
      updatedAt: serverTimestamp(),
    });
  },

  deleteRecipeCloud: async (recipeId) => {
    if (!currentUser) throw new Error("Not signed in.");
    await deleteDoc(recipeDocRef(currentUser.uid, recipeId));
  },

  migrateLocalToCloud: async (localRecipes) => {
    if (!currentUser) throw new Error("Not signed in.");
    for (const r of localRecipes) {
      await setDoc(recipeDocRef(currentUser.uid, r.id), {
        title: r.title,
        servings: r.servings,
        ingredients: r.ingredients,
        steps: r.steps,
        category: r.category || null,
        shared: !!r.shared,
        photo: r.photo || "",
        updatedAt: serverTimestamp(),
      });
    }
  },

  upsertMealPlanEntry: async (date, recipeId) => {
    if (!currentUser) throw new Error("Not signed in.");
    await setDoc(mealPlanDocRef(currentUser.uid, date), {
      recipeId,
      updatedAt: serverTimestamp(),
    });
  },

  deleteMealPlanEntryCloud: async (date) => {
    if (!currentUser) throw new Error("Not signed in.");
    await deleteDoc(mealPlanDocRef(currentUser.uid, date));
  },

  // ---- Community Recipes: a public, shared pool anyone can browse ----
  // Sharing publishes a copy of the recipe (not a reference), so editing or
  // deleting your private recipe later doesn't silently change or break
  // what other people already see — re-saving with "Share" still checked
  // re-publishes the latest version, and unchecking it (or deleting the
  // recipe) removes the public copy.
  shareToCommunity: async (recipe) => {
    if (!currentUser) throw new Error("Not signed in.");
    if (!currentUser.username) throw new Error("Please set a username on your Profile page before sharing.");
    await setDoc(communityDocRef(currentUser.uid, recipe.id), {
      title: recipe.title,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      category: recipe.category || null,
      photo: recipe.photo || "",
      authorUid: currentUser.uid,
      authorUsername: currentUser.username,
      sourceRecipeId: recipe.id,
      sharedAt: serverTimestamp(),
    });
  },

  unshareFromCommunity: async (recipeId) => {
    if (!currentUser) throw new Error("Not signed in.");
    await deleteDoc(communityDocRef(currentUser.uid, recipeId));
  },

  // A one-time fetch rather than a live subscription — the community pool
  // isn't needed anywhere except the Community Recipes page itself, and it
  // can grow large, so there's no reason to keep it synced in the
  // background for every signed-in (or signed-out) visitor.
  fetchCommunityRecipes: async () => {
    const snap = await getDocs(collection(db, "communityRecipes"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // Flags a community recipe for the admin (you) to look at manually in the
  // admin's own "Review Reports" screen (see listReports/dismissReport/
  // removeReportedRecipe below) rather than anyone else. Requires sign-in
  // so this can't be spammed anonymously.
  reportCommunityRecipe: async (communityRecipeId, reason) => {
    if (!currentUser) throw new Error("Please sign in to report a recipe.");
    await setDoc(doc(collection(db, "reports")), {
      communityRecipeId,
      reporterUid: currentUser.uid,
      reason: reason || "",
      createdAt: serverTimestamp(),
    });
  },

  // ---- Comments on a community recipe ----
  // A one-time fetch (like fetchCommunityRecipes above) rather than a live
  // subscription -- only needed while that one recipe's detail page is open.
  fetchComments: async (communityRecipeId) => {
    const snap = await getDocs(collection(db, "communityRecipes", communityRecipeId, "comments"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0));
  },

  postComment: async (communityRecipeId, text) => {
    if (!currentUser) throw new Error("Please sign in to comment.");
    if (!currentUser.username) throw new Error("Please set a username on your Profile page before commenting.");
    await setDoc(doc(collection(db, "communityRecipes", communityRecipeId, "comments")), {
      text,
      authorUid: currentUser.uid,
      authorUsername: currentUser.username,
      createdAt: serverTimestamp(),
    });
  },

  // Allowed for: the comment's own author, the recipe's author, or the
  // admin -- enforced server-side by the Firestore security rules, this is
  // just what decides whether the UI shows a delete button.
  deleteComment: async (communityRecipeId, commentId) => {
    if (!currentUser) throw new Error("Not signed in.");
    await deleteDoc(doc(db, "communityRecipes", communityRecipeId, "comments", commentId));
  },

  // ---- Admin: review reported Community Recipes ----
  listReports: async () => {
    if (!currentUser || !currentUser.isAdmin) throw new Error("Only the app owner can view this.");
    const snap = await getDocs(collection(db, "reports"));
    const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Best-effort: pull in the reported recipe's current title/author so the
    // list is readable at a glance; a recipe that's since been removed just
    // shows as unavailable rather than failing the whole list.
    await Promise.all(reports.map(async (r) => {
      try {
        const recSnap = await getDoc(doc(db, "communityRecipes", r.communityRecipeId));
        if (recSnap.exists()) {
          r.recipeTitle = recSnap.data().title;
          r.recipeAuthor = recSnap.data().authorUsername;
        } else {
          r.recipeTitle = "(already removed)";
        }
      } catch (e) {
        r.recipeTitle = "(unavailable)";
      }
    }));
    return reports;
  },

  // Clears a report without touching the recipe it was about -- for a
  // report that turns out to be a non-issue.
  dismissReport: async (reportId) => {
    if (!currentUser || !currentUser.isAdmin) throw new Error("Only the app owner can do this.");
    await deleteDoc(doc(db, "reports", reportId));
  },

  // Removes the reported recipe from the Community pool (its owner's
  // private copy is untouched) and clears the report that flagged it.
  removeReportedRecipe: async (communityRecipeId, reportId) => {
    if (!currentUser || !currentUser.isAdmin) throw new Error("Only the app owner can do this.");
    await deleteDoc(doc(db, "communityRecipes", communityRecipeId));
    await deleteDoc(doc(db, "reports", reportId));
  },

  // ---- Friends & Family: direct recipe sharing ----
  // Looks a friend up by either their username (via "usernames") or their
  // email (via "emailLookup") -- whichever the input looks like -- but
  // returns only what's in that account's public profile (username,
  // avatar) -- never their email or contact info, unlike the admin-only
  // lookupUserForGrant above. Any signed-in user can call this.
  lookupPublicProfile: async (identifier) => {
    if (!currentUser) throw new Error("Please sign in first.");
    const raw = (identifier || "").trim();
    if (!raw) throw new Error("Please enter a username or email.");
    const isEmail = raw.includes("@");
    const key = raw.toLowerCase();
    const indexSnap = await getDoc(doc(db, isEmail ? "emailLookup" : "usernames", key));
    if (!indexSnap.exists()) {
      throw new Error(isEmail ? "No account found with that email." : "No account found with that username.");
    }
    const uid = indexSnap.data().uid;
    if (uid === currentUser.uid) throw new Error(isEmail ? "That's your own email." : "That's your own username.");
    const pubSnap = await getDoc(publicProfileRef(uid));
    const data = pubSnap.exists() ? pubSnap.data() : {};
    return { uid, username: data.username || raw, avatar: data.avatar || "" };
  },

  // Drops a snapshot of the recipe (not a live reference) into the
  // recipient's own "sharedWithMe" inbox -- so it shows up for them even
  // though they can't read the sender's private recipes collection. They
  // choose whether to add it to their own recipes from there.
  shareRecipeToFriend: async (friendUid, recipe) => {
    if (!currentUser) throw new Error("Not signed in.");
    if (!friendUid) throw new Error("Couldn't find that person's account.");
    await setDoc(doc(collection(db, "users", friendUid, "sharedWithMe")), {
      recipe: {
        title: recipe.title,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        category: recipe.category || null,
        photo: recipe.photo || "",
      },
      fromUid: currentUser.uid,
      fromUsername: currentUser.username || "someone",
      sharedAt: serverTimestamp(),
    });
  },

  listSharedWithMe: async () => {
    if (!currentUser) throw new Error("Not signed in.");
    const snap = await getDocs(collection(db, "users", currentUser.uid, "sharedWithMe"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  // Removes an inbox item -- used both for "Dismiss" and after "Add to My
  // Recipes" has already copied it into the person's own recipes.
  dismissSharedItem: async (shareId) => {
    if (!currentUser) throw new Error("Not signed in.");
    await deleteDoc(doc(db, "users", currentUser.uid, "sharedWithMe", shareId));
  },

  // ---- Account deletion ----
  // Firebase requires a "recent" sign-in before it will let an account
  // delete itself, so this re-confirms the password first. Firestore
  // doesn't cascade deletes, so everything this account owns is cleaned up
  // by hand, in an order that can't strand anything the security rules
  // would then block: recipes/meal-plan/community copies (owned outright),
  // then the username, email-lookup, and public-profile mappings, then the
  // account's own profile document, and finally the Firebase Auth account
  // itself.
  // Known limitation: comments this account left on OTHER people's
  // community recipes, and a "grants/{uid}" free-access document from the
  // admin, are left behind (comments stay attributed to the old username;
  // a leftover grant is harmless since the account can no longer sign in
  // to use it, and the admin's Friends & Family panel can still revoke it).
  deleteAccount: async (password) => {
    if (!currentUser) throw new Error("Not signed in.");
    const user = auth.currentUser;
    try {
      const cred = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(user, cred);
    } catch (err) {
      throw new Error(friendlyAuthError(err));
    }

    const uid = currentUser.uid;
    try {
      for (const r of cloudRecipes) {
        await deleteDoc(recipeDocRef(uid, r.id));
        if (r.shared) {
          try { await deleteDoc(communityDocRef(uid, r.id)); } catch (e) { /* already gone */ }
        }
      }
      for (const date of Object.keys(cloudMealPlan)) {
        await deleteDoc(mealPlanDocRef(uid, date));
      }
      if (currentUser.username) {
        try { await deleteDoc(doc(db, "usernames", currentUser.username.toLowerCase())); } catch (e) { /* already gone */ }
      }
      if (currentUser.email) {
        try { await deleteDoc(emailLookupRef(currentUser.email)); } catch (e) { /* already gone */ }
      }
      try { await deleteDoc(publicProfileRef(uid)); } catch (e) { /* already gone */ }
      if (!currentUser.isAdmin) {
        try { await deleteDoc(doc(db, "grants", uid)); } catch (e) { /* no grant, or already gone */ }
      }
      await deleteDoc(doc(db, "users", uid));
    } catch (err) {
      throw new Error("Your password was correct, but something went wrong deleting your data: " + (err.message || err) + ". Please try again, or reach out for help.");
    }

    await deleteUser(user);
  },
};
