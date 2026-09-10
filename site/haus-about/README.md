# Haus public About page

`https://haus.chat/about/` describes the product without requiring sign-in. Google
OAuth branding uses this URL as its public application homepage. The main app,
privacy policy, API, and health endpoint remain served by Haus Server.

The `haus-about` Cloudflare Worker serves static assets only. Its two routes own
exactly `/about` and `/about/*`; `/about` redirects to the canonical trailing slash.
It has no bindings, runtime secrets, JavaScript, or application state.

Deploy from the repository root through the existing supervised Cloudflare
credential resolver:

```sh
agent-varlock -- bun run deploy:release-host --config ../haus-about/wrangler.jsonc
```

Verify the public page, its links, and `/healthz` after deployment. Keep the Google
Search Console ownership TXT record in Cloudflare DNS; removing it revokes the
ownership proof used for OAuth branding verification.
