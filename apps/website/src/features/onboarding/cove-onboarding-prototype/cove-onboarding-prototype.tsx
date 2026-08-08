import * as React from 'react';
import { ConnectComputerStep } from './cove-prototype-connect.tsx';
import { MeetCoveStep } from './cove-prototype-cove.tsx';
import { HandoffStep, OnboardingChatStep } from './cove-prototype-handoff.tsx';
import { type CovePrototypeState, isCovePrototypeState } from './cove-prototype-model.ts';
import { ReviewStateSelect, SetupProgressMarker } from './cove-prototype-review.tsx';
import { ChooseServerStep, CreateServerStep } from './cove-prototype-server.tsx';
import './cove-prototype.css';

const storageKey = 'grotto.cove-onboarding-prototype.state.v2';

/**
 * PRD-190 review prototype: every Cove onboarding state as static content, in
 * the app frame it will ship in. No Server, Computer, or Agent calls.
 */
export function CoveOnboardingPrototype() {
    const [state, setState] = React.useState<CovePrototypeState>('choose-server');
    const [runtimeId, setRuntimeId] = React.useState('codex');
    const [modelId, setModelId] = React.useState('gpt-5.5');
    const [isHydrated, setIsHydrated] = React.useState(false);

    React.useEffect(() => {
        const saved = window.localStorage.getItem(storageKey);
        if (saved && isCovePrototypeState(saved)) {
            setState(saved);
        }
        setIsHydrated(true);
    }, []);

    React.useEffect(() => {
        if (isHydrated) {
            window.localStorage.setItem(storageKey, state);
        }
    }, [isHydrated, state]);

    const handleStateChange = React.useCallback((nextState: CovePrototypeState) => {
        setState(nextState);
    }, []);

    // The validation state has to render as empty selects; every other state
    // keeps whatever the reviewer picked.
    const isValidationPreview = state === 'validation-error';

    return (
        <div className="cove-prototype min-h-dvh bg-background text-foreground">
            <header className="cove-frame-header">
                {isServerSelectionState(state) ? null : <SetupProgressMarker state={state} />}
                <div className="cove-review-controls">
                    <ReviewStateSelect onStateChange={handleStateChange} state={state} />
                </div>
            </header>
            <main className="cove-frame-main">
                {renderState({
                    modelId: isValidationPreview ? '' : modelId,
                    onModelChange: setModelId,
                    onRuntimeChange: setRuntimeId,
                    onStateChange: handleStateChange,
                    runtimeId: isValidationPreview ? '' : runtimeId,
                    state,
                })}
            </main>
        </div>
    );
}

function renderState({
    modelId,
    onModelChange,
    onRuntimeChange,
    onStateChange,
    runtimeId,
    state,
}: {
    modelId: string;
    onModelChange: (modelId: string) => void;
    onRuntimeChange: (runtimeId: string) => void;
    onStateChange: (state: CovePrototypeState) => void;
    runtimeId: string;
    state: CovePrototypeState;
}) {
    switch (state) {
        case 'choose-server':
            return <ChooseServerStep onStateChange={onStateChange} />;
        case 'create-server':
            return <CreateServerStep onStateChange={onStateChange} />;
        case 'meet-cove':
        case 'validation-error':
        case 'creating-cove':
        case 'creation-failed':
            return (
                <MeetCoveStep
                    modelId={modelId}
                    onModelChange={onModelChange}
                    onRuntimeChange={onRuntimeChange}
                    onStateChange={onStateChange}
                    runtimeId={runtimeId}
                    state={state}
                />
            );
        case 'handoff':
            return <HandoffStep onStateChange={onStateChange} />;
        case 'onboarding-chat':
            return <OnboardingChatStep />;
        default:
            return <ConnectComputerStep onStateChange={onStateChange} state={state} />;
    }
}

function isServerSelectionState(state: CovePrototypeState): boolean {
    return state === 'choose-server' || state === 'create-server';
}
