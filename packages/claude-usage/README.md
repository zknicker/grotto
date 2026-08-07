# @tavern/claude-usage

Small Node-first adapter for Claude Code plan usage.

## Approach

- Load OAuth credentials from `~/.claude/.credentials.json`
- Fall back to the `Claude Code-credentials` Keychain item when the file is unavailable
- Fall back to `CLAUDE_CODE_OAUTH_TOKEN` only when neither full-scope source is available
- Fetch live quota state from `https://api.anthropic.com/api/oauth/usage`
- Normalize the response into a stable TypeScript interface owned by Grotto

## Notes

- The package is intentionally narrow: credentials, fetch, normalize.
- The exported snapshot shape is our product boundary; provider response quirks stay internal.
- The file and Keychain-based Claude credentials are the preferred sources because they match Claude Code login state.
- The environment token fallback is useful for direct API calls, but it may not always have the same quota visibility as a full Claude Code login.
- The package is read-only with respect to Claude Code auth. It never refreshes or rewrites provider credentials.

## Example

```ts
import { getClaudeUsage } from '@tavern/claude-usage';

const usage = await getClaudeUsage();

console.log(usage.windows);
```

## Live smoke test

```bash
bun run --filter @tavern/claude-usage test:live
```
