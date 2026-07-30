import type { HostedAgent, HostedAgentSkillMetadata } from '@tavern/api';
import * as React from 'react';
import {
    AlertDialog,
    AlertDialogClose,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogPopup,
    AlertDialogTitle,
} from '../../../components/ui/alert-dialog.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../../../components/ui/dialog.tsx';
import { Button } from '../../../components/ui/primitives/button.tsx';
import { Textarea } from '../../../components/ui/textarea.tsx';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';
import { grottoTrpc } from '../../../lib/grotto-server.tsx';

export function AgentSkillFileDialog({
    agent,
    onOpenChange,
    server,
    skill,
}: {
    agent: HostedAgent;
    onOpenChange(open: boolean): void;
    server: ServerDetail;
    skill: HostedAgentSkillMetadata | null;
}) {
    const utils = grottoTrpc.useUtils();
    const input = { agentId: agent.id, name: skill?.name ?? '', serverId: server.id };
    const file = grottoTrpc.agent.skillFile.useQuery(input, { enabled: Boolean(skill) });
    const [content, setContent] = React.useState('');
    const [hash, setHash] = React.useState('');
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    React.useEffect(() => {
        if (file.data) {
            setContent(file.data.content);
            setHash(file.data.hash);
        }
    }, [file.data]);
    const update = grottoTrpc.agent.updateSkillFile.useMutation();
    const remove = grottoTrpc.agent.deleteSkillFile.useMutation();
    const refreshInventory = () => utils.computer.list.invalidate({ serverId: server.id });
    const error = update.error?.message ?? remove.error?.message ?? file.error?.message ?? null;

    return (
        <>
            <Dialog
                onOpenChange={(open) => {
                    if (!(open || update.isPending || remove.isPending)) {
                        onOpenChange(false);
                    }
                }}
                open={Boolean(skill)}
            >
                <DialogContent size="lg">
                    <DialogHeader>
                        <DialogTitle>{skill?.name ?? 'Agent skill'}</DialogTitle>
                        <DialogDescription>
                            Edit this Agent’s independent SKILL.md copy. Other support files stay
                            unchanged.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 px-6">
                        {file.isPending ? (
                            <p className="text-muted-foreground text-sm">Loading skill…</p>
                        ) : (
                            <Textarea
                                aria-label="SKILL.md content"
                                onChange={(event) => setContent(event.target.value)}
                                spellCheck={false}
                                textareaClassName="h-80 min-h-80 max-h-[50vh] resize-y overflow-auto font-mono text-sm [field-sizing:fixed]"
                                value={content}
                            />
                        )}
                        {error ? <p className="text-error text-sm">{error}</p> : null}
                    </div>
                    <DialogFooter variant="bare">
                        <Button
                            disabled={file.isPending || update.isPending || remove.isPending}
                            onClick={() => setConfirmDelete(true)}
                            type="button"
                            variant="destructive"
                        >
                            Delete
                        </Button>
                        <Button
                            disabled={update.isPending || remove.isPending}
                            onClick={() => onOpenChange(false)}
                            type="button"
                            variant="ghost"
                        >
                            Close
                        </Button>
                        <Button
                            disabled={
                                file.isPending ||
                                !file.data ||
                                !isAgentSkillFileDirty(content, file.data.content)
                            }
                            loading={update.isPending}
                            onClick={() => {
                                if (!skill) {
                                    return;
                                }
                                void update
                                    .mutateAsync({
                                        ...input,
                                        content,
                                        expectedHash: hash,
                                    })
                                    .then(async (updated) => {
                                        setContent(updated.content);
                                        setHash(updated.hash);
                                        utils.agent.skillFile.setData(input, updated);
                                        await refreshInventory();
                                    });
                            }}
                            type="button"
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog onOpenChange={setConfirmDelete} open={confirmDelete}>
                <AlertDialogPopup>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {skill?.name ?? 'this skill'}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes this Agent’s independent skill bundle. The
                            original host skill is not changed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogClose render={<Button variant="ghost" />}>
                            Keep skill
                        </AlertDialogClose>
                        <Button
                            loading={remove.isPending}
                            onClick={() => {
                                if (!skill) {
                                    return;
                                }
                                void remove
                                    .mutateAsync({ ...input, expectedHash: hash })
                                    .then(async () => {
                                        setConfirmDelete(false);
                                        onOpenChange(false);
                                        await refreshInventory();
                                    });
                            }}
                            type="button"
                            variant="destructive"
                        >
                            Delete skill
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogPopup>
            </AlertDialog>
        </>
    );
}

export function isAgentSkillFileDirty(content: string, savedContent: string) {
    return content !== savedContent;
}
