import type { GeneratedAvatar } from '@grotto/api';
import { Button } from '@heroui/react';
import { AiMagicIcon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { Icon } from '../../../components/ui/icon.tsx';
import { useAgentAvatar } from '../../../hooks/members/use-agent-avatar.ts';
import { useAgentAvatarGeneration } from '../../../hooks/members/use-agent-avatar-generation.ts';
import {
    AvatarGenerationDialog,
    type AvatarGenerationDialogProps,
} from './agent-avatar-generation-dialog.tsx';

export function AgentAvatarGenerator({
    agentId,
    name,
    serverId,
}: {
    agentId: string;
    name: string;
    serverId: string;
}) {
    const generation = useAgentAvatarGeneration(serverId, agentId);
    const setAvatar = useAgentAvatar(serverId, agentId);
    const [concept, setConcept] = React.useState('');
    const [conceptError, setConceptError] = React.useState<string | null>(null);
    const [open, setOpen] = React.useState(false);
    const [preview, setPreview] = React.useState<GeneratedAvatar | null>(null);
    const generationRun = React.useRef(0);
    const busy = generation.isPending || setAvatar.isPending;

    const resetTransientState = React.useCallback(() => {
        generationRun.current += 1;
        setConcept('');
        setConceptError(null);
        setPreview(null);
        generation.reset();
        setAvatar.reset();
    }, [generation.reset, setAvatar.reset]);

    const handleOpenChange = React.useCallback(
        (nextOpen: boolean) => {
            if (!nextOpen && busy) {
                return;
            }
            setOpen(nextOpen);
            if (!nextOpen) {
                resetTransientState();
            }
        },
        [busy, resetTransientState]
    );

    const handleGenerate = React.useCallback(async () => {
        const trimmedConcept = concept.trim();
        if (!trimmedConcept) {
            setConceptError('Enter a short concept before generating an avatar.');
            return;
        }

        setConceptError(null);
        generation.reset();
        const run = generationRun.current + 1;
        generationRun.current = run;

        try {
            const result = await generation.generate(trimmedConcept);
            if (generationRun.current === run) {
                setPreview(result.avatar);
            }
        } catch {
            // The mutation error stays visible and the preview remains retryable.
        }
    }, [concept, generation.generate, generation.reset]);

    const handleSave = React.useCallback(async () => {
        if (!preview || busy) {
            return;
        }

        try {
            await setAvatar.mutateAsync({
                bytesBase64: preview.bytesBase64,
                mediaType: preview.mediaType,
                serverId,
                target: { agentId, kind: 'agent' },
            });
            handleOpenChange(false);
        } catch {
            // Keep the preview and Save action available for an ordinary-save retry.
        }
    }, [agentId, busy, handleOpenChange, preview, serverId, setAvatar.mutateAsync]);

    const dialogProps: AvatarGenerationDialogProps = {
        concept,
        conceptError,
        error: generation.error?.message ?? setAvatar.error?.message ?? null,
        isGenerating: generation.isPending,
        isSaving: setAvatar.isPending,
        name,
        onConceptChange: (nextConcept) => {
            setConcept(nextConcept);
            if (conceptError && nextConcept.trim()) {
                setConceptError(null);
            }
        },
        onGenerate: () => {
            void handleGenerate();
        },
        onOpenChange: handleOpenChange,
        onSave: () => {
            void handleSave();
        },
        open,
        preview,
    };

    return (
        <>
            <Button
                aria-label="Generate Agent avatar"
                onPress={() => setOpen(true)}
                size="sm"
                variant="ghost"
            >
                <Icon aria-hidden="true" className="size-4" icon={AiMagicIcon} />
                Generate avatar
            </Button>
            <AvatarGenerationDialog {...dialogProps} />
        </>
    );
}
