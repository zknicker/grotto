export function SessionLogHiddenCount({ hiddenCount }: { hiddenCount: number }) {
    if (hiddenCount <= 0) {
        return null;
    }

    return (
        <p className="pb-1 text-center font-medium text-muted/60 text-sm">
            {hiddenCount} older {hiddenCount === 1 ? 'entry' : 'entries'}
        </p>
    );
}
