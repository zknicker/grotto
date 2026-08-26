import {
    avatarGenerationConceptMaxLength,
    type GeneratedAvatar,
} from '@grotto/api/avatar-generation';
import {
    Alert,
    Button,
    Description,
    FieldError,
    Form,
    Input,
    Label,
    Modal,
    TextField,
} from '@heroui/react';

const avatarGenerationFormId = 'agent-avatar-generation-form';

export interface AvatarGenerationDialogProps {
    concept: string;
    conceptError?: string | null;
    error: string | null;
    isGenerating: boolean;
    isSaving: boolean;
    name: string;
    onConceptChange: (concept: string) => void;
    onGenerate: () => void;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    open: boolean;
    preview: GeneratedAvatar | null;
}

/** Presentational generation flow: concept, one preview, explicit save/cancel. */
export function AvatarGenerationDialog({
    concept,
    conceptError = null,
    error,
    isGenerating,
    isSaving,
    name,
    onConceptChange,
    onGenerate,
    onOpenChange,
    onSave,
    open,
    preview,
}: AvatarGenerationDialogProps) {
    const busy = isGenerating || isSaving;

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable={!busy}>
                <Modal.Container size="md">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Generate avatar</Modal.Heading>
                            <p className="mt-1.5 text-muted text-sm leading-5">
                                Describe a short concept for one preview. Agent name and description
                                are not used.
                            </p>
                        </Modal.Header>
                        <Modal.Body>
                            <AvatarGenerationFields
                                concept={concept}
                                conceptError={conceptError}
                                error={error}
                                name={name}
                                onConceptChange={onConceptChange}
                                onGenerate={onGenerate}
                                preview={preview}
                            />
                        </Modal.Body>
                        <Modal.Footer>
                            <AvatarGenerationActions
                                busy={busy}
                                concept={concept}
                                error={error}
                                isGenerating={isGenerating}
                                isSaving={isSaving}
                                onSave={onSave}
                                preview={preview}
                            />
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

export function AvatarGenerationFields({
    concept,
    conceptError = null,
    error,
    name,
    onConceptChange,
    onGenerate,
    preview,
}: Pick<
    AvatarGenerationDialogProps,
    'concept' | 'conceptError' | 'error' | 'name' | 'onConceptChange' | 'onGenerate' | 'preview'
>) {
    return (
        <Form
            className="grid gap-4"
            id={avatarGenerationFormId}
            onSubmit={(event) => {
                event.preventDefault();
                onGenerate();
            }}
        >
            <TextField
                fullWidth
                isInvalid={Boolean(conceptError)}
                isRequired
                onChange={onConceptChange}
                value={concept}
                variant="secondary"
            >
                <Label>Concept</Label>
                <Input
                    autoFocus
                    maxLength={avatarGenerationConceptMaxLength}
                    placeholder="e.g. a moonlit fox cartographer"
                />
                <Description>
                    Keep it short; up to {avatarGenerationConceptMaxLength} characters.
                </Description>
                {conceptError ? <FieldError>{conceptError}</FieldError> : null}
            </TextField>
            {preview ? (
                <div className="flex justify-center rounded-xl bg-surface-secondary p-4">
                    <img
                        alt={`${name} generated avatar preview`}
                        className="size-40 rounded-xl"
                        height={256}
                        src={avatarPreviewSource(preview)}
                        width={256}
                    />
                </div>
            ) : (
                <div className="rounded-xl border border-separator border-dashed p-6 text-center text-muted text-sm">
                    Your generated avatar preview will appear here. Nothing changes until you save
                    it.
                </div>
            )}
            {error ? (
                <Alert role="alert" status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                        <Alert.Description>{error}</Alert.Description>
                    </Alert.Content>
                </Alert>
            ) : null}
        </Form>
    );
}

export function AvatarGenerationActions({
    busy,
    concept,
    error,
    isGenerating,
    isSaving,
    onSave,
    preview,
}: Pick<
    AvatarGenerationDialogProps,
    'concept' | 'error' | 'isGenerating' | 'isSaving' | 'onSave' | 'preview'
> & { busy: boolean }) {
    return (
        <>
            <Button isDisabled={busy} slot="close" type="button" variant="secondary">
                Cancel
            </Button>
            <Button
                form={avatarGenerationFormId}
                isDisabled={busy || concept.trim().length === 0}
                isPending={isGenerating}
                type="submit"
                variant="secondary"
            >
                {error ? 'Try again' : preview ? 'Generate another' : 'Generate preview'}
            </Button>
            <Button
                isDisabled={!preview || busy}
                isPending={isSaving}
                onPress={onSave}
                type="button"
            >
                Save avatar
            </Button>
        </>
    );
}

function avatarPreviewSource(preview: GeneratedAvatar) {
    return `data:${preview.mediaType};base64,${preview.bytesBase64}`;
}
