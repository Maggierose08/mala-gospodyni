// ============================================================
// Content for the ONE-TIME "welcome + here's what Premium includes" email.
// Kept in its own file, separate from the sending logic in index.js, so
// editing the wording never means touching the Cloud Function itself.
//
// STATUS: DRAFT. The three bullet points below are placeholders -- Maggie
// hasn't decided yet what's actually reserved for Premium (nothing in the
// app is paywalled today). Fill these in once that's decided, before this
// ever gets turned on (see PREMIUM_EMAIL_ENABLED in index.js / .env.example).
// ============================================================

const PREMIUM_FEATURES = [
  "PLACEHOLDER — e.g. unlimited saved recipes",
  "PLACEHOLDER — e.g. unlimited Recipe Creator / Scan-a-Recipe uses per month",
  "PLACEHOLDER — e.g. printable/exportable recipe collections",
];

// `username` may be missing (see the comment in index.js about why the
// signup trigger can fire before a username is claimed) -- the copy below
// is written to read naturally either way.
function buildPremiumWelcomeEmail({ username }) {
  const greeting = username ? `Hi ${username},` : "Hi,";
  const featureListHtml = PREMIUM_FEATURES.map((f) => `<li>${f}</li>`).join("");
  const featureListText = PREMIUM_FEATURES.map((f) => `- ${f}`).join("\n");

  const subject = "Welcome to Mała Gospodyni — plus a peek at what Premium unlocks";

  const html = `
    <div style="font-family: Georgia, 'Playfair Display', serif; max-width: 480px; margin: 0 auto; color: #3a2f1c;">
      <p>${greeting}</p>
      <p>Welcome to Mała Gospodyni! Your account is ready — start by adding a recipe, scaling one for a crowd, or scanning a handwritten family recipe to save it for good.</p>
      <p>Everything you've used so far is free, and stays free. Down the road we're planning a Premium tier for people who want more, including:</p>
      <ul>${featureListHtml}</ul>
      <p>Premium isn't live yet — this is just a heads-up so you know what's coming. We'll let you know when it's ready.</p>
      <p>In the meantime, enjoy the app! If you ever have questions, just reply to this email.</p>
      <p>— Mała Gospodyni</p>
      <hr style="border: none; border-top: 1px solid #e3dcc8; margin: 24px 0 12px;">
      <p style="font-size: 12px; color: #8a7f68;">
        This is the only email like this you'll get from us. We'll still email you for account
        verification or if you ever request a password reset — nothing else.
        <!-- TODO before sending real marketing mail: most jurisdictions' commercial-email
             rules (e.g. US CAN-SPAM) expect a physical mailing address here. Add one. -->
      </p>
    </div>
  `;

  const text = `${greeting}

Welcome to Mala Gospodyni! Your account is ready — start by adding a recipe, scaling one for a crowd, or scanning a handwritten family recipe to save it for good.

Everything you've used so far is free, and stays free. Down the road we're planning a Premium tier for people who want more, including:

${featureListText}

Premium isn't live yet — this is just a heads-up so you know what's coming. We'll let you know when it's ready.

In the meantime, enjoy the app! If you ever have questions, just reply to this email.

— Mała Gospodyni

This is the only email like this you'll get from us. We'll still email you for account verification or if you ever request a password reset — nothing else.`;

  return { subject, html, text };
}

module.exports = { buildPremiumWelcomeEmail, PREMIUM_FEATURES };
