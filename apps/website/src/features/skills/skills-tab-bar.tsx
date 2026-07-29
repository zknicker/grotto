import { TabsSubtle, TabsSubtleItem, TabsSubtleList } from '../../components/ui/tabs-subtle.tsx';

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
        <TabsSubtle
            aria-label="Filter skills"
            className="self-start"
            onValueChange={(nextValue) => onChange(nextValue as SkillsTab)}
            value={value}
        >
            <TabsSubtleList>
                {tabs.map((tab) => (
                    <TabsSubtleItem key={tab.id} size="sm" value={tab.id}>
                        <span>{tab.label}</span>
                        {counts[tab.id] === undefined ? null : (
                            <span className="font-mono text-meta text-muted-foreground tabular-nums">
                                {counts[tab.id]}
                            </span>
                        )}
                    </TabsSubtleItem>
                ))}
            </TabsSubtleList>
        </TabsSubtle>
    );
}
