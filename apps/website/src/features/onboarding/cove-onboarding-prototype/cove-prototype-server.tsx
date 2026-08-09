import { Button, Input, InputGroup, Label, TextField } from '@heroui/react';
import * as React from 'react';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import { slugifyServerName } from '../../servers/server-slug.ts';
import type { CovePrototypeState } from './cove-prototype-model.ts';
import { StepSection } from './cove-prototype-shell.tsx';

const prototypeServers = [
    { label: 'Arcade', slug: 'arcade' },
    { label: 'Grotto Community', slug: 'community' },
    { label: 'Grotto', slug: 'grotto' },
] as const;

/** Static preflight scene: choose the Server before its onboarding begins. */
export function ChooseServerStep({
    onStateChange,
}: {
    onStateChange: (state: CovePrototypeState) => void;
}) {
    return (
        <StepSection
            footer={
                <>
                    <Button variant="ghost">Log out</Button>
                    {/* Picking a Server above is the primary action here, so
                        creating one stays a subordinate variant. */}
                    <Button onPress={() => onStateChange('create-server')} variant="outline">
                        Create a Server
                    </Button>
                </>
            }
            title="Choose a Server"
        >
            <div className="grid gap-2">
                {prototypeServers.map((server) => (
                    <Button
                        className="h-auto justify-start py-3 text-start"
                        fullWidth
                        key={server.slug}
                        onPress={() => onStateChange('connect-computer')}
                        variant="outline"
                    >
                        <EntityAvatar name={server.label} size="sm" />
                        <span className="grid min-w-0 gap-0.5">
                            <span className="truncate font-medium">{server.label}</span>
                            <span className="truncate text-muted text-xs">/{server.slug}</span>
                        </span>
                    </Button>
                ))}
            </div>
        </StepSection>
    );
}

/** Static creation scene: form values are local only and never reach a Server. */
export function CreateServerStep({
    onStateChange,
}: {
    onStateChange: (state: CovePrototypeState) => void;
}) {
    const [name, setName] = React.useState('');
    const [slug, setSlug] = React.useState('');
    const [isSlugEdited, setIsSlugEdited] = React.useState(false);
    const canCreate = name.trim().length > 0 && slug.trim().length > 0;

    const handleNameChange = (nextName: string) => {
        setName(nextName);
        if (!isSlugEdited) {
            setSlug(slugifyServerName(nextName));
        }
    };

    const handleSlugChange = (nextSlug: string) => {
        setIsSlugEdited(true);
        setSlug(nextSlug);
    };

    return (
        <StepSection
            footer={
                <>
                    <Button onPress={() => onStateChange('choose-server')} variant="ghost">
                        Back
                    </Button>
                    <Button
                        isDisabled={!canCreate}
                        onPress={() => onStateChange('connect-computer')}
                    >
                        Create Server
                    </Button>
                </>
            }
            title="Create a Server"
        >
            <div className="grid gap-4">
                <TextField fullWidth onChange={handleNameChange} value={name} variant="primary">
                    <Label>Server name</Label>
                    <Input
                        autoComplete="off"
                        className="h-12 text-base sm:text-base"
                        name="server-name"
                        placeholder="Grotto HQ"
                    />
                </TextField>
                <TextField fullWidth onChange={handleSlugChange} value={slug} variant="primary">
                    <Label>URL slug</Label>
                    <InputGroup className="h-12" fullWidth variant="primary">
                        <InputGroup.Prefix className="text-base">
                            https://grotto.sh/s/
                        </InputGroup.Prefix>
                        <InputGroup.Input
                            autoComplete="off"
                            className="h-full text-base sm:text-base"
                            name="server-slug"
                            placeholder="grotto-hq"
                        />
                    </InputGroup>
                </TextField>
            </div>
        </StepSection>
    );
}
