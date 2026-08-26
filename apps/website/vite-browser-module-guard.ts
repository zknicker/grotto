import type { Plugin } from 'vite';

export function rejectNodeBuiltins(): Plugin {
    return {
        enforce: 'pre',
        name: 'reject-node-builtins',
        resolveId(source, importer) {
            if (source.startsWith('node:')) {
                this.error(
                    `Node-only module ${source} reached the Website browser graph from ${importer ?? 'an entry point'}`
                );
            }
        },
    };
}
