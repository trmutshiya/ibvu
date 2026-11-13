// IBVU v6.0 — new file. The Cloudflare spam check for the contact form and
// the newsletter sign-up.
//
// The check runs only when someone presses Send or Subscribe, and it is
// usually invisible. If Cloudflare is unsure, a small box appears next to the
// button asking the person to tick it. The answer (a one-time token) goes to
// the site-forms function on the server, which checks it with Cloudflare
// before saving or emailing anything.
import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from './edge.js';

function waitForTurnstile(ms = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function look() {
      if (window.turnstile) return resolve(window.turnstile);
      if (Date.now() - start > ms) return reject(new Error("The security check could not load. Please reload the page and try again."));
      setTimeout(look, 150);
    })();
  });
}

// Returns { ref, getToken }. Put <div ref={ref} /> next to the button and
// call `await getToken()` when the form is sent.
export function useTurnstile() {
  const ref = useRef(null);
  const widget = useRef(null);
  const waiting = useRef(null);

  useEffect(() => () => {
    if (widget.current !== null && window.turnstile) { try { window.turnstile.remove(widget.current); } catch { /* already gone */ } }
  }, []);

  async function getToken() {
    if (!TURNSTILE_SITE_KEY) throw new Error("The security check is not set up on this site.");
    const turnstile = await waitForTurnstile();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(null, new Error("The security check took too long. Please try again.")), 90000);
      function finish(token, err) {
        clearTimeout(timer);
        const w = waiting.current; waiting.current = null;
        if (!w) return;
        if (err) w.reject(err); else w.resolve(token);
      }
      waiting.current = { resolve, reject };
      if (widget.current === null) {
        widget.current = turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          execution: "execute",
          appearance: "interaction-only",
          theme: "auto",
          callback: token => finish(token),
          "error-callback": () => finish(null, new Error("The security check did not work. Please try again.")),
          "expired-callback": () => {},
        });
      } else {
        try { turnstile.reset(widget.current); } catch { /* start fresh below */ }
      }
      turnstile.execute(widget.current);
    });
  }

  return { ref, getToken };
}
