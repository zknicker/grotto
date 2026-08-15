export interface PlanWindow {
    id: string;
    resetsAt: string | null;
    usedPercent: number;
}

export interface DisplayPlanWindow extends PlanWindow {
    label: string;
}

export function selectWindows(
    windows: PlanWindow[],
    selection: Array<readonly [id: string, label: string]>
): DisplayPlanWindow[] {
    return selection.flatMap(([id, label]) => {
        const window = windows.find((candidate) => candidate.id === id);
        return window ? [{ ...window, label }] : [];
    });
}

export function selectWindow(
    windows: PlanWindow[],
    id: string,
    label: string
): DisplayPlanWindow | null {
    const window = windows.find((candidate) => candidate.id === id);
    return window ? { ...window, label } : null;
}

export function selectFirstWindow(
    windows: PlanWindow[],
    ids: string[],
    label: string
): DisplayPlanWindow | null {
    for (const id of ids) {
        const window = selectWindow(windows, id, label);
        if (window) {
            return window;
        }
    }
    return null;
}

export function usageColor(usedPercent: number): 'accent' | 'danger' | 'warning' {
    if (usedPercent >= 90) {
        return 'danger';
    }
    return usedPercent >= 75 ? 'warning' : 'accent';
}
