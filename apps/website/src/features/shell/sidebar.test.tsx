import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SidebarProvider } from '../../components/ui/sidebar.tsx';
import { AppSidebarFrame } from './sidebar.tsx';

describe('AppSidebarFrame', () => {
    test('renders supplied content and footer', () => {
        const markup = renderToStaticMarkup(
            <SidebarProvider>
                <AppSidebarFrame content={<div>Server navigation</div>} footer={<li>Account</li>} />
            </SidebarProvider>
        );

        expect(markup).toContain('Server navigation');
        expect(markup).toContain('Account');
    });
});
