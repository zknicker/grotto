# Haus rename and domain cutover

The product name is **Haus** and the canonical origin is **https://haus.chat**.
Grotto and any remaining Cavern product names must be retired. This migration
includes public copy, native app metadata, source identifiers, package names,
configuration, operational resources, documentation, and publication.

## Cutover order

1. Create the Cloudflare zone and install the Clerk, application, and release
   records. Vercel remains the registrar. Keep the old application available
   while preparing the replacement.
2. Add `haus.chat` to the existing Mac mini tunnel, routing to
   `http://127.0.0.1:18791`. Validate the configuration before restarting it.
3. Prepare Google OAuth callbacks, Clerk DNS and TLS, the new publishable key,
   the Server's accepted origin and issuer, and native authentication origins.
   Change Clerk's primary domain only when the matching release can deploy.
4. Finish the source and operational rename. Migrate persistent paths and
   configuration references together with their consumers. Preserve existing
   user records, credentials, release history, and immutable artifact bytes.
5. Publish the coordinated Server, desktop App, iOS, Computer, and Agent
   targets selected by the release impact check. Verify sign-in, realtime
   chat, native callbacks, update discovery, and artifact downloads at the new
   domain. Record Apple's actual processing and distribution state.
6. Redirect old web URLs with their path and query preserved. Keep old updater
   entrypoints usable long enough for existing installations to discover the
   Haus update. No current build may depend on the old domain when it expires.
7. Disable `grotto.sh` automatic renewal in Vercel and verify the saved value.
   Its existing registration expires on July 18, 2027; disabling renewal does
   not change that date.

## DNS ownership

The Cloudflare account is `724dcbc66c598aceef727137229485f3`. The Haus zone is
`c359f6184bdf7b405b2751835cf98802`; its assigned nameservers are
`ajay.ns.cloudflare.com` and `paislee.ns.cloudflare.com`.

The application tunnel is `401d3f59-5e0a-43e8-bd1a-b29237e9cc74`. Its local
configuration is `/Users/zknicker/srv/grotto/config/cloudflared.yml` on the
Mac mini. The dashboard cannot modify this locally managed tunnel.

Clerk requires DNS-only CNAME records for `clerk`, `accounts`, `clkmail`,
`clk._domainkey`, and `clk2._domainkey`. Derive their targets from the existing
Clerk production instance, not from another application. Google sign-in is
enabled and requires a matching callback migration.

`releases.haus.chat` serves release downloads. The current Worker also retains
`releases.grotto.sh` during migration. Historical manifests contain old URLs;
attaching the new hostname alone does not complete release migration.

## Apple identity decision

Haus uses the separate Apple App ID `chat.haus.ios`, with Associated Domains
enabled and the `Haus CI App Store` distribution profile. The operator chose
a fresh Apple application and tester installation. Existing Grotto installs
do not upgrade to this bundle. The App Store listing is Haus Chat (Apple ID `6810799017`); the installed app
display name is Haus. The `Haus Internal` tester group distributes builds
automatically to the operator.

## Computer and history migration

Computer protocol 18 uses `haus` for Server-authored inbox senders. Publish the
compatible Computer before activating Server so older Computers enter the
existing signed-update flow before receiving the renamed sender.

Saved attachments and login sessions for the exact origin `https://grotto.sh`
connect directly to `https://haus.chat`. Custom Server origins do not change.
Attachment reads preserve the original credential file for rollback; refreshed
login sessions persist the canonical origin through the existing atomic writer.
No credential is forwarded through an HTTP redirect.

New installations use `haus-computer`. Existing standalone installations expose
that command as an alias and continue updating the executable they already run.
The managed Agent command is `haus`; the old command remains an alias for resumed
histories. New workspace links use `haus://`, with legacy link parsing retained
for messages already stored on Server. Historical factory-guidance fixtures and
fingerprints retain their exact bytes so owned guidance can migrate without
overwriting owner edits.

`support@haus.chat` routes to the operator's verified Gmail destination through
Cloudflare Email Routing. Clerk's separate mail and DKIM CNAMEs remain intact.

Google's public application homepage is `https://haus.chat/about/`, served by the
static `haus-about` Worker. The main app remains at the apex. Google Search Console
verifies ownership through a DNS TXT record. Clerk's native AASA document includes
`XJ8RZZT99R.chat.haus.ios` for the fresh iPhone app.

Old apex and www browser navigations redirect to Haus with their path and query
preserved. The rule matches GET/HEAD requests for `/` or accepting `text/html`;
Computer API and update requests continue reaching Server during migration.

## Completion evidence

Completion requires a source-name inventory with every remaining old name
either removed or tied to an approved immutable or migration contract, healthy
public DNS and TLS, authenticated Haus operation, the merged release PR and
successful target jobs, production deployment proof, and Vercel's saved
`renew: false`. A branding-only diff or an attached domain is not completion.
