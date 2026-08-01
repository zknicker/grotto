import { afterAll, expect, mock, test } from 'bun:test';
import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Bun keeps module mocks registered for the rest of the worker even after
// mock.restore(), so later test files resolve whatever this file leaves in
// the registry. Copy the real module first, stub on top of it so the mock
// stays a complete module, and re-register the real exports after the
// target import below has linked against the stubs.
const actualGrottoServer = { ...(await import('../../lib/grotto-server.tsx')) };

mock.module('../../lib/grotto-server.tsx', () => ({
    ...actualGrottoServer,
    GrottoServerProvider: ({ children }: React.PropsWithChildren) => (
        <div data-testid="grotto-server-provider">{children}</div>
    ),
    grottoTrpc: {
        server: {
            developmentBootstrap: {
                useMutation: () => ({ mutate: () => undefined }),
            },
        },
        useUtils: () => ({
            server: {
                invalidate: () => undefined,
            },
        }),
    },
}));

mock.module('../auth/dev-auto-sign-in.tsx', () => ({
    DevAutoSignIn: () => <div data-testid="dev-auto-sign-in" />,
}));

mock.module('../auth/sign-in-gate.tsx', () => ({
    SignInGate: ({ children }: React.PropsWithChildren) => (
        <div data-testid="sign-in-gate">{children}</div>
    ),
}));

mock.module('./hosted-server-event-listeners.tsx', () => ({
    HostedServerEventListeners: () => <div data-testid="hosted-server-event-listeners" />,
}));

const { GrottoServerRoutes } = await import('./grotto-server-routes.tsx');
mock.restore();

// Registering a module mock patches already-loaded modules immediately, so
// the real exports can only go back once this file's tests are done — but
// before later files in the worker resolve the module.
afterAll(() => {
    mock.module('../../lib/grotto-server.tsx', () => actualGrottoServer);
});

test('mounts development sign-in inside hosted tRPC and before the sign-in gate', () => {
    const markup = renderToStaticMarkup(<GrottoServerRoutes />);

    expect(markup).toContain(
        '<div data-testid="grotto-server-provider"><div data-testid="dev-auto-sign-in"></div><div data-testid="sign-in-gate">'
    );
    expect(markup).toContain('hosted-server-event-listeners');
});
