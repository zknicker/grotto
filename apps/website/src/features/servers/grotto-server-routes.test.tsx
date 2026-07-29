import { expect, mock, test } from 'bun:test';
import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('../../lib/grotto-server.tsx', () => ({
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

test('mounts development sign-in inside hosted tRPC and before the sign-in gate', () => {
    const markup = renderToStaticMarkup(<GrottoServerRoutes />);

    expect(markup).toContain(
        '<div data-testid="grotto-server-provider"><div data-testid="dev-auto-sign-in"></div><div data-testid="sign-in-gate">'
    );
    expect(markup).toContain('hosted-server-event-listeners');
});
