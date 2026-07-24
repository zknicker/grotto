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

export function BrowserDisableConfirmationDialog({
    affectedAgentNames,
    onConfirm,
    onOpenChange,
    open,
}: {
    affectedAgentNames: string[];
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
}) {
    return (
        <AlertDialog onOpenChange={onOpenChange} open={open}>
            <AlertDialogPopup>
                <AlertDialogHeader>
                    <AlertDialogTitle>Disable Browser?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {affectedAgentNames.join(', ')} will lose Browser access. Re-enabling
                        Browser will not restore their grants.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
                    <AlertDialogClose onClick={onConfirm} render={<Button variant="destructive" />}>
                        Disable
                    </AlertDialogClose>
                </AlertDialogFooter>
            </AlertDialogPopup>
        </AlertDialog>
    );
}

export function BrowserSkillConflictConfirmationDialog({
    isSaving,
    onCancel,
    onOpenChange,
    onReplace,
    open,
}: {
    isSaving: boolean;
    onCancel: () => void;
    onOpenChange: (open: boolean) => void;
    onReplace: () => void;
    open: boolean;
}) {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Replace existing skill?</DialogTitle>
                    <DialogDescription>
                        Enabling Browser reserves the browser skill so the agent gets the right
                        tools and widget guidance.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter variant="bare">
                    <Button disabled={isSaving} onClick={onCancel} variant="ghost">
                        Cancel
                    </Button>
                    <Button
                        loading={isSaving}
                        onClick={onReplace}
                        type="button"
                        variant="destructive"
                    >
                        Replace skill
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
