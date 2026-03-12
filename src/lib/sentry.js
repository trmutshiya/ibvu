import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || dsn.startsWith("https://YOUR_")) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.DEV ? "development" : "production",
    tracesSampleRate: 0.1,
    release: "ibvu@5.0.0",
    beforeSend(event) {
      if (import.meta.env.DEV) return null;
      return event;
    },
  });
}

export { Sentry };
