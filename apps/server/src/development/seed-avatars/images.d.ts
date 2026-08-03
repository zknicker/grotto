/**
 * Bun resolves `with { type: 'file' }` imports to an on-disk path and copies
 * the asset when bundling. TypeScript needs to be told what those imports are.
 */
declare module '*.png' {
    const path: string;
    export default path;
}

declare module '*.jpg' {
    const path: string;
    export default path;
}
