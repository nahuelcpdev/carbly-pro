---
layout: default
title: Support
description: Carbly support — get help, contact, or report issues.
permalink: /support
---

# Support

**Carbly** is an iOS low-carb + fasting companion. Need help, want to report a bug, or have a question? Reach out below.

## Contact

Email: `nahuelcp.dev@gmail.com`

We respond within 30 days (typically 1–3 business days).

## Common questions

- **How does the AI photo scan work?** Carbly sends your scan photo to our Cloudflare Worker, which calls a vision model for nutritional estimation. The estimate is not a medical assessment — verify against nutrition labels.
- **Where is my data stored?** Carbly uses anonymous accounts; data lives in Supabase (USA). See the [Privacy Policy](/privacy) for the full data lifecycle.
- **How do I cancel a subscription?** iOS Settings → tap your Apple ID at top → Subscriptions → Carbly → Cancel.
- **How do I delete my account?** In Carbly: Settings → Account → Delete Account. Triggers a Supabase cascade that removes your `user_profiles`, `food_logs`, `fasting_logs`, and `daily_streaks` rows.

## Legal

- [Privacy Policy](/privacy)
- [Terms of Service](/terms)
