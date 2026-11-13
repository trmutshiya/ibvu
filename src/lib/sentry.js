// IBVU v6.12 — what changed in this file: the release label sent with error reports now says 6.0.12.
// IBVU v6.11 — what changed in this file: the release label sent with error reports now says 6.0.11.
// IBVU v6.10 — what changed in this file: the release label sent with error reports now says 6.0.10.
// IBVU v6.09 — what changed in this file: the release label sent with error reports now says 6.0.9.
// IBVU v6.08 — what changed in this file: the release label sent with error reports now says 6.0.8.
// IBVU v6.07 — what changed in this file: the release label sent with error reports now says 6.0.7.
// IBVU v6.06 — what changed in this file: the release label sent with error reports now says 6.0.6.
// IBVU v6.05 — what changed in this file: the release label sent with error reports now says 6.0.5.
// IBVU v6.04 — what changed in this file: the release label sent with error reports now says 6.0.4.
// IBVU v6.03 — what changed in this file: the release label sent with error reports now says 6.0.3.
// IBVU v6.02 — what changed in this file: the release label sent with error reports now says 6.0.2.
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || dsn.startsWith("https://YOUR_")) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.DEV ? "development" : "production",
    tracesSampleRate: 0.1,
    release: "ibvu@6.0.12",
    beforeSend(event) {
      if (import.meta.env.DEV) return null;
      return event;
    },
  });
}

export { Sentry };
