import { Button, Input, Label, TextField } from '@heroui/react';
import { ActivationStep } from '../../../components/activation/activation-shell.tsx';
import { EntityAvatar } from '../../../components/ui/entity-avatar.tsx';
import type { CovePrototypeState } from './cove-prototype-model.ts';

const onboardingMessages = [
    {
        body: 'Hi — I’m Cove. I help you turn this Server into a working Agent team. Anything you need here, just ask me.',
        time: '10:02 PM',
    },
    {
        body: 'Want me to look at what’s already on this Computer and propose a starter team? Or just tell me what you’re working on.',
        time: '10:02 PM',
    },
];

/** Step 3a. Setup is done; the only thing left is opening the Chat. */
export function HandoffStep({
    onStateChange,
}: {
    onStateChange: (state: CovePrototypeState) => void;
}) {
    return (
        <ActivationStep
            footer={
                <Button fullWidth onPress={() => onStateChange('onboarding-chat')}>
                    Open onboarding Chat
                </Button>
            }
            title="Cove takes it from here"
        >
            <div className="flex flex-col items-center gap-4 text-center">
                <EntityAvatar name="Cove" size={88} src="/prototypes/cove-avatar.png" />
            </div>
        </ActivationStep>
    );
}

/** Step 3b. The App is unlocked — this is the real Chat, not a setup card. */
export function OnboardingChatStep() {
    return (
        <ActivationStep
            footer={
                <TextField className="w-full" isDisabled>
                    <Label className="sr-only">Message #onboarding-owner</Label>
                    <Input placeholder="Message #onboarding-owner" variant="secondary" />
                </TextField>
            }
            title="#onboarding-owner"
        >
            <div className="grid gap-4">
                {onboardingMessages.map((message) => (
                    <div className="flex gap-3" key={message.time + message.body}>
                        <EntityAvatar name="Cove" size="sm" src="/prototypes/cove-avatar.png" />
                        <div className="grid min-w-0 gap-1">
                            <p className="flex flex-wrap items-baseline gap-2">
                                <span className="font-semibold text-sm">Cove</span>
                                <span className="text-muted text-xs">
                                    Onboarding Assistant · {message.time}
                                </span>
                            </p>
                            <p className="text-base sm:text-sm">{message.body}</p>
                        </div>
                    </div>
                ))}
            </div>
        </ActivationStep>
    );
}
