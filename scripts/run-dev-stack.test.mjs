import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'run-dev-stack.mjs'),
    'utf8'
);

// The dev stack used to read `.env` and `apps/website/.env.development` itself
// to find the Clerk development credentials. Varlock is now the only loader:
// `bun run dev` runs under `varlock run`, so the stack inherits CLERK_*,
// GROTTO_DEV_CLERK_SIGN_IN_USER_ID, and VITE_CLERK_PUBLISHABLE_KEY from the schema and
// passes its own process environment straight to every child.
test('reads no environment file of its own', () => {
    assert.doesNotMatch(source, /from 'node:fs'/u);
    assert.doesNotMatch(source, /\.env\.development/u);
    assert.doesNotMatch(source, /getDevEnvironmentOverrides/u);
});
