// ============================================================
// Mała Gospodyni — Firebase bridge (Phase 2: accounts + cross-device sync).
//
// This is an ES module (loaded via <script type="module">), so it can use
// modern `import` syntax straight from Firebase's CDN — no build step needed.
// The rest of the app (logic.js, app.js) is plain, non-module script, so
// this file exposes what they need on `window.MG` plus two events:
//   "mg-auth-changed"    — fired whenever sign-in state changes
//   "mg-recipes-changed" — fired whenever the signed-in user's cloud
//                          recipes are updated (by this device or another)
// ============================================================

import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache,
  doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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
let resolveReady;
const ready = new Promise((resolve) => { resolveReady = resolve; });

function dispatch(name, detail) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function recipeDocRef(uid, recipeId) {
  return doc(db, "users", uid, "recipes", recipeId);
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

onAuthStateChanged(auth, async (user) => {
  if (recipesUnsubscribe) { recipesUnsubscribe(); recipesUnsubscribe = null; }
  cloudRecipes = [];

  if (user) {
    let username = user.displayName || "";
    let contactInfo = "";
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        username = userSnap.data().username || username;
        contactInfo = userSnap.data().contactInfo || "";
      }
    } catch (e) {
      console.error("Could not load profile", e);
    }
    currentUser = { uid: user.uid, email: user.email, username, contactInfo };
    subscribeToRecipes(user.uid);
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
async function claimUsername(uid, email, username) {
  const clean = username.trim();
  if (clean.length < 3) throw new Error("Username needs to be at least 3 characters.");
  if (!/^[A-Za-z0-9_.-]+$/.test(clean)) throw new Error("Username can only use letters, numbers, and _ . -");
  const key = clean.toLowerCase();
  const usernameRef = doc(db, "usernames", key);
  const userRef = doc(db, "users", uid);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(usernameRef);
    if (existing.exists()) throw new Error("That username is already taken — try another.");
    tx.set(usernameRef, { uid });
    tx.set(userRef, { username: clean, email, contactInfo: "", createdAt: serverTimestamp() });
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

  saveContactInfo: async (contactInfo) => {
    if (!currentUser) throw new Error("Not signed in.");
    await setDoc(doc(db, "users", currentUser.uid), { contactInfo }, { merge: true });
    currentUser.contactInfo = contactInfo;
  },

  upsertRecipe: async (recipe) => {
    if (!currentUser) throw new Error("Not signed in.");
    await setDoc(recipeDocRef(currentUser.uid, recipe.id), {
      title: recipe.title,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
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
        updatedAt: serverTimestamp(),
      });
    }
  },
};
