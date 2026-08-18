import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { useLayoutContext } from '../../shell/use-layout-context.ts';
import { SettingsLayout } from './page.tsx';

describe('SettingsLayout', () => {
    test('forwards the app layout context to settings child routes', () => {
        const markup = renderSettingsRoute();

        expect(markup).toContain('settings context available');
    });

    test('pads normal settings routes', () => {
        const markup = renderSettingsRoute();

        expect(markup).toContain('pt-12');
    });
});

function renderSettingsRoute() {
    return renderToStaticMarkup(
        <MemoryRouter initialEntries={['/settings/probe']}>
            <Routes>
                <Route element={<AppLayoutProbe />} path="/settings">
                    <Route element={<SettingsLayout />}>
                        <Route element={<SettingsChildProbe />} path="probe" />
                    </Route>
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

function AppLayoutProbe() {
    return <Outlet context={{ navigateToSettings: () => undefined }} />;
}

function SettingsChildProbe() {
    const context = useLayoutContext();

    return <span>{context ? 'settings context available' : 'missing context'}</span>;
}
