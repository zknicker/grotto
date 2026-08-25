// Clerk's headless bundle opens a BroadcastChannel while it is being required,
// and that channel's MessagePort keeps Node's event loop open for the rest of
// the process's life. Unref'ing the channel lets an eval CLI exit on its own
// once its work is done.
//
// This lives apart from eval-harness.mjs so the seam can be loaded — by the
// evals, and by the test that guards it — without dragging in the harness's
// whole module graph.
export function loadHeadlessClerk(websiteRequire) {
    const NativeBroadcastChannel = globalThis.BroadcastChannel;
    if (!NativeBroadcastChannel?.prototype?.unref) {
        return websiteRequire('@clerk/clerk-js/headless');
    }

    globalThis.BroadcastChannel = class extends NativeBroadcastChannel {
        constructor(name) {
            super(name);
            this.unref();
        }
    };
    try {
        return websiteRequire('@clerk/clerk-js/headless');
    } finally {
        globalThis.BroadcastChannel = NativeBroadcastChannel;
    }
}
