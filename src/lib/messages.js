// IBVU v6.02 — what changed in this file since v6.0:
// - Mailing lists: a newsletter sign-up carries the lists the person chose,
//   and the contact form can carry "send me occasional updates" (added to the
//   list that matches the enquiry type). Either way the person gets an email
//   with a Confirm button and is only added once they press it.
// - confirmSubscription, unsubscribeInfo and unsubscribe serve the pages
//   behind the links in those emails (ibvu.org/newsletter/confirm and
//   ibvu.org/unsubscribe).
// - Preview: sign-ups and messages are kept in this browser so admin's
//   Mailing lists and Messages screens and the two pages can be tried.
//
// IBVU v6.0 — what changed in this file since v5.6: the contact form and the
// newsletter sign-up now really send. Both go to the site-forms function on
// the server, which checks the spam-check token, saves the message or sign-up
// in the database and emails hello@ibvu.org. In preview (no database
// settings) they still only pretend, as before.
//
// IBVU v5.6 — new file.
// Sending the contact form and newsletter sign-ups.
//
// PREVIEW MODE: nothing is sent yet. Both functions answer as if sending worked
// so the screens can be reviewed, and say that it was only a preview. When the
// build is approved these two functions are connected to the email service
// (messages go to hello@ibvu.org); the forms themselves will not change.
import { PREVIEW_MODE, previewSignUp, previewConfirm, previewUnsubscribeInfo, previewUnsubscribe, previewAddMessage } from './content.js';
import { LIST_FOR_ENQUIRY } from './lists.js';
import { sendForm } from './remote.js';

export const CONTACT_EMAIL = "hello@ibvu.org";

export const ENQUIRY_TYPES = [
  { id: "general",      label: "General enquiry" },
  { id: "advisory",     label: "Advisory services (Regulate)" },
  { id: "research",     label: "Research collaboration" },
  { id: "partnerships", label: "Partnerships and working with us" },
  { id: "shop",         label: "Herb Mail Club and shop" },
  { id: "events",       label: "Events" },
  { id: "media",        label: "Media and press" },
];

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// { name, email, organisation, type, message, wantsUpdates } → { ok, preview, error, confirmSent }
// turnstileToken: the answer from the spam check (see src/lib/turnstile.js).
export async function sendEnquiry(enquiry, turnstileToken) {
  if (PREVIEW_MODE) {
    await wait(500);
    previewAddMessage({ name: enquiry.name, email: enquiry.email.trim().toLowerCase(), organisation: enquiry.organisation || "", type: enquiry.type, message: enquiry.message, wantsUpdates: !!enquiry.wantsUpdates });
    let confirmToken = "";
    if (enquiry.wantsUpdates && LIST_FOR_ENQUIRY[enquiry.type]) {
      confirmToken = previewSignUp({ email: enquiry.email, firstName: enquiry.name, lists: [LIST_FOR_ENQUIRY[enquiry.type]], source: "contact form" }).confirmToken;
    }
    return { ok: true, preview: true, confirmSent: !!confirmToken, confirmToken };
  }
  return sendForm("contact", enquiry, turnstileToken);
}

// { firstName, lastName, email, lists, source } → { ok, preview, error, confirmSent }
export async function subscribeToNewsletter(person, turnstileToken) {
  if (PREVIEW_MODE) {
    await wait(500);
    const r = previewSignUp(person);
    return { ok: true, preview: true, confirmSent: r.needsConfirm, confirmToken: r.confirmToken };
  }
  return sendForm("newsletter", person, turnstileToken);
}

// The pages behind the links in the emails.
export async function confirmSubscription(token) {
  if (PREVIEW_MODE) { await wait(300); return previewConfirm(token); }
  return sendForm("confirm", { token });
}
export async function unsubscribeInfo(token) {
  if (PREVIEW_MODE) { await wait(300); return previewUnsubscribeInfo(token); }
  return sendForm("unsubscribe-info", { token });
}
export async function unsubscribe(token, keep) {
  if (PREVIEW_MODE) { await wait(300); return previewUnsubscribe(token, keep); }
  return sendForm("unsubscribe", { token, keep });
}

export function isEmail(value) { return /^\S+@\S+\.\S+$/.test((value || "").trim()); }
