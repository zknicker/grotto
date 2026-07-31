import type { ReactNode } from 'react';

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
            <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto border-separator border-e bg-surface px-2 py-3">
                <section>
                    <div className="mb-2 flex items-center justify-between gap-2 px-2">
                        <h1 className="flex min-w-0 items-center gap-2 font-medium text-muted text-sm">
                            <span>Agents</span>
                            {agentListStatus === 'ready' ? (
                                <span className="tabular-nums">{agentCount}</span>
                            ) : null}
                        </h1>
                        {createControl}
                    </div>
                    <div className="space-y-1">
                        {agentListStatus === 'loading' ? (
                            <p className="px-2 py-2 text-muted text-sm">Loading Agents…</p>
                        ) : agentListStatus === 'error' ? (
                            <p className="px-2 py-2 text-muted text-sm" role="alert">
                                Couldn’t load Agents
                            </p>
                        ) : (
                            agentRows
                        )}
                    </div>
                </section>
                {humanMembers}
            </aside>
            <section className="flex min-w-0 flex-1">{detail}</section>
        </main>
    );
}
