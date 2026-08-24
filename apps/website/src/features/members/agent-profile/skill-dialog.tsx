import { Alert, AlertDialog, Button, Modal, TextArea } from '@heroui/react';
import type { Agent, AgentSkillMetadata } from '@tavern/api';
import * as React from 'react';
import { useSkillDelete } from '../../../hooks/members/use-skill-delete.ts';
import { useSkillFile } from '../../../hooks/members/use-skill-file.ts';
import { useSkillSave } from '../../../hooks/members/use-skill-save.ts';
import type { ServerDetail } from '../../../lib/grotto-server.tsx';

export function SkillDialog({
    agent,
    onOpenChange,
    server,
    skill,
}: {
    agent: Agent;
    onOpenChange(open: boolean): void;
    server: ServerDetail;
    skill: AgentSkillMetadata | null;
}) {
    const skillName = skill?.name ?? '';
    const file = useSkillFile(server.id, agent.id, skillName, Boolean(skill));
    const update = useSkillSave(server.id, agent.id, skillName);
    const remove = useSkillDelete(server.id, agent.id, skillName);
    const [content, setContent] = React.useState('');
    const [hash, setHash] = React.useState('');
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    React.useEffect(() => {
        if (file.data) {
            setContent(file.data.content);
            setHash(file.data.hash);
        }
    }, [file.data]);
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
                <Modal.Backdrop isDismissable>
                    <Modal.Container scroll="inside" size="lg">
                        <Modal.Dialog>
                            <Modal.CloseTrigger />
                            <Modal.Header>
                                <Modal.Heading>{skill?.name ?? 'Agent Skill'}</Modal.Heading>
                                <p className="mt-1.5 text-muted text-sm leading-5">
                                    Edit this Agent’s independent SKILL.md copy. Other support files
                                    stay unchanged.
                                </p>
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
                                    {error ? (
                                        <Alert role="alert" status="danger">
                                            <Alert.Indicator />
                                            <Alert.Content>
                                                <Alert.Description>{error}</Alert.Description>
                                            </Alert.Content>
                                        </Alert>
                                    ) : null}
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
                                    slot="close"
                                    type="button"
                                    variant="secondary"
                                >
                                    Close
                                </Button>
                                <Button
                                    isDisabled={
                                        file.isPending ||
                                        !file.data ||
                                        !isSkillDirty(content, file.data.content)
                                    }
                                    isPending={update.isPending}
                                    onPress={() => {
                                        if (!skill) {
                                            return;
                                        }
                                        void update.save(content, hash).then((updated) => {
                                            setContent(updated.content);
                                            setHash(updated.hash);
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
                <AlertDialog.Backdrop isDismissable>
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
                                        void remove.deleteSkill(hash).then(() => {
                                            setConfirmDelete(false);
                                            onOpenChange(false);
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

export function isSkillDirty(content: string, savedContent: string) {
    return content !== savedContent;
}
