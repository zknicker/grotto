import type { ReactNode } from 'react';
import { SectionHeader } from '../shell/section-header.tsx';
import { HomeCanvas } from './home-canvas.tsx';
import type { OverviewActivityItem } from './overview-activity.ts';
import { OverviewActivity, OverviewAgentCards } from './overview-sections.tsx';
import type { OverviewAgent, OverviewPresenceEntry } from './overview-types.ts';

interface OverviewViewProps {
    activity: OverviewActivityItem[];
    activityHref?: string;
    activitySeriesByAgentId: Map<string, number[]>;
    agents: OverviewAgent[];
    homeCanvas?: ReactNode;
    modelRefByAgentId: Map<string, string | null>;
    now: number;
    presence: OverviewPresenceEntry[];
    resolveAgentHref?: (agentId: string) => string;
}

export function OverviewView({
    activity,
    activityHref,
    activitySeriesByAgentId,
    agents,
    homeCanvas,
    modelRefByAgentId,
    now,
    presence,
    resolveAgentHref,
}: OverviewViewProps) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <SectionHeader title="Activity" />
            <OverviewBody
                activity={activity}
                activityHref={activityHref}
                activitySeriesByAgentId={activitySeriesByAgentId}
                agents={agents}
                homeCanvas={homeCanvas}
                modelRefByAgentId={modelRefByAgentId}
                now={now}
                presence={presence}
                resolveAgentHref={resolveAgentHref}
            />
        </div>
    );
}

function OverviewBody({
    activity,
    activityHref,
    activitySeriesByAgentId,
    agents,
    homeCanvas,
    modelRefByAgentId,
    now,
    presence,
    resolveAgentHref,
}: OverviewViewProps) {
    return (
        <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
            <div className="relative z-10 w-full max-w-6xl px-10 pt-4 pb-16">
                <div className="animate-float-up">
                    {homeCanvas ?? <HomeCanvas agents={agents} />}
                </div>

                <div className="mt-6 animate-float-up [animation-delay:80ms]">
                    <OverviewAgentCards
                        agents={agents}
                        modelRefByAgentId={modelRefByAgentId}
                        presence={presence}
                        resolveAgentHref={resolveAgentHref}
                        seriesByAgentId={activitySeriesByAgentId}
                    />
                </div>

                <div className="mt-4 animate-float-up [animation-delay:140ms]">
                    <OverviewActivity
                        activity={activity}
                        activityHref={activityHref}
                        agents={agents}
                        now={now}
                        resolveAgentHref={resolveAgentHref}
                    />
                </div>
            </div>
        </div>
    );
}
