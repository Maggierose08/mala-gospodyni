# Premium welcome email — go-live checklist

This folder is written and ready, but **nothing here is deployed or live
yet** — on purpose, per your request to draft this now and activate it
once Premium is real. Nothing about your site, your users' sign-up flow,
or their existing verification/password-reset emails changes until you
deliberately do the steps below.

## What this is

One Cloud Function (`sendPremiumWelcomeEmail` in `index.js`) that fires
automatically the moment someone creates an account, and sends them a
one-time email (content in `premiumWelcomeEmail.js`) about what's free vs.
what Premium will include. It never sends more than once per account, and
it never touches Firebase Auth's own verification/password-reset emails —
those keep working exactly as they do today, through Firebase itself, not
through this.

It has a built-in off-switch (`PREMIUM_EMAIL_ENABLED`) that defaults to
off, so even if this folder gets deployed before you're ready, it won't
send anything until you flip that on.

## Where replies go

Resend (the service this uses to send) only sends mail — it doesn't come
with an inbox. The email's "from" address (`RESEND_FROM_ADDRESS`) won't
receive anything unless you've separately set up real mailbox hosting for
it, so by default a reply to it would just bounce or vanish, even though
the email's own wording says "just reply to this email."

The fix is `RESEND_REPLY_TO` (see `.env.example`): set it to an inbox you
actually check — your own Gmail is fine, it doesn't need to be on the same
domain as the "from" address — and people's "Reply" button routes there
instead, regardless of what "from" shows. The function treats this the
same as the other required settings: if it's enabled but this isn't set,
it skips sending rather than send something that promises a reply path
that doesn't exist.

(If you'd rather replies arrive at a real branded address like
`hello@yourdomain.com` instead of your personal Gmail, that needs actual
mailbox hosting on that domain — e.g. Google Workspace, or a free
forwarding service like ImprovMX that just relays to your Gmail. Happy to
help set that up later if you want it; `RESEND_REPLY_TO` is the simpler
option that needs nothing extra.)

## Before this can actually send anything, in order

1. **Finalize the email content.** Open `premiumWelcomeEmail.js` and
   replace the three `PLACEHOLDER` bullet points with the real Premium
   feature list once you've decided what that is. (Nothing in the app is
   paywalled today, so this is purely your call — happy to help word it
   once you know what you want to include.)

2. **Upgrade the Firebase project to the Blaze (pay-as-you-go) plan.**
   Cloud Functions requires it. In the Firebase console: Settings (gear
   icon) → Usage and billing → Details & settings → Modify plan. Blaze has
   a free monthly allowance (2M function invocations, plus free Firestore
   reads/writes); at the scale of a personal recipe app, this should cost
   $0/month, but it's a real payment method on file, so you're the one who
   should do this step, not me.

3. **Create a free Resend account** at resend.com (3,000 emails/month, 100
   emails/day free — plenty for a one-time welcome email). Sign up, then:
   - **Verify a sending domain.** Resend requires sending "from" an address
     on a domain you've proven you own (adding a couple of DNS records they
     give you) — their free test address (`onboarding@resend.dev`) exists
     but isn't meant for real mail to real users. If you don't have a
     domain for this app yet, you'd need one (even a cheap one works) —
     let me know if you want help with that step.
   - **Create an API key** (Resend dashboard → API Keys).

4. **Set the real configuration**, once you have the above two things.
   Easiest: copy `.env.example` in this folder to `.env.mala-gospodyni` and
   fill in all four values (`PREMIUM_EMAIL_ENABLED=true`, your real
   `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` using your verified domain, and
   `RESEND_REPLY_TO` — see "Where replies go" above). That file is already
   in `.gitignore` — it should never be committed.

5. **Install dependencies and deploy.** From this `functions/` folder:
   ```
   npm install
   ```
   Then from the repo root:
   ```
   firebase login
   firebase deploy --only functions
   ```
   (`firebase login` only needs to happen once per computer. If the
   `firebase` command isn't found, `npm install -g firebase-tools` first.)

6. **Test it** by creating a throwaway account in the app and confirming
   the email arrives, before telling real users Premium is coming.

## Turning it off again

Set `PREMIUM_EMAIL_ENABLED=false` in your `.env.mala-gospodyni` and
redeploy (`firebase deploy --only functions`) — or just leave the function
deployed-but-disabled indefinitely, since the check happens on every run.
