import { Cancel01Icon, CopyIcon, Tick02Icon } from '@hugeicons-pro/core-stroke-rounded';
import * as React from 'react';
import { ChatBadge, type ChatBadgeKind } from '../../components/badges/chat-badge.tsx';
import { SessionBadge } from '../../components/badges/session-badge.tsx';
import { SimpleCodeEditor } from '../../components/code-editor/simple-code-editor.tsx';
import { Badge } from '../../components/ui/badge.tsx';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../../components/ui/dialog.tsx';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../../components/ui/empty.tsx';
import { Icon } from '../../components/ui/icon.tsx';
import { Nav, NavItem, NavSectionLabel } from '../../components/ui/nav.tsx';
import { Button } from '../../components/ui/primitives/button.tsx';
import { ScrollArea } from '../../components/ui/scroll-area.tsx';
import { Spinner } from '../../components/ui/spinner.tsx';
import { useSessionPrompt } from '../../hooks/sessions/use-session-prompt.ts';
import { writeClipboardText } from '../../lib/clipboard.ts';

type SectionKind = 'base' | 'identity' | 'mcp' | 'module' | 'project' | 'routing' | 'skill';

interface PromptSection {
    content: string;
    id: string;
    kind: SectionKind;
    label: string;
}

interface PromptData {
    assistantName: string | null;
    fullText: string;
    generatedAt: string;
    provider: string;
    sections: PromptSection[];
}

const SECTION_KIND_LABEL: Record<SectionKind, string> = {
    base: 'Base',
    identity: 'Identity',
    mcp: 'MCP',
    module: 'Module',
    project: 'Project',
    routing: 'Routing',
    skill: 'Skill',
};

const SECTION_KIND_ORDER: SectionKind[] = [
    'base',
    'identity',
    'module',
    'skill',
    'mcp',
    'project',
    'routing',
];

const ALL_TAB_VALUE = '__all__';

interface PromptInspectDialogProps {
    agentName: string;
    chatKind: ChatBadgeKind;
    chatTitle: string;
    sessionKey: null | string;
}

export function PromptInspectDialog({
    agentName,
    chatKind,
    chatTitle,
    sessionKey,
}: PromptInspectDialogProps) {
    const [open, setOpen] = React.useState(false);
    const [activeId, setActiveId] = React.useState<string>(ALL_TAB_VALUE);
    const promptQuery = useSessionPrompt(
        { sessionKey },
        {
            enabled: open,
        }
    );
    const prompt = promptQuery.data ?? null;
    const isUnavailable = !(promptQuery.isPending || prompt);

    React.useEffect(() => {
        if (!open) {
            setActiveId(ALL_TAB_VALUE);
            return;
        }

        void promptQuery.refetch();
    }, [open, promptQuery]);

    const activeSection = React.useMemo(() => {
        if (!prompt || activeId === ALL_TAB_VALUE) {
            return null;
        }
        return prompt.sections.find((section) => section.id === activeId) ?? null;
    }, [activeId, prompt]);
    const activeContent = activeSection ? activeSection.content : (prompt?.fullText ?? '');

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <Button
                disabled={!sessionKey}
                onClick={() => setOpen(true)}
                size="sm"
                variant="secondary"
            >
                Inspect prompt
            </Button>
            <DialogContent
                className="h-[min(740px,86vh)] max-h-[86vh] max-w-5xl"
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">Inspect prompt</DialogTitle>
                <div className="flex min-h-0 flex-1 flex-row">
                    <PromptRail
                        activeId={activeId}
                        agentName={agentName}
                        chatKind={chatKind}
                        chatTitle={chatTitle}
                        onSelect={setActiveId}
                        prompt={prompt}
                        sessionKey={sessionKey}
                    />
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        {prompt ? (
                            <PromptContentPanel content={activeContent} />
                        ) : (
                            <PromptStatePlaceholder
                                error={promptQuery.error?.message}
                                isLoading={promptQuery.isPending || promptQuery.isFetching}
                                isUnavailable={isUnavailable}
                            />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface PromptRailProps {
    activeId: string;
    agentName: string;
    chatKind: ChatBadgeKind;
    chatTitle: string;
    onSelect: (id: string) => void;
    prompt: PromptData | null;
    sessionKey: null | string;
}

function PromptRail({
    activeId,
    agentName,
    chatKind,
    chatTitle,
    onSelect,
    prompt,
    sessionKey,
}: PromptRailProps) {
    const grouped = React.useMemo(
        () => (prompt ? groupSectionsByKind(prompt.sections) : []),
        [prompt]
    );

    return (
        <div className="flex min-h-0 w-64 shrink-0 flex-col border-border border-r bg-muted">
            <div className="flex shrink-0 flex-col gap-3 px-3 pt-3 pb-1">
                <DialogClose
                    aria-label="Close"
                    render={<Button className="w-fit" size="sm" variant="secondary" />}
                >
                    <Icon className="size-5" icon={Cancel01Icon} />
                    Close
                </DialogClose>
                <div className="flex flex-col gap-1.5">
                    <Badge
                        className="max-w-full justify-start normal-case tracking-normal"
                        size="chip"
                        title={agentName}
                        variant="chip"
                    >
                        <span className="min-w-0 truncate font-medium">{agentName}</span>
                    </Badge>
                    <ChatBadge kind={chatKind} title={chatTitle} />
                    {sessionKey ? <SessionBadge sessionKey={sessionKey} /> : null}
                </div>
            </div>
            <ScrollArea className="flex-1">
                {prompt ? (
                    <Nav className="px-2 pt-5 pb-3">
                        <NavItem
                            active={activeId === ALL_TAB_VALUE}
                            onClick={() => onSelect(ALL_TAB_VALUE)}
                        >
                            Full prompt
                        </NavItem>
                        {grouped.map((group) => (
                            <React.Fragment key={group.kind}>
                                <NavSectionLabel className="px-2.5 pt-4 pb-1.5">
                                    {SECTION_KIND_LABEL[group.kind]}
                                </NavSectionLabel>
                                {group.items.map((section) => (
                                    <NavItem
                                        active={activeId === section.id}
                                        key={section.id}
                                        onClick={() => onSelect(section.id)}
                                    >
                                        <span className="min-w-0 truncate" title={section.label}>
                                            {section.label}
                                        </span>
                                    </NavItem>
                                ))}
                            </React.Fragment>
                        ))}
                    </Nav>
                ) : null}
            </ScrollArea>
        </div>
    );
}

function groupSectionsByKind(sections: PromptSection[]) {
    const map = new Map<SectionKind, PromptSection[]>();
    for (const section of sections) {
        const list = map.get(section.kind) ?? [];
        list.push(section);
        map.set(section.kind, list);
    }
    return SECTION_KIND_ORDER.flatMap((kind) => {
        const items = map.get(kind);
        if (!items || items.length === 0) {
            return [];
        }
        return [{ items, kind }];
    });
}

function PromptContentPanel({ content }: { content: string }) {
    const stats = React.useMemo(
        () => ({
            chars: content.length,
            lines: content.split('\n').length,
        }),
        [content]
    );

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-2 border-border border-b bg-muted ps-5 pe-1.5 text-muted-foreground text-sm">
                <div className="flex min-w-0 items-center gap-1.5 py-1.5">
                    <span className="text-foreground tabular-nums">
                        {stats.lines.toLocaleString()}
                    </span>
                    <span>{stats.lines === 1 ? 'line' : 'lines'}</span>
                    <span className="text-foreground-quaternary">·</span>
                    <span className="text-foreground tabular-nums">
                        {stats.chars.toLocaleString()}
                    </span>
                    <span>{stats.chars === 1 ? 'character' : 'characters'}</span>
                </div>
                <CopyButton text={content} />
            </div>
            <SimpleCodeEditor filePath="prompt.md" readOnly value={content} />
        </div>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (!copied) {
            return;
        }

        const id = setTimeout(() => setCopied(false), 1600);
        return () => clearTimeout(id);
    }, [copied]);

    return (
        <Button
            aria-label={copied ? 'Copied' : 'Copy prompt'}
            onClick={async () => {
                try {
                    await writeClipboardText(text);
                    setCopied(true);
                } catch {
                    setCopied(false);
                }
            }}
            size="icon-xs"
            variant="ghost"
        >
            <Icon icon={copied ? Tick02Icon : CopyIcon} />
        </Button>
    );
}

function PromptStatePlaceholder({
    error,
    isLoading,
    isUnavailable,
}: {
    error: string | undefined;
    isLoading: boolean;
    isUnavailable: boolean;
}) {
    if (error) {
        return (
            <PlaceholderShell>
                <EmptyHeader>
                    <EmptyTitle>Couldn’t inspect prompt</EmptyTitle>
                    <EmptyDescription>{error}</EmptyDescription>
                </EmptyHeader>
            </PlaceholderShell>
        );
    }

    if (isLoading) {
        return (
            <PlaceholderShell>
                <EmptyMedia>
                    <Spinner className="size-5 text-muted-foreground" />
                </EmptyMedia>
                <EmptyHeader>
                    <EmptyTitle>Loading prompt</EmptyTitle>
                    <EmptyDescription>Fetching the live prompt assembly.</EmptyDescription>
                </EmptyHeader>
            </PlaceholderShell>
        );
    }

    if (isUnavailable) {
        return (
            <PlaceholderShell>
                <EmptyHeader>
                    <EmptyTitle>Prompt inspection unavailable</EmptyTitle>
                    <EmptyDescription>
                        No active runner is exposing prompt inspection for this session right now.
                    </EmptyDescription>
                </EmptyHeader>
            </PlaceholderShell>
        );
    }

    return (
        <PlaceholderShell>
            <EmptyHeader>
                <EmptyTitle>Unable to load prompt</EmptyTitle>
                <EmptyDescription>Try opening this dialog again in a moment.</EmptyDescription>
            </EmptyHeader>
        </PlaceholderShell>
    );
}

function PlaceholderShell({ children }: { children: React.ReactNode }) {
    return <Empty className="flex-1">{children}</Empty>;
}
