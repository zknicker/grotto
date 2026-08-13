// Cross-run bookkeeping for the standing agent pool. A crashed run leaves its
// eval chats behind; the next lease of that pool agent wipes them, so a fresh
// run never inherits stale collaboration context.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const agentTestsStateDirectory = path.join('.context', 'agent-tests');

export function createPoolState({ repositoryRoot = process.cwd() } = {}) {
    const file = path.join(repositoryRoot, agentTestsStateDirectory, 'state.json');
    let cache = null;
    let queue = Promise.resolve();

    async function load() {
        if (cache) {
            return cache;
        }
        cache = await readState(file);
        return cache;
    }

    function serialize(mutate) {
        queue = queue.then(async () => {
            const state = await load();
            const result = mutate(state);
            await writeState(file, state);
            return result;
        });
        return queue;
    }

    return {
        file,
        /** Records a chat this run created so a crash cannot orphan it. */
        remember(handle, chatId) {
            return serialize((state) => {
                const owned = state.chatsByHandle[handle] ?? [];
                if (!owned.includes(chatId)) {
                    owned.push(chatId);
                }
                state.chatsByHandle[handle] = owned;
            });
        },
        /** Drops chat ids that have been deleted. */
        forget(chatIds) {
            const removed = new Set(chatIds);
            return serialize((state) => {
                for (const [handle, owned] of Object.entries(state.chatsByHandle)) {
                    const kept = owned.filter((chatId) => !removed.has(chatId));
                    if (kept.length === 0) {
                        delete state.chatsByHandle[handle];
                    } else {
                        state.chatsByHandle[handle] = kept;
                    }
                }
            });
        },
        /**
         * The leftovers a prior run left for this pool agent. Reading never
         * clears them: only a confirmed delete may `forget` an id, so a failed
         * cleanup leaves the chats for the next lease instead of orphaning them.
         */
        peek(handle) {
            return serialize((state) => [...(state.chatsByHandle[handle] ?? [])]);
        },
    };
}

async function readState(file) {
    try {
        const parsed = JSON.parse(await readFile(file, 'utf8'));
        return { chatsByHandle: parsed?.chatsByHandle ?? {} };
    } catch {
        return { chatsByHandle: {} };
    }
}

async function writeState(file, state) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(state, null, 4)}\n`);
}
