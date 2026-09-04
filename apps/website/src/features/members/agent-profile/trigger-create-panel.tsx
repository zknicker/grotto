import { type Agent, type Trigger, triggerTitleMaxLength } from '@grotto/api';
import { Alert, Button, FieldError, Form, Input, Label, TextArea, TextField } from '@heroui/react';
import { Sheet } from '@heroui-pro/react';
import * as React from 'react';
import { useTriggerCreate } from '../../../hooks/members/use-trigger-create.ts';
import {
    canCreateTrigger,
    type TriggerDraft,
    triggerInstructionIssue,
    triggerKindOptions,
    triggerTitleIssue,
} from './agent-trigger-model.ts';
import { TriggerKindPicker } from './trigger-kind-picker.tsx';
import type { TriggerMintedSecret } from './trigger-webhook-card.tsx';

/** Footer actions live outside the form; they submit it by id. */
const TRIGGER_CREATE_FORM_ID = 'trigger-create-form';

/**
 * Authoring a Trigger in the order a person thinks about one: what to call it,
 * what the Agent should do, then what wakes it. Creating hands the drawer both
 * the new record and the secret that came with it.
 */
export function TriggerCreatePanel({
    agent,
    onCancel,
    onCreated,
    serverId,
}: {
    agent: Agent;
    onCancel: () => void;
    onCreated: (trigger: Trigger, secret: TriggerMintedSecret) => void;
    serverId: string;
}) {
    const create = useTriggerCreate(serverId, agent.id);
    const [draft, setDraft] = React.useState<TriggerDraft>({
        instruction: '',
        kind: null,
        title: '',
    });

    const titleIssue = triggerTitleIssue(draft.title);
    const instructionIssue = triggerInstructionIssue(draft.instruction);
    const canSubmit = canCreateTrigger(draft) && !create.isPending;

    return (
        <>
            <Sheet.Header>
                <Sheet.Heading>New trigger</Sheet.Heading>
                <p className="mt-1.5 text-muted text-sm leading-5">
                    Wake {agent.displayName} when something outside Grotto happens.
                </p>
            </Sheet.Header>
            <Sheet.Body>
                <Form
                    className="grid gap-6"
                    id={TRIGGER_CREATE_FORM_ID}
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!(canSubmit && draft.kind)) {
                            return;
                        }
                        const instruction = draft.instruction.trim();
                        void create
                            .create({
                                kind: draft.kind,
                                title: draft.title.trim(),
                                ...(instruction ? { instruction } : {}),
                            })
                            .then((result) =>
                                onCreated(result.trigger, {
                                    curl: result.curl,
                                    minted: 'created',
                                    secret: result.secret,
                                    triggerId: result.trigger.id,
                                    url: result.url,
                                })
                            )
                            .catch(() => undefined);
                    }}
                >
                    <TextField
                        fullWidth
                        isDisabled={create.isPending}
                        isInvalid={Boolean(titleIssue)}
                        onChange={(title) => setDraft((current) => ({ ...current, title }))}
                        value={draft.title}
                        variant="secondary"
                    >
                        <Label>Name</Label>
                        <Input
                            autoFocus
                            maxLength={triggerTitleMaxLength}
                            placeholder="Deploy finished"
                        />
                        {titleIssue ? <FieldError>{titleIssue}</FieldError> : null}
                    </TextField>
                    <TextField
                        fullWidth
                        isDisabled={create.isPending}
                        isInvalid={Boolean(instructionIssue)}
                        onChange={(instruction) =>
                            setDraft((current) => ({ ...current, instruction }))
                        }
                        value={draft.instruction}
                        variant="secondary"
                    >
                        <Label>Instruction</Label>
                        <TextArea
                            placeholder={`What should ${agent.displayName} do each time it fires?`}
                            rows={4}
                        />
                        {instructionIssue ? <FieldError>{instructionIssue}</FieldError> : null}
                    </TextField>
                    <TriggerKindPicker
                        isDisabled={create.isPending}
                        kinds={triggerKindOptions}
                        onChange={(kind) => setDraft((current) => ({ ...current, kind }))}
                        value={draft.kind}
                    />
                    {create.error ? (
                        <Alert role="alert" status="danger">
                            <Alert.Indicator />
                            <Alert.Content>
                                <Alert.Description>{create.error.message}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    ) : null}
                </Form>
            </Sheet.Body>
            <Sheet.Footer>
                <Button
                    isDisabled={create.isPending}
                    onPress={onCancel}
                    type="button"
                    variant="secondary"
                >
                    Cancel
                </Button>
                <Button
                    form={TRIGGER_CREATE_FORM_ID}
                    isDisabled={!canSubmit}
                    isPending={create.isPending}
                    type="submit"
                >
                    Create
                </Button>
            </Sheet.Footer>
        </>
    );
}
