// IBVU v6.0 — what changed in this file since v5.9:
// - The sign-in now uses the database's sign-in service through its own
//   library, which keeps the person signed in and renews the sign-in quietly.
//   Every save made in admin is then made as that person, so the database
//   rules (who may publish, edit pages, add people…) apply to them.
// - A person's role comes from the People list. Someone who receives a code
//   but is not on the People list is told they have no access.
// - Preview (no database settings) is unchanged: a demonstration sign-in.
//
// How it works on the real site:
//   1. The person types their email address and a code is emailed to them.
//      Only addresses that have been given access receive one. The screen says
//      the same thing either way, so it never reveals who has access.
//   2. They type the code. If it is right they are signed in on that browser
//      for 7 days, or until they press Sign out.
//
// No email address is written in this file or anywhere else in the site code.
import { SUPABASE_READY } from './supabase.js';
import { findPerson, signIn, startAuth, markSigningIn } from './content.js';
import { getClient } from './remote.js';

export const DEMO_SIGN_IN = !SUPABASE_READY;

// Step 1. Returns { ok } and, in the preview only, whether the address is on the People page.
export async function requestCode(email) {
  if (DEMO_SIGN_IN) return { ok: true, known: !!findPerson(email) };
  try {
    const client = await getClient();
    await startAuth();
    const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    if (error && error.status === 429) return { ok: false, error: "Too many tries. Please wait a minute and try again." };
    // Any other answer, including "no such person", looks the same to the visitor.
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the sign-in service. Check your connection and try again." };
  }
}

// Step 2. Returns { ok } or { ok: false, error }.
export async function checkCode(email, code) {
  const wrong = { ok: false, error: "That code is not right or has expired. Please try again." };
  if (DEMO_SIGN_IN) {
    const person = findPerson(email);
    if (!person || !/^\d{6}$/.test(code)) return wrong;
    signIn(email, { demo: true });
    return { ok: true };
  }
  try {
    const client = await getClient();
    await startAuth();
    const { data, error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error || !data || !data.session) return wrong;
    // The admin area now checks the People list and shows itself (see content.js).
    markSigningIn();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the sign-in service. Check your connection and try again." };
  }
}
