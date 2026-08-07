# @tavern/codex-usage

Small Node-first adapter for Codex plan usage.

## Approach

- Load OAuth credentials from `~/.codex/auth.json`
- Fetch live quota state from `https://chatgpt.com/backend-api/wham/usage`
- Normalize the response into a stable TypeScript interface owned by Grotto

## Notes

- The package is intentionally narrow: credentials, fetch, normalize.
- The exported snapshot shape is our product boundary; provider response quirks stay internal.
- This endpoint appears to be a product endpoint rather than a documented public OpenAI API, so the tests focus on the exact fields we depend on.
- `OPENAI_API_KEY` is not enough here; this package expects Codex OAuth login state.
- The package is read-only with respect to Codex auth. It never refreshes or rewrites provider credentials.

## Example

```ts
import { getCodexUsage } from '@tavern/codex-usage';

const usage = await getCodexUsage();

console.log(usage.windows);
```

## Live smoke test

```bash
bun run --filter @tavern/codex-usage test:live
```
