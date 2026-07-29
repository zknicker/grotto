import * as React from 'react';
import { Badge } from '../../../components/ui/badge.tsx';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../../../components/ui/card.tsx';
import { SearchInput } from '../../../components/ui/primitives/search-input.tsx';
import { Separator } from '../../../components/ui/separator.tsx';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../../../components/ui/settings-row.tsx';
import {
    buildHostedModelCatalog,
    buildRuntimeAccess,
    type HostedModelsComputer,
} from './hosted-catalog.ts';

export function HostedModelsSettings({ computers }: { computers: HostedModelsComputer[] }) {
    const [query, setQuery] = React.useState('');
    const access = buildRuntimeAccess(computers);
    const normalizedQuery = query.trim().toLowerCase();
    const models = buildHostedModelCatalog(computers).filter(
        (model) =>
            !normalizedQuery ||
            model.label.toLowerCase().includes(normalizedQuery) ||
            model.id.toLowerCase().includes(normalizedQuery) ||
            model.runtimes.some((runtime) => runtime.toLowerCase().includes(normalizedQuery))
    );

    return (
        <SettingsPage>
            <SettingsPageHeader
                description="Models reported by runtimes detected on your Computers."
                title="Models"
            />

            <SettingsSection title="Detected runtimes">
                <SettingsGroup>
                    {access.length > 0 ? (
                        access.map(({ computer, computerId, runtime }, index) => (
                            <React.Fragment key={`${computerId}:${runtime.id}`}>
                                {index > 0 ? <Separator /> : null}
                                <SettingsRow
                                    description={`${computer} · ${
                                        runtime.models.map((model) => model.label).join(', ') ||
                                        'No models reported'
                                    }`}
                                    title={runtime.label}
                                >
                                    <SettingsValue>
                                        <Badge size="sm" variant="success">
                                            Detected
                                        </Badge>
                                    </SettingsValue>
                                </SettingsRow>
                            </React.Fragment>
                        ))
                    ) : (
                        <SettingsRow
                            description="Attach a Computer with a detected runtime."
                            title="No runtimes detected"
                        >
                            <SettingsValue>Waiting for a Computer</SettingsValue>
                        </SettingsRow>
                    )}
                </SettingsGroup>
            </SettingsSection>

            <SettingsSection
                action={
                    <Badge size="sm" variant="subtle">
                        {models.length}
                    </Badge>
                }
                title="Reported models"
            >
                <SearchInput
                    aria-label="Search models"
                    onChange={(event) => setQuery(event.currentTarget.value)}
                    placeholder="Search models..."
                    size="sm"
                    value={query}
                />
                {models.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {models.map((model) => (
                            <Card key={model.id}>
                                <CardHeader className="p-4 pb-3">
                                    <CardTitle className="text-sm">{model.label}</CardTitle>
                                    <CardDescription className="font-mono text-meta">
                                        {model.id}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-wrap gap-1.5 p-4 pt-0">
                                    {model.runtimes.map((runtime) => (
                                        <Badge key={runtime} size="sm" variant="secondary">
                                            {runtime}
                                        </Badge>
                                    ))}
                                    <Badge size="sm" variant="subtle">
                                        {model.computerCount}{' '}
                                        {model.computerCount === 1 ? 'Computer' : 'Computers'}
                                    </Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="py-8 text-center text-muted-foreground text-sm">
                        {query ? 'No models match your search.' : 'No models reported yet.'}
                    </p>
                )}
            </SettingsSection>
        </SettingsPage>
    );
}
