import { Card, Chip, SearchField } from '@heroui/react';
import * as React from 'react';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../layout/settings-page.tsx';
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

            <SettingsSection title="Detected Runtimes">
                <SettingsGroup>
                    {access.length > 0 ? (
                        access.map(({ computer, computerId, runtime }) => (
                            <SettingsRow
                                description={`${computer} · ${
                                    runtime.models.map((model) => model.label).join(', ') ||
                                    'No models reported'
                                }`}
                                key={`${computerId}:${runtime.id}`}
                                title={runtime.label}
                            >
                                <SettingsValue>
                                    <Chip color="success" size="sm" variant="soft">
                                        Detected
                                    </Chip>
                                </SettingsValue>
                            </SettingsRow>
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
                    <Chip size="sm" variant="soft">
                        {models.length}
                    </Chip>
                }
                title="Reported Models"
            >
                <SearchField aria-label="Search models" fullWidth onChange={setQuery} value={query}>
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Search models..." />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
                {models.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {models.map((model) => (
                            <Card key={model.id}>
                                <Card.Header>
                                    <Card.Title>{model.label}</Card.Title>
                                    <Card.Description>
                                        <span className="font-mono text-xs">{model.id}</span>
                                    </Card.Description>
                                </Card.Header>
                                <Card.Content>
                                    <div className="flex flex-wrap gap-1.5">
                                        {model.runtimes.map((runtime) => (
                                            <Chip key={runtime} size="sm" variant="secondary">
                                                {runtime}
                                            </Chip>
                                        ))}
                                        <Chip size="sm" variant="soft">
                                            {model.computerCount}{' '}
                                            {model.computerCount === 1 ? 'Computer' : 'Computers'}
                                        </Chip>
                                    </div>
                                </Card.Content>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="py-8 text-center text-muted text-sm">
                        {query ? 'No models match your search.' : 'No models reported yet.'}
                    </p>
                )}
            </SettingsSection>
        </SettingsPage>
    );
}
