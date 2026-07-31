import type { ReactNode } from 'react';
import { SidePane } from '../../components/ui/pane.tsx';

export function MembersPageFrame({
    agentCount,
    agentListStatus,
    agentRows,
    createControl,
    detail,
    humanMembers,
}: {
    agentCount: number;
    agentListStatus: 'error' | 'loading' | 'ready';
    agentRows: ReactNode;
    createControl?: ReactNode;
    detail: ReactNode;
    humanMembers: ReactNode;
}) {
    return (
        <main className="flex min-h-0 flex-1">
            <SidePane
                className="app-shell-sidebar-top-inset w-72 flex-col overflow-y-auto bg-[var(--sidebar)] pb-6"
                side="left"
            >
                <section>
                    <div className="mb-2 flex items-center justify-between px-3">
                        <h1 className="flex items-center gap-2 font-mono text-sidebar-muted text-xs uppercase tracking-wider">
                            <span>Agents</span>
                            {agentListStatus === 'ready' ? (
                                <span className="tabular-nums">{agentCount}</span>
                            ) : null}
                        </h1>
                        {createControl}
                    </div>
                    <div className="space-y-1 px-2">
                        {agentListStatus === 'loading' ? (
                            <p className="px-2 py-2 text-sidebar-muted text-xs">Loading Agents…</p>
                        ) : agentListStatus === 'error' ? (
                            <p className="px-2 py-2 text-sidebar-muted text-xs" role="alert">
                                Couldn’t load Agents
                            </p>
                        ) : (
                            agentRows
                        )}
                    </div>
                </section>
                <div className="px-2">{humanMembers}</div>
            </SidePane>
            <section className="flex min-w-0 flex-1">{detail}</section>
        </main>
    );
}
