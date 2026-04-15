import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://f6d6ba78ff100a1d50fa4ffccf58bcc0@o4511224075190272.ingest.de.sentry.io/4511224099504208",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.2,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
});

export { Sentry };
