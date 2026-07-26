import { expect, test } from 'bun:test';
import { Children, type ReactElement, type ReactNode } from 'react';
import { LocalAppFrame } from './app-router.tsx';
import { AppFrame } from './components/app-frame.tsx';
import { DevAutoSignIn } from './features/auth/dev-auto-sign-in.tsx';
import { SessionTokenKeepalive } from './features/auth/session-token-keepalive.tsx';
import { SignInGate } from './features/auth/sign-in-gate.tsx';
import { GrottoServerRoutes } from './features/servers/grotto-server-routes.tsx';
import { CommandMenu } from './features/shell/command-menu.tsx';
import { GrottoServerProvider } from './lib/grotto-server.tsx';
import { TavernProviders } from './lib/trpc.tsx';

test('hosted and local routes keep separate provider ownership', () => {
    const local = LocalAppFrame();
    expect(local.type).toBe(TavernProviders);

    const [devSignIn, keepalive, localGate] = elementChildren(local);
    expect([devSignIn.type, keepalive.type, localGate.type]).toEqual([
        DevAutoSignIn,
        SessionTokenKeepalive,
        SignInGate,
    ]);
    expect(elementChildren(localGate).map((element) => element.type)).toEqual([
        CommandMenu,
        AppFrame,
    ]);

    const hostedGate = GrottoServerRoutes();
    expect(hostedGate.type).toBe(SignInGate);
    expect(elementChildren(hostedGate)[0].type).toBe(GrottoServerProvider);
});

function elementChildren(element: ReactElement): ReactElement[] {
    const { children } = element.props as { children?: ReactNode };
    return Children.toArray(children) as ReactElement[];
}
