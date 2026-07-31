import type { ReactNode } from 'react';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarMenu,
} from '../../components/ui/sidebar.tsx';

export function AppSidebarFrame({ content, footer }: { content: ReactNode; footer?: ReactNode }) {
    return (
        <Sidebar
            className="app-shell-sidebar app-shell-sidebar-top-inset z-30 shrink-0 bg-transparent"
            collapsible="none"
        >
            <SidebarContent className="overflow-hidden">{content}</SidebarContent>
            {footer ? (
                <SidebarFooter>
                    <SidebarMenu>{footer}</SidebarMenu>
                </SidebarFooter>
            ) : null}
        </Sidebar>
    );
}
