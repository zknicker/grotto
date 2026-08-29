import { Description, Label, ListBox, Select, Surface } from '@heroui/react';
import * as React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PageColumn } from '../shell/page-column.tsx';
import { GrottoUpdateFooter } from './grotto-update-footer.tsx';
import type { GrottoUpdateView } from './grotto-update-model.ts';
import { GrottoVersionSummary } from './grotto-version-summary.tsx';
import {
    findUpdatePreviewScene,
    type UpdatePreviewScene,
    updatePreviewScenePath,
    updatePreviewScenes,
} from './update-preview-scenes.ts';

export function UpdatePreviewRoute() {
    const { sceneId = '' } = useParams();
    const scene = findUpdatePreviewScene(sceneId);
    if (!scene) {
        const [first] = updatePreviewScenes;
        return first ? <Navigate replace to={updatePreviewScenePath(first)} /> : null;
    }
    return <UpdatePreview key={scene.id} scene={scene} />;
}

function UpdatePreview({ scene }: { scene: UpdatePreviewScene }) {
    const nextEventId = React.useRef(0);
    const [events, setEvents] = React.useState<PreviewEvent[]>([]);
    const record = React.useCallback((message: string) => {
        nextEventId.current += 1;
        const event = { id: nextEventId.current, message };
        setEvents((current) => [event, ...current].slice(0, 5));
    }, []);
    const onAction = React.useCallback(
        (action: NonNullable<GrottoUpdateView['primaryAction']>) => {
            record(`Would ${action.kind} Grotto ${scene.view.version}.`);
        },
        [record, scene.view.version]
    );

    return (
        <main className="flex min-h-dvh bg-background">
            <aside className="flex w-72 shrink-0 flex-col border-divider border-r bg-surface p-3">
                <div className="grid gap-1 px-2 py-3">
                    <p className="font-semibold text-foreground">Update preview</p>
                    <p className="text-muted text-sm">{scene.description}</p>
                </div>
                <div className="mt-auto">
                    <GrottoUpdateFooter
                        key={scene.id}
                        offlineComputers={scene.offlineComputers}
                        onAction={onAction}
                        onOpenComputer={(computerId) =>
                            record(`Would open Computer ${computerId}.`)
                        }
                        view={scene.view}
                    />
                </div>
            </aside>
            <div className="min-w-0 flex-1 overflow-y-auto">
                <PageColumn>
                    <header className="grid gap-1 px-4">
                        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                            Preferences
                        </h1>
                        <p className="text-muted text-sm">
                            The shared Settings view for this update state.
                        </p>
                    </header>
                    <GrottoVersionSummary view={scene.view} />
                    <Surface className="grid gap-2 p-4" variant="secondary">
                        <h2 className="font-medium text-foreground">Preview actions</h2>
                        {events.length > 0 ? (
                            <ol className="grid gap-1 font-mono text-sm">
                                {events.map((event) => (
                                    <li key={event.id}>{event.message}</li>
                                ))}
                            </ol>
                        ) : (
                            <p className="text-muted text-sm">
                                Actions are inert. Use the panel to inspect their intended sequence.
                            </p>
                        )}
                    </Surface>
                </PageColumn>
            </div>
            <ScenePicker scene={scene} />
        </main>
    );
}

interface PreviewEvent {
    id: number;
    message: string;
}

function ScenePicker({ scene }: { scene: UpdatePreviewScene }) {
    const navigate = useNavigate();
    return (
        <div className="fixed top-3 right-3 z-50 w-80">
            <Select
                aria-label="Update preview scene"
                fullWidth
                onChange={(value) => {
                    const next = findUpdatePreviewScene(String(value ?? ''));
                    if (next) {
                        navigate(updatePreviewScenePath(next));
                    }
                }}
                value={scene.id}
                variant="secondary"
            >
                <Select.Trigger>
                    <Select.Value>
                        {() => `${scene.group} · ${scene.id.replaceAll('-', ' ')}`}
                    </Select.Value>
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {updatePreviewScenes.map((option) => (
                            <ListBox.Item id={option.id} key={option.id} textValue={option.id}>
                                <Label>
                                    {option.group} · {option.id.replaceAll('-', ' ')}
                                </Label>
                                <Description>{option.description}</Description>
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
        </div>
    );
}
