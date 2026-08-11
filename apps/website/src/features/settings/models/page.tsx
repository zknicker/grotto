import { Alert, Card, Chip, SearchField } from '@heroui/react';
import * as React from 'react';
import { useComputers } from '../../../hooks/servers/use-computers.ts';
import {
    SettingsGroup,
    SettingsPage,
    SettingsPageHeader,
    SettingsRow,
    SettingsSection,
    SettingsValue,
} from '../layout/settings-page.tsx';
import { buildModelCatalog, buildRuntimeAccess, type ModelsComputer } from './model-catalog.ts';

export function ModelsSettings({ serverId }: { serverId: string }) {
    const computers = useComputers(serverId);
    const [query, setQuery] = React.useState('');
    const items: ModelsComputer[] = computers.data ?? [];
    const access = buildRuntimeAccess(items);
    const normalizedQuery = query.trim().toLowerCase();
    const models = buildModelCatalog(items).filter(
        (model) =>
            !normalizedQuery ||
            model.label.toLowerCase().includes(normalizedQuery) ||
            model.id.toLowerCase().includes(normalizedQuery) ||
            model.runtimes.some((runtime) => runtime.toLowerCase().includes(normalizedQuery))
    );

    if (computers.error && !computers.data) {
        return (
            <SettingsPage>
                <SettingsPageHeader
                    description="Models reported by runtimes detected on your Computers."
                    title="Models"
                />
                <Alert role="alert" status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Title>Computer inventory unavailable</Alert.Title>
                        <Alert.Description>{computers.error.message}</Alert.Description>
                    </Alert.Content>
                </Alert>
            </SettingsPage>
        );
    }

    return (
        <SettingsPage>
            <SettingsPageHeader
                description="Models reported by runtimes detected on your Computers."
                title="Models"
            />

            <SettingsSection title="Detected Runtimes">
                {!computers.data && computers.isPending ? (
                    <SettingsGroup aria-busy="true">
                        <div className="min-h-24">
                            <span className="sr-only">Loading detected runtimes</span>
                        </div>
                    </SettingsGroup>
                ) : (
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
                )}
            </SettingsSection>

            <SettingsSection
                action={
                    computers.data ? (
                        <Chip size="sm" variant="soft">
                            {models.length}
                        </Chip>
                    ) : null
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
                {!computers.data && computers.isPending ? (
                    <div aria-busy="true" className="min-h-48">
                        <span className="sr-only">Loading reported models</span>
                    </div>
                ) : models.length > 0 ? (
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
