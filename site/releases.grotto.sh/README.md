# releases.grotto.sh

Cloudflare Worker for the stable public Grotto release hostname.

`/computer/*` redirects to the immutable public S3 release prefix. The Worker
does not proxy artifact bytes, retain credentials, or serve mutable content.

Deploy from this directory with `bunx wrangler deploy`.
