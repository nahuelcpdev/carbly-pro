---
layout: default
title: Privacy Policy
description: Carbly Privacy Policy — how we handle your data.
permalink: /privacy
---

# Carbly Privacy Policy

**Effective date:** 2026-04-26
**Last updated:** 2026-04-26
**Version:** 1.1

This Privacy Policy describes how Carbly ("we", "us", "our") collects, uses, stores, shares, and protects personal information when you use the Carbly iOS application ("the App"). By using the App you agree to the practices described below.

This policy is written to satisfy the requirements of Apple's App Store Review Guideline 5.1.1, the EU General Data Protection Regulation (GDPR), the UK Data Protection Act 2018, the California Consumer Privacy Act (CCPA) as amended by the CPRA, and the Children's Online Privacy Protection Act (COPPA).

---

## 1. Data controller

The data controller for personal information processed through the App is:

**Carbly** (operated by the developer registered on the Apple App Store as **nahuelcpdev**).
Contact: `privacy@carbly.pro`
Data Protection contact (DPO): `privacy@carbly.pro`

If you are in the European Economic Area or the United Kingdom and need a local representative, contact `privacy@carbly.pro` and we will route your request to the appropriate channel.

---

## 2. Summary of what we collect

The sections below describe every category of data we collect. This one-paragraph summary mirrors the App Privacy Label published on the App Store listing and the `PrivacyInfo.xcprivacy` manifest shipped in the App binary. The two sources must agree 1:1; if you believe they differ, please email `privacy@carbly.pro`.

| Category | Linked to you? | Purpose |
|---|---|---|
| Anonymous User ID (Supabase UUID) | Yes | App functionality, analytics |
| Health data (body-metric inputs, net-carb target) | Yes | App functionality |
| Fitness data (food logs with macros, fasting logs) | Yes | App functionality |
| Other User Content (food names, voice transcripts) | Yes | App functionality |
| Purchase history (subscription state) | Yes | App functionality |
| Crash reports, performance traces, breadcrumbs | Yes | App functionality |
| Food photos (in-memory only, discarded after analysis) | No | App functionality |
| Product interaction events, usage data (bucketed) | No | Analytics |

We do not use data for cross-app tracking. We do not collect the Identifier for Advertisers (IDFA). We do not sell personal information under the CCPA definition.

---

## 3. Categories of data collected and why

### 3.1 Anonymous account identifier

On first launch, the App creates an anonymous account with Supabase (our backend). Supabase issues a UUID (the "anonymous user ID") and a session token. The UUID is linked to all data you create in the App (food logs, fasting logs, profile inputs, subscription state) through row-level security rules in the Supabase Postgres database.

This anonymous account counts as an "account" for the purposes of Apple App Store Review Guideline 5.1.1(v). You can delete it at any time from Settings → Account → Delete Account, which triggers the deletion flow described in section 10.

### 3.2 Keychain storage of session tokens

The Supabase session token that authenticates your anonymous account across app launches is stored in the iOS Keychain. The Keychain is encrypted at rest by iOS and scoped to the App's keychain access group. The session token is sent over HTTPS as a bearer token when your device makes authenticated requests to our Cloudflare Worker or directly to Supabase.

### 3.3 Profile and health inputs

During onboarding, we ask for inputs used to compute a daily net-carb target: approximate weight, age, height, activity level, and fasting interest. These inputs collapse into a single `daily_net_carb_target` scalar stored on your profile row. We classify this data under the App Store Privacy Label "Health" category because it consists of user-provided body-metric and nutrition-target information.

### 3.4 Food logs and fasting logs (fitness data)

Every food scan, manual entry, and barcode lookup creates a row in the `food_logs` table with: food name, estimated net carbs, estimated macros (fat, protein, fiber, calories), estimated electrolytes (sodium, potassium, magnesium), optional voice transcript, confidence level, and a timestamp. Every fast creates a row in the `fasting_logs` table with: start time, end time, duration, preset or custom type, and zone reached. Apple's App Privacy Label "Fitness" category covers movement plus nutrition and macro data.

### 3.5 Food photos

When you tap the scan button and capture or select a food photo, the App:

1. Strips all EXIF metadata (GPS, device model, date) by redrawing the image into a fresh bitmap on-device.
2. Uploads the stripped image over HTTPS to our Cloudflare Worker.
3. The Worker forwards the image bytes in memory to the AI provider (see section 4.2) for analysis.
4. The Worker discards the image bytes as soon as the AI response is returned.
5. Only the structured result (net carbs, macros, food name, confidence) is persisted to Supabase. The photo bytes are never written to server-side storage.

Because the photo bytes themselves are not retained against your identity, we declare "Photos or Videos" as unlinked on the App Privacy Label.

### 3.6 Voice transcripts

If you add a voice note during a scan, the App transcribes your speech on-device using Apple's `SFSpeechRecognizer` with `requiresOnDeviceRecognition = true`. The raw audio is deleted from memory immediately after transcription. Only the text is sent alongside the photo to the AI provider for context, and only the text is saved in the `food_logs.voice_context` column. Audio bytes never leave your device and are never written to disk.

### 3.7 Purchase history

If you subscribe to Carbly Premium, RevenueCat (our subscription management provider) records the purchase, plan, trial state, and renewal timestamps. This data is linked to your anonymous user ID so entitlement syncs across reinstalls and devices.

### 3.8 Crash reports and performance traces

Sentry (our crash-reporting provider) collects crash stack traces, performance traces (sampled at 20% in production), and breadcrumbs describing recent in-app actions (scan started, fast started, paywall viewed). Sentry's screenshot-attach setting is disabled, so no screen contents are ever captured. User-interaction tracing is gated to debug builds only.

### 3.9 Product analytics

PostHog (our analytics provider) records product interaction events: screens viewed, paywall shown and dismissed, scan started and completed, fast started and ended, settings changed. We deliberately do not ship user-entered text (food names, voice transcripts, product names) as event properties. Instead we send bucketed categorical values: `net_carbs_bucket: low | med | high`, `keto_status: keto_friendly | borderline | not_keto`, `source: scan | manual | barcode`. These events are identified by your anonymous user ID for retention and funnel analysis but the payloads themselves contain no personal text.

### 3.10 Feature flags

PostHog also evaluates feature flags based on your anonymous user ID (or, in pre-identify sessions, a pseudonymous install ID generated once and persisted in UserDefaults). Feature flag decisions control which copy variants and which gradual rollouts you see. No new data category is collected for this purpose; the identifier used to evaluate the flag is the same one already covered in section 3.1.

---

## 4. How data is processed and who receives it

### 4.1 Cloudflare Worker (transit)

All AI requests from the App go through our Cloudflare Worker at `ketocheck-worker.nahuelcp-dev.workers.dev`. The Worker is a stateless transit layer: it verifies your session token, forwards your request to the AI provider, and returns the parsed response. The Worker emits structured log records of the form `{user_id, timestamp, provider, response_time_ms, success | error_code}`. These logs are retained by Cloudflare Workers Logs (observability) for approximately 7 days on our paid plan and are then automatically purged; we do not enable Cloudflare Logpush, so the logs are not shipped to or retained by any external destination. No image bytes, no voice transcripts, and no scan results are written to these logs.

### 4.2 AI provider (Anthropic)

Scan images and the accompanying voice transcript text are sent to Anthropic's Claude Haiku 4.5 model for analysis. Anthropic acts as a data sub-processor. Anthropic retains API inputs and outputs for up to 30 days for trust, safety, and abuse-monitoring purposes, after which they are automatically deleted. Inputs and outputs are not used to train Anthropic's models under Anthropic's Commercial Terms. For questions about our data-processing arrangement with Anthropic, email `privacy@carbly.pro`.

**v5.0.0 addition — Weekly Intelligence digest:** If you are a Carbly Premium subscriber and have enabled Weekly Insights in Settings, the App also sends a structured summary of your aggregated weekly data (net-carb averages, fasting session counts, activity totals, streak counts, electrolyte log summaries — no raw food photos, no voice audio, no food names) to Anthropic's Claude Haiku 4.5 model via the Worker, once per Monday morning. The AI-generated weekly insight prose is returned to the App, stored in your `intelligence_digests` row in Supabase, and displayed in the App. The same 30-day Anthropic abuse-monitoring retention and data-sub-processor relationship described above applies; inputs and outputs are not used to train Anthropic's models. Weekly Insights can be disabled at any time in Settings → Intelligence.

### 4.3 Supabase (database and auth)

All persistent data — your profile, food logs, fasting logs, daily streaks, voice transcripts — lives in a Supabase Postgres database in the `eu-central-1` region, protected by row-level security rules that restrict access to your anonymous user ID. Supabase also handles the authentication session state for your anonymous account.

### 4.4 RevenueCat (subscriptions)

Subscription purchase state, renewal status, and trial eligibility are synchronized with RevenueCat. RevenueCat receives your anonymous user ID, your Apple-issued original transaction identifier, and the product identifier you purchased. RevenueCat does not receive any food log, fasting log, or profile data.

### 4.5 PostHog (analytics)

PostHog receives bucketed event payloads identified by your anonymous user ID. See section 3.9 for the hygiene rules we apply to these payloads.

### 4.6 Sentry (crash and performance reporting)

Sentry receives crash stack traces, performance traces, breadcrumbs, and the anonymous user ID as a Sentry `userId`. No screenshots, no food photos, no voice audio, no free-text food log content.

### 4.7 Aggregated providers table

| Provider | Role | Data received | Retention |
|---|---|---|---|
| Cloudflare | Worker transit | Auth token, request metadata, scan payloads in memory | ~7 days structured logs (Cloudflare Workers Logs default; Logpush not enabled); payloads discarded post-response |
| Anthropic | AI inference | Stripped scan image, voice transcript text, structured prompt (scan/chat); aggregated weekly data summary (Intelligence digest, premium only) | Up to 30 days (Anthropic abuse-monitoring retention); then auto-deleted; not used for model training |
| Supabase | Database and auth | All persistent user data, anonymous session tokens | Until account deletion |
| RevenueCat | Subscription state | Anonymous user ID, purchase records | Until account deletion |
| PostHog | Product analytics | Bucketed event payloads, anonymous user ID | Per PostHog retention defaults |
| Sentry | Crash and performance | Stack traces, breadcrumbs, performance traces, anonymous user ID | 90 days default |
| Apple | Subscription processing | Standard StoreKit purchase data | Per Apple policies |

---

## 5. Legal bases for processing (GDPR Art. 6 and Art. 13)

For users in the European Economic Area, the United Kingdom, or Switzerland, the lawful bases on which we process personal information are:

- **Performance of a contract (Art. 6(1)(b))** — processing food logs, fasting logs, profile inputs, subscription state, and Keychain session tokens is necessary to deliver the App's core functionality that you requested by installing and using it.
- **Legitimate interests (Art. 6(1)(f))** — crash reports, performance traces, and bucketed analytics events are processed to keep the App stable and to understand which features work. We balance our interest in operational reliability and product improvement against your reasonable expectations. You may object to processing on this basis at any time by emailing `privacy@carbly.pro`.
- **Consent (Art. 6(1)(a))** — where applicable (for example, in EU analytics-consent jurisdictions), we obtain opt-in consent before enabling non-essential analytics.
- **Compliance with a legal obligation (Art. 6(1)(c))** — for example, responding to valid law enforcement requests.

---

## 6. International transfers

Your data may be processed in the following jurisdictions:

- **European Union** — Supabase database and auth (`eu-central-1`).
- **United States** — Anthropic, Cloudflare, PostHog, RevenueCat, Sentry, Apple.

Transfers from the EEA, UK, or Switzerland to the United States or any other jurisdiction outside the UK and EEA rely on the European Commission's Standard Contractual Clauses, the UK International Data Transfer Addendum, or equivalent safeguards where available. Where a sub-processor is enrolled in the EU–US Data Privacy Framework, we rely on that framework.

If you would like a copy of the specific safeguard that applies to a given transfer, email `privacy@carbly.pro`.

---

## 7. Retention

| Data category | Retention |
|---|---|
| Anonymous account (Supabase `auth.users` row) | Until you delete your account |
| Food logs (`food_logs`) | Until you delete your account |
| Fasting logs (`fasting_logs`) | Until you delete your account |
| Daily streaks (`daily_streaks`) | Until you delete your account |
| User profile (`user_profiles`) | Until you delete your account |
| Voice transcripts (`food_logs.voice_context`) | Until you delete your account |
| Supabase session tokens (iOS Keychain) | Until sign-out or account deletion |
| Worker structured logs | ~7 days (Cloudflare Workers Logs default; Logpush not enabled) |
| Scan image bytes on Worker | Discarded immediately after AI response |
| Voice audio on device | Discarded immediately after transcription |
| Sentry crash reports and traces | 90 days default |
| PostHog event data | Per PostHog product retention defaults |
| RevenueCat purchase records | For the life of the anonymous user ID |

Deleting your account triggers a cascade that removes your rows from `user_profiles`, `food_logs`, `fasting_logs`, and `daily_streaks` via the `auth.users(id) ON DELETE CASCADE` relationship. Worker logs and third-party sub-processor retention run on their own clocks listed above; we pass the deletion request through to RevenueCat and can submit erasure requests to the other sub-processors on your behalf when you email `privacy@carbly.pro`.

---

## 8. Your rights

### 8.1 EEA, UK, and Switzerland (GDPR Art. 15–22)

You have the right to:

- **Access (Art. 15)** — obtain confirmation of whether we process your data and a copy of it.
- **Rectification (Art. 16)** — correct inaccurate data.
- **Erasure (Art. 17)** — delete your data (see section 10 for the in-app path).
- **Restrict processing (Art. 18)** — pause processing while we investigate an objection or inaccuracy claim.
- **Data portability (Art. 20)** — receive a machine-readable export of the data you provided (JSON format).
- **Object to processing (Art. 21)** — including a specific right to object to any legitimate-interest processing described in section 5.
- **Not be subject to automated decision-making (Art. 22)** — the App's AI scan output is informational and does not produce a legal or similarly significant effect on you.

To exercise any of these rights, email `privacy@carbly.pro` with your anonymous user ID (found in Settings → Account). We respond within 30 days. You also have the right to lodge a complaint with your local supervisory authority.

### 8.2 California (CCPA / CPRA)

California residents have the right to:

- Know what personal information we have collected about them in the past 12 months.
- Delete their personal information.
- Correct inaccurate personal information.
- Opt out of the sale or sharing of personal information. **We do not sell or share personal information under the CCPA definition.**
- Limit the use of sensitive personal information.
- Non-discrimination for exercising these rights.

To submit a verifiable consumer request, email `privacy@carbly.pro` with your anonymous user ID. We respond within 45 days (with up to a 45-day extension where permitted). Because accounts are anonymous, we verify a request by matching the anonymous user ID the requester supplies against the account record and by sending a confirmation challenge to the requester's email of record.

### 8.3 Other jurisdictions

Residents of other jurisdictions (for example, Brazil under the LGPD, Canada under PIPEDA, Australia under the Privacy Act 1988) may have analogous rights. Email `privacy@carbly.pro` and we will route your request.

---

## 9. Children

The App is rated 13+ on the App Store. We do not knowingly collect personal information from children under the age of 13. If you believe a child under 13 has provided personal information, email `privacy@carbly.pro` and we will delete the associated data. The onboarding flow includes a hard age gate that blocks under-18 users from the fasting feature entirely; the fasting timer and preset selector are unreachable for that age bracket.

---

## 10. Data deletion

You can delete your account at any time from inside the App:

1. Open **Settings**.
2. Tap **Account**.
3. Tap **Delete Account**.
4. Confirm the deletion in the prompt.

The deletion flow calls our Cloudflare Worker endpoint `DELETE /api/account`. The Worker uses the Supabase service-role key (held server-side only) to call `auth.admin.deleteUser(userId)`. The `auth.users(id) ON DELETE CASCADE` relationship then removes your rows from `user_profiles`, `food_logs`, `fasting_logs`, and `daily_streaks`. The confirmation screen states explicitly: "This will delete your food logs, fasting history, streak data, and preferences permanently. This cannot be undone." (See the Carbly Terms of Service section on account termination for additional information.)

If the in-app path is unavailable (for example, you have lost access to the device), you can submit a Data Subject Access Request by emailing `privacy@carbly.pro` with the anonymous user ID that appears in your prior App session. We will process the deletion within 30 days.

---

## 11. Cookies and local storage

The App itself is not a web browser and does not set cookies. Inside the App binary we use the following on-device storage mechanisms:

- **iOS Keychain** — Supabase session token.
- **UserDefaults (`@AppStorage`)** — first-launch flag, appearance preference, fasting-safety acknowledgment timestamp, feature flag install ID, and similar low-sensitivity preferences. Declared under required-reason API category `CA92.1` in the App's privacy manifest.
- **Local file system (app container)** — Supabase session-file persistence. Declared under required-reason API category `C617.1` in the App's privacy manifest.
- **SwiftData / on-device cache** — cached food logs and fasting logs for offline viewing.

If you reach the Carbly marketing website (`carbly.pro`) through an in-App link, that website may set its own cookies. Its cookie notice, served by the website, governs that behavior.

---

## 12. Security

We protect your data through:

- HTTPS / TLS in transit for all network calls (App to Worker, App to Supabase, Worker to Anthropic).
- Encryption at rest for the iOS Keychain and for the Supabase database at the provider level.
- Row-level security rules in Supabase that restrict every row in `user_profiles`, `food_logs`, `fasting_logs`, and `daily_streaks` to its owning anonymous user ID.
- Server-side-only storage of the Supabase service-role key (used by the account-deletion Worker endpoint).
- No third-party direct access to the AI provider API key; all AI requests go through our Worker.

No transmission over the Internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.

---

## 13. Changes to this policy

We may update this Privacy Policy to reflect changes to our practices, our SDK mix, the legal environment, or the App's feature set. When we do:

- The "Last updated" date at the top of this document will change.
- Material changes (new data categories, new sub-processors with a different jurisdiction, changes to lawful basis) will be announced in the App on the first launch after the change, and (where we have your email of record) by email, at least 14 days before the change takes effect.
- We will keep prior versions of this policy available on request at `privacy@carbly.pro`.

Continuing to use the App after a change becomes effective indicates acceptance of the updated policy.

---

## 14. Contact

- **General privacy questions:** `privacy@carbly.pro`
- **Data Protection contact (EU / UK):** `privacy@carbly.pro`
- **DSAR and erasure requests:** `privacy@carbly.pro` (include your anonymous user ID; 30-day SLA under GDPR, 45-day SLA under CCPA)
- **Security reports:** `privacy@carbly.pro`

If you prefer to write us, include "Carbly Privacy" in the subject line so your request is routed correctly.

---

*This document is published at `https://carbly.pro/privacy` and is referenced from the in-App paywall in compliance with App Store Review Guideline 3.1.2.*
