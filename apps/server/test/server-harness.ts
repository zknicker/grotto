import type { AddressInfo } from 'node:net';
import {
    createServerApplication,
    type ServerApplicationOptions,
} from '../src/server-application.ts';

export interface ServerTestHarness {
    close(): Promise<void>;
    url: URL;
}

export async function startServerTestHarness(
    options: ServerApplicationOptions
): Promise<ServerTestHarness> {
    const application = await createServerApplication(options);
    await application.app.listen({ host: '127.0.0.1', port: 0 });

    const address = application.app.server.address() as AddressInfo;

    return {
        close: () => application.close(),
        url: new URL(`http://127.0.0.1:${address.port}`),
    };
}
