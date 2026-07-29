# releases.grotto.sh

Cloudflare Worker for the stable public Grotto release hostname.

`/computer/*` redirects to the matching path in the public S3 release prefix.
Versioned directories such as `/computer/1.1.1/` are immutable.
`/computer/latest.json` and `/computer/install.sh` are mutable pointers promoted
only after the publisher verifies the versioned release.

The Worker does not proxy artifact bytes, retain credentials, or store release
state. Vercel is not part of this release path.

Deploy from this directory with `bunx wrangler deploy`.
