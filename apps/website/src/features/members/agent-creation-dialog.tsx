import type { Agent, ComputerInventory } from '@grotto/api';
import { Alert, Modal, Spinner } from '@heroui/react';
import { useComputers } from '../../hooks/servers/use-computers.ts';
import { computerLabel } from '../computers/presentation.ts';
import {
    AgentCreationForm,
    type AgentCreationInitialValues,
    type AgentCreationSubmitValues,
    type ReportedComputer,
} from './agent-creation-form.tsx';

interface AgentCreationDialogProps {
    agents: readonly Agent[];
    error: { message: string } | null;
    initialValues?: AgentCreationInitialValues;
    isPending: boolean;
    onCreated: (agentId: string) => void;
    onOpenChange: (open: boolean) => void;
    onSubmit: (values: AgentCreationSubmitValues) => Promise<{ agentId: string }>;
    open: boolean;
    serverId: string;
}

export function AgentCreationDialog({
    agents,
    error,
    initialValues,
    isPending,
    onCreated,
    onOpenChange,
    onSubmit,
    open,
    serverId,
}: AgentCreationDialogProps) {
    const computers = useComputers(serverId, { enabled: open });
    const reported: ReportedComputer[] = (computers.data ?? [])
        .filter((computer) => (computer.reportedInventory?.runtimes.length ?? 0) > 0)
        .map((computer) => ({
            id: computer.id,
            inventory: computer.reportedInventory as ComputerInventory,
            label: computerLabel(computer),
        }));

    return (
        <Modal isOpen={open} onOpenChange={onOpenChange}>
            <Modal.Backdrop isDismissable>
                <Modal.Container scroll="inside" size="lg">
                    <Modal.Dialog>
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>Create Agent</Modal.Heading>
                            <p className="mt-1.5 text-muted text-sm leading-5">
                                Choose where this Agent runs and tune its starting configuration.
                            </p>
                        </Modal.Header>
                        {computers.isPending ? (
                            <Modal.Body>
                                <div className="flex min-h-32 items-center justify-center">
                                    <Spinner />
                                </div>
                            </Modal.Body>
                        ) : computers.error ? (
                            <Modal.Body>
                                <Alert status="danger">
                                    <Alert.Indicator />
                                    <Alert.Content>
                                        <Alert.Description>
                                            {computers.error.message}
                                        </Alert.Description>
                                    </Alert.Content>
                                </Alert>
                            </Modal.Body>
                        ) : (
                            <AgentCreationForm
                                agents={agents}
                                error={error}
                                initialValues={initialValues}
                                isPending={isPending}
                                onCreated={onCreated}
                                onSubmit={onSubmit}
                                reported={reported}
                            />
                        )}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
