import * as React from 'react';
import { Alert, AlertDescription } from '../../components/ui/alert.tsx';
import { Drawer, DrawerPanel, DrawerPopup } from '../../components/ui/drawer.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { Input } from '../../components/ui/primitives/input.tsx';
import { Elevated } from '../../components/ui/surface.tsx';
import type { ChatListItem } from './chat-list-data.ts';

interface ChatEditorDrawerProps {
    chat: ChatListItem | null;
    errorMessage: string | null;
    isOpen: boolean;
    isPending: boolean;
    onClose: () => void;
    onSubmit: (input: { agentIds: string[]; displayName: string }) => Promise<void>;
}

export function ChatEditorDrawer({
    chat,
    errorMessage,
    isOpen,
    isPending,
    onClose,
    onSubmit,
}: ChatEditorDrawerProps) {
    const [displayName, setDisplayName] = React.useState('');

    React.useEffect(() => {
        setDisplayName(chat?.displayName ?? '');
    }, [chat]);

    const handleSubmit = React.useEffectEvent(async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await onSubmit({
            agentIds: chat?.boundAgentIds ?? [],
            displayName,
        });
    });

    const canSubmit =
        displayName.trim().length > 0 && (chat?.boundAgentIds.length ?? 0) > 0 && !isPending;

    return (
        <Drawer onOpenChange={(open) => !open && onClose()} open={isOpen} position="right">
            <DrawerPopup className="w-[min(96vw,34rem)] max-w-[min(96vw,34rem)]" variant="inset">
                <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
                    <div className="flex items-center gap-2 px-5 pt-3 pb-3">
                        <Input
                            autoFocus
                            className="min-w-0 flex-1"
                            onChange={(event) => setDisplayName(event.target.value)}
                            placeholder="Chat name"
                            value={displayName}
                        />
                        <Button onClick={onClose} size="sm" type="button" variant="ghost">
                            Cancel
                        </Button>
                        <Button disabled={!canSubmit} size="sm" type="submit">
                            {isPending ? 'Saving...' : 'Save chat'}
                        </Button>
                    </div>

                    <DrawerPanel className="min-h-0 flex-1 p-0!" scrollFade={false}>
                        <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
                            <Elevated className="rounded-xl p-4" offset={1}>
                                <div className="font-medium text-foreground text-sm">Agent</div>
                                <p className="mt-1 text-muted-foreground text-sm leading-6">
                                    This chat uses Grotto&apos;s synced agent.
                                </p>
                            </Elevated>

                            {errorMessage ? (
                                <Alert className="mt-4" variant="error">
                                    <AlertDescription>{errorMessage}</AlertDescription>
                                </Alert>
                            ) : null}
                        </div>
                    </DrawerPanel>
                </form>
            </DrawerPopup>
        </Drawer>
    );
}
