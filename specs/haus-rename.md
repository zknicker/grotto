# Haus identity contract

The product name is Haus and its canonical origin is `https://haus.chat`.
All maintained source text, filenames, packages, environment variables, wire
contracts, documentation, and active operational resources use Haus.

## Completion requirements

- Scan tracked file contents and filenames case-insensitively for all retired
  product names. No exclusions for internal identifiers or historical fixtures.
- Regenerate OpenAPI types, package metadata, and release artifacts from the
  renamed source. Keep dependency versions unchanged.
- Migrate persistent database columns, constraints, roles, service paths,
  Computer state, and managed Agent session keys before deploying consumers.
  Preserve account IDs, credentials, messages, and Agent work.
- Rename secret-store items with their schema references and verify the actual
  unattended consumer. Never copy secret values into source or logs.
- Publish matching Server, desktop, iOS, Computer, and Agent builds. This is a
  breaking contract migration; prior shells and Computers are not supported.
- Verify sign-in, native callbacks, realtime chat, Agent execution, update
  discovery, and downloads against the canonical origin.

## Current identities

The desktop bundle is `chat.haus.desktop`. The iPhone bundle is `chat.haus.ios`,
with Associated Domains and team prefix `XJ8RZZT99R`. Apple's listing is
Haus Chat, Apple ID `6810799017`. Haus Internal distributes TestFlight builds
to the operator.

The Cloudflare account is `724dcbc66c598aceef727137229485f3`; the Haus zone is
`c359f6184bdf7b405b2751835cf98802`. Its nameservers are
`ajay.ns.cloudflare.com` and `paislee.ns.cloudflare.com`. The application tunnel
is `401d3f59-5e0a-43e8-bd1a-b29237e9cc74`.

Clerk owns the `clerk`, `accounts`, `clkmail`, `clk._domainkey`, and
`clk2._domainkey` DNS-only CNAMEs. Google sign-in uses the Clerk callback.
Google's public homepage is `https://haus.chat/about/`, served by the static
haus-about Worker. The main app stays at the apex.

`releases.haus.chat` serves current release descriptors and downloads.
`support@haus.chat` forwards through Cloudflare Email Routing.

A clean source scan alone is insufficient. Completion also requires successful
checks, published target artifacts, migrated persistent state, and verified
production behavior. Do not report an unfinished cutover as complete.
