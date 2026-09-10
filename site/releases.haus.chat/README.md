# releases.haus.chat

Cloudflare Worker for the stable public Haus release hostname.

`/computer/*` redirects to matching paths in the public S3 release prefix.
`/haus/*` maps to the existing `/grotto/*` S3 namespace so published bytes and
release history remain unchanged. The old hostname and `/grotto/*` URLs remain
available for installed clients during migration.
Versioned directories such as `/computer/1.1.1/` are immutable.
`/computer/latest.json` and `/computer/install.sh` are mutable pointers promoted
only after the publisher verifies the versioned release. `/haus/latest.json`
describes the effective versions of every component in the current Haus release.

The Worker does not proxy artifact bytes, retain credentials, or store release
state. Vercel is not part of this release path.

Deploy from the repository's `Deploy Release Host` GitHub Action. It resolves
the shared Cloudflare credential from 1Password, deploys this Worker, and
verifies both public namespaces from the consumer. A supervised local deploy
uses `bun run deploy:release-host` under the production operator identity.
