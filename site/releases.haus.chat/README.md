# Haus release host

The `haus-releases` Worker serves `releases.haus.chat`. It redirects `/computer/*`
and `/haus/*` directly to the corresponding path under the Haus S3 release
prefix, preserving query parameters. Other paths return 404.

Deploy from the repository root with `agent-varlock -- bun run deploy:release-host`.
Publish and verify the destination artifacts before changing the live Worker.
