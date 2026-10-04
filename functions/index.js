// ============================================================
// Cloud Functions for Mała Gospodyni.
//
// Currently holds exactly one function: a welcome email that fires once,
// automatically, the moment someone creates an account -- separate from
// (and in addition to) Firebase Auth's own built-in verification/
// password-reset emails, which already work without any of this and are
// NOT touched by anything here.
//
// STATUS: NOT DEPLOYED / NOT LIVE. This is written and ready, but nothing
// in this folder has been pushed to Firebase yet, and the function also
// has its own built-in off-switch (PREMIUM_EMAIL_ENABLED below) so that
// even after it IS deployed, it stays a no-op until that's deliberately
// turned on -- see functions/README.md for the full go-live checklist
// (Blaze billing, a Resend account + verified sending domain, setting the
// real environment variables, then `firebase deploy --only functions`).
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { buildPremiumWelcomeEmail } = require("./premiumWelcomeEmail");

admin.initializeApp();

// Cloud Functions loads a project's `.env.<project-id>` file (or whatever
// real environment variables are configured) into process.env automatically
// -- see functions/.env.example for what each of these means and how to
// set them for real. Intentionally NOT using the older `functions.config()`
// API, which Firebase has been moving projects away from.
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "";
// Resend only SENDS mail -- the "from" address above doesn't come with an
// inbox, so unless that address separately has real mailbox hosting behind
// it, a reply to it just bounces or vanishes. Setting this tells people's
// mail clients to route "Reply" to an inbox that actually exists (e.g.
// Maggie's own address) instead, regardless of what "from" shows. See the
// "Where replies go" section in functions/README.md.
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO || "";
const PREMIUM_EMAIL_ENABLED = process.env.PREMIUM_EMAIL_ENABLED === "true";

async function sendViaResend({ to, subject, html, text }) {
  const body = { from: RESEND_FROM_ADDRESS, to: [to], subject, html, text };
  if (RESEND_REPLY_TO) body.reply_to = RESEND_REPLY_TO;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${errBody}`);
  }
}

// Looks up the username the person chose at signup, for a friendlier
// greeting. This can legitimately come back empty: the client-side signup
// flow (js/firebase-init.js signUp()) creates the Auth account FIRST and
// only claims the username a moment later in a separate call, so this
// trigger can fire before that write has landed. One short retry covers
// the common case without turning this into a long-running function;
// premiumWelcomeEmail.js already reads fine with no name at all.
async function lookupUsername(uid) {
  for (const delayMs of [0, 2000]) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const snap = await admin.firestore().collection("users").doc(uid).get();
    if (snap.exists && snap.data().username) return snap.data().username;
  }
  return "";
}

// 1st-gen Auth trigger (there is deliberately no 2nd-gen equivalent for
// "run something after a user is created" -- 2nd-gen's Auth hooks only
// cover BEFORE create/sign-in, via Identity Platform blocking functions,
// which is a different thing). Fires once per new account, for whichever
// sign-up method was used (today that's only email/password).
//
// No automatic retries are configured, intentionally: if sending fails,
// it fails -- it does not retry and potentially double-send. That fits
// "the user should get at most one of these" better than a retry would.
exports.sendPremiumWelcomeEmail = functions.auth.user().onCreate(async (user) => {
  if (!PREMIUM_EMAIL_ENABLED) {
    functions.logger.info("Premium welcome email is disabled (PREMIUM_EMAIL_ENABLED is not \"true\") -- skipping.", { uid: user.uid });
    return;
  }
  if (!RESEND_API_KEY || !RESEND_FROM_ADDRESS) {
    functions.logger.error("Premium welcome email is enabled but RESEND_API_KEY / RESEND_FROM_ADDRESS isn't configured -- skipping.", { uid: user.uid });
    return;
  }
  // The email text says "just reply to this email" -- that's only true if
  // replies actually land somewhere. Treat a missing reply-to the same as
  // missing the other required config, rather than silently sending an
  // email that promises something that won't work.
  if (!RESEND_REPLY_TO) {
    functions.logger.error("Premium welcome email is enabled but RESEND_REPLY_TO isn't set, so replies would go nowhere -- skipping.", { uid: user.uid });
    return;
  }
  if (!user.email) {
    functions.logger.info("New user has no email address on file -- skipping welcome email.", { uid: user.uid });
    return;
  }

  const username = await lookupUsername(user.uid).catch((err) => {
    functions.logger.error("Could not look up username for welcome email, continuing without it", err);
    return "";
  });

  const { subject, html, text } = buildPremiumWelcomeEmail({ username });

  try {
    await sendViaResend({ to: user.email, subject, html, text });
    functions.logger.info("Sent premium welcome email", { uid: user.uid });
  } catch (err) {
    functions.logger.error("Failed to send premium welcome email", { uid: user.uid, error: String(err) });
  }
});
