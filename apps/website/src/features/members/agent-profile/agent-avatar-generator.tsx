import type { GeneratedAvatar } from '@grotto/api';
import * as React from 'react';
import { useAgentAvatar } from '../../../hooks/members/use-agent-avatar.ts';
import { useAgentAvatarGeneration } from '../../../hooks/members/use-agent-avatar-generation.ts';
import {
    AvatarGenerationDialog,
    type AvatarGenerationDialogProps,
} from './agent-avatar-generation-dialog.tsx';

/** The generation dialog alone; the opener owns `open` (the avatar menu). */
export function AgentAvatarGenerator({
    agentId,
    name,
    onOpenChange,
    open,
    serverId,
}: {
    agentId: string;
    name: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    serverId: string;
}) {
    const generation = useAgentAvatarGeneration(serverId, agentId);
    const setAvatar = useAgentAvatar(serverId, agentId);
    const [concept, setConcept] = React.useState('');
    const [conceptError, setConceptError] = React.useState<string | null>(null);
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
            onOpenChange(nextOpen);
            if (!nextOpen) {
                resetTransientState();
            }
        },
        [busy, onOpenChange, resetTransientState]
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

    return <AvatarGenerationDialog {...dialogProps} />;
}
