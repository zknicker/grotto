/**
 * The App ↔ hosted Server wire contract. This is intentionally an exact
 * equality gate: a changed contract requires an App update, never an adapter.
 */
export const appProtocolVersion = 2;

export const appProtocolHeaders = {
    productVersion: 'x-grotto-product-version',
    protocolVersion: 'x-grotto-app-protocol-version',
} as const;
