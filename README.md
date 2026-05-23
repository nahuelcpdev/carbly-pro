# carbly.pro — Carbly's public site

Minimal landing page + legal docs (privacy + terms) for [Carbly](https://carbly.pro), an iOS low-carb + fasting companion.

Served by GitHub Pages from `main` at the apex domain `carbly.pro`.

## Routes

- `/` — landing
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service

## Source of truth

The Markdown content of `privacy.md` and `terms.md` is mirrored from [`nahuelcpdev/KetoCheck:docs/legal/`](https://github.com/nahuelcpdev/KetoCheck/tree/main/docs/legal). When updating the policies, edit them there first, then sync into this repo. (Do not edit `privacy.md` or `terms.md` here directly — they will drift from the canonical source.)

## Stack

- GitHub Pages (Jekyll, theme: `jekyll-theme-cayman`)
- Custom apex domain: `carbly.pro` via GoDaddy DNS

## DNS setup (one-time, manual)

To resolve `carbly.pro` to GitHub Pages, configure the following at GoDaddy:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `185.199.108.153` | 600 |
| A | `@` | `185.199.109.153` | 600 |
| A | `@` | `185.199.110.153` | 600 |
| A | `@` | `185.199.111.153` | 600 |
| CNAME | `www` | `nahuelcpdev.github.io` | 600 |

After DNS propagation (~1h), GitHub Pages will issue a free TLS cert via Let's Encrypt.

## Linear

Tracked under [CLY-1149](https://linear.app/carbly/issue/CLY-1149).
