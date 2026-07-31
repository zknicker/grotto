import { ComputerIcon } from '@hugeicons-pro/core-stroke-rounded';
import { CodeSnippet } from '../../components/ui/code-snippet.tsx';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogPanel,
    DialogTitle,
} from '../../components/ui/dialog.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';

export function AddComputerDialog({
    onOpenChange,
    open,
    serverSlug,
}: {
    onOpenChange: (open: boolean) => void;
    open: boolean;
    serverSlug: string;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add Computer</DialogTitle>
                    <DialogDescription>
                        Run Agents on an Apple Silicon Mac you control.
                    </DialogDescription>
                </DialogHeader>
                <DialogPanel className="grid gap-4">
                    <div className="rounded-xl border border-border-strong bg-card p-4">
                        <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                                <Icon aria-hidden="true" icon={ComputerIcon} />
                            </span>
                            <div className="min-w-0">
                                <h3 className="font-medium text-foreground text-sm">
                                    Your Computer
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    Run Agents on your own Computer.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <p className="font-medium text-foreground text-sm">1. Install</p>
                        <CodeSnippet lines="curl -fsSL https://releases.grotto.sh/computer/install.sh | sh" />
                    </div>
                    <div className="grid gap-2">
                        <p className="font-medium text-foreground text-sm">2. Set up</p>
                        <CodeSnippet lines={`grotto-computer setup /${serverSlug}`} />
                    </div>
                    <div className="rounded-xl border border-border-subtle border-dashed bg-legacy-muted p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="font-medium text-foreground text-sm">
                                    Cloud Computer
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    Managed execution without your own Mac.
                                </p>
                            </div>
                            <span className="font-mono text-meta text-muted-foreground uppercase">
                                Coming soon
                            </span>
                        </div>
                    </div>
                </DialogPanel>
                <DialogFooter variant="bare">
                    <Button onClick={() => onOpenChange(false)} size="sm" variant="secondary">
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
