import { AlertDialog, Button, Modal, TextArea } from '@heroui/react';
import type { HostedAgent, HostedAgentSkillMetadata } from '@tavern/api';
import * as React from 'react';
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
            <Modal
                isOpen={Boolean(skill)}
                onOpenChange={(open) => {
                    if (!(open || update.isPending || remove.isPending)) {
                        onOpenChange(false);
                    }
                }}
            >
                <Modal.Backdrop>
                    <Modal.Container scroll="outside" size="lg">
                        <Modal.Dialog>
                            <Modal.Header>
                                <div className="min-w-0 flex-1">
                                    <Modal.Heading>{skill?.name ?? 'Agent Skill'}</Modal.Heading>
                                    <p className="mt-1 text-muted text-sm">
                                        Edit this Agent’s independent SKILL.md copy. Other support
                                        files stay unchanged.
                                    </p>
                                </div>
                            </Modal.Header>
                            <Modal.Body>
                                <div className="grid gap-3">
                                    {file.isPending ? (
                                        <p className="text-muted text-sm">Loading skill…</p>
                                    ) : (
                                        <TextArea
                                            aria-label="SKILL.md content"
                                            className="h-80 resize-y font-mono"
                                            fullWidth
                                            onChange={(event) => setContent(event.target.value)}
                                            spellCheck={false}
                                            value={content}
                                            variant="secondary"
                                        />
                                    )}
                                    {error ? <p className="text-danger text-sm">{error}</p> : null}
                                </div>
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    isDisabled={
                                        file.isPending || update.isPending || remove.isPending
                                    }
                                    onPress={() => setConfirmDelete(true)}
                                    type="button"
                                    variant="danger-soft"
                                >
                                    Delete
                                </Button>
                                <Button
                                    isDisabled={update.isPending || remove.isPending}
                                    onPress={() => onOpenChange(false)}
                                    type="button"
                                    variant="secondary"
                                >
                                    Close
                                </Button>
                                <Button
                                    isDisabled={
                                        file.isPending ||
                                        !file.data ||
                                        !isAgentSkillFileDirty(content, file.data.content)
                                    }
                                    isPending={update.isPending}
                                    onPress={() => {
                                        if (!skill) {
                                            return;
                                        }
                                        void update
                                            .mutateAsync({ ...input, content, expectedHash: hash })
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
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
            <AlertDialog isOpen={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialog.Backdrop>
                    <AlertDialog.Container size="sm">
                        <AlertDialog.Dialog>
                            <AlertDialog.Header>
                                <AlertDialog.Icon status="danger" />
                                <AlertDialog.Heading>
                                    Delete {skill?.name ?? 'this skill'}?
                                </AlertDialog.Heading>
                            </AlertDialog.Header>
                            <AlertDialog.Body>
                                This permanently removes this Agent’s independent skill bundle. The
                                original host skill is not changed.
                            </AlertDialog.Body>
                            <AlertDialog.Footer>
                                <Button slot="close" variant="secondary">
                                    Keep Skill
                                </Button>
                                <Button
                                    isPending={remove.isPending}
                                    onPress={() => {
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
                                    variant="danger"
                                >
                                    Delete Skill
                                </Button>
                            </AlertDialog.Footer>
                        </AlertDialog.Dialog>
                    </AlertDialog.Container>
                </AlertDialog.Backdrop>
            </AlertDialog>
        </>
    );
}

export function isAgentSkillFileDirty(content: string, savedContent: string) {
    return content !== savedContent;
}
