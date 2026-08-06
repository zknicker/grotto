import type { HostedComputerInventory } from '@tavern/api';
import { type ComputerPresentation, computerLabel } from '../../computers/presentation.ts';

export interface ModelsComputer extends ComputerPresentation {
    reportedInventory: HostedComputerInventory | null;
}

export interface HostedModelCatalogItem {
    computerCount: number;
    id: string;
    label: string;
    runtimes: string[];
}

export function buildModelCatalog(computers: ModelsComputer[]) {
    const models = new Map<
        string,
        { computers: Set<string>; id: string; label: string; runtimes: Set<string> }
    >();

    for (const computer of computers) {
        for (const runtime of computer.reportedInventory?.runtimes ?? []) {
            for (const model of runtime.models) {
                const item = models.get(model.id) ?? {
                    computers: new Set<string>(),
                    id: model.id,
                    label: model.label,
                    runtimes: new Set<string>(),
                };
                item.computers.add(computer.id);
                item.runtimes.add(runtime.label);
                models.set(model.id, item);
            }
        }
    }

    return [...models.values()]
        .map((model) => ({
            computerCount: model.computers.size,
            id: model.id,
            label: model.label,
            runtimes: [...model.runtimes].sort(),
        }))
        .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildRuntimeAccess(computers: ModelsComputer[]) {
    return computers.flatMap((computer) =>
        (computer.reportedInventory?.runtimes ?? []).map((runtime) => ({
            computer: computerLabel(computer),
            computerId: computer.id,
            runtime,
        }))
    );
}
