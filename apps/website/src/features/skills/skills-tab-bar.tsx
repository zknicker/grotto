import { Tabs } from '@heroui/react';

export type SkillsTab = 'available' | 'installed' | 'plugins';

const tabs: Array<{ id: SkillsTab; label: string }> = [
    { id: 'installed', label: 'Installed' },
    { id: 'plugins', label: 'Plugins' },
    { id: 'available', label: 'Available' },
];

export function SkillsTabBar({
    counts,
    onChange,
    value,
}: {
    counts: Partial<Record<SkillsTab, number>>;
    onChange: (value: SkillsTab) => void;
    value: SkillsTab;
}) {
    return (
        <Tabs
            className="self-start"
            onSelectionChange={(key) => onChange(key as SkillsTab)}
            selectedKey={value}
            variant="secondary"
        >
            <Tabs.ListContainer>
                <Tabs.List aria-label="Filter Skills">
                    {tabs.map((tab) => (
                        <Tabs.Tab id={tab.id} key={tab.id}>
                            <span className="flex items-center gap-2">
                                {tab.label}
                                {counts[tab.id] === undefined ? null : (
                                    <span className="text-muted text-sm tabular-nums">
                                        {counts[tab.id]}
                                    </span>
                                )}
                            </span>
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
            </Tabs.ListContainer>
        </Tabs>
    );
}
