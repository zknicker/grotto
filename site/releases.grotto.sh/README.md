# releases.grotto.sh

Cloudflare Worker for the stable public Grotto release hostname.

`/computer/*` and `/grotto/*` redirect to matching paths in the public S3 release prefix.
Versioned directories such as `/computer/1.1.1/` are immutable.
`/computer/latest.json` and `/computer/install.sh` are mutable pointers promoted
only after the publisher verifies the versioned release. `/grotto/latest.json`
describes the effective versions of every component in the current Grotto release.

The Worker does not proxy artifact bytes, retain credentials, or store release
state. Vercel is not part of this release path.

Deploy from the repository's `Deploy Release Host` GitHub Action. It resolves
the shared Cloudflare credential from 1Password, deploys this Worker, and
verifies both public namespaces from the consumer. A supervised local deploy
uses `bun run deploy:release-host` under the production operator identity.
