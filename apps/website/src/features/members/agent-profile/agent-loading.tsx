export function AgentLoading({ label }: { label: string }) {
    return (
        <div aria-busy="true" className="min-h-40">
            <span className="sr-only">{label}</span>
        </div>
    );
}
