'use client';

/**
 * PostHog initialization. Wrapped in a lazy initializer so we don't try
 * to load it during SSR or when the env var is unset (local dev default).
 */

import posthog from 'posthog-js';

let initialized = false;

export function ensurePosthogInitialized(): typeof posthog | null {
  if (typeof window === 'undefined') return null;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!initialized) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: '[data-pii]',
      },
    });
    initialized = true;
  }
  return posthog;
}
