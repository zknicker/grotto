import type { Agent } from '@grotto/api';
import { parseAgentReferenceTarget } from '@grotto/api/rich-references';
import * as React from 'react';
import { grottoTrpc } from '../../lib/grotto-server.tsx';
import { queryPolicy } from '../../lib/query-policy.ts';
import { MentionEditor, type MentionEditorHandle } from './mention-editor.tsx';
import {
    buildAgentMentionOption,
    filterMentionOptionsForQuery,
    type MentionAgent,
} from './mention-options.ts';
import { MentionPicker } from './mention-picker.tsx';
import type { ActiveMentionQuery, Mention, MentionOption } from './mention-types.ts';
import { selectVisibleOptions } from './mention-visible-options.ts';

export interface MentionComposerState {
    activeIndex: number;
    editorRef: React.RefObject<MentionEditorHandle | null>;
    focusTextEditor: () => void;
    handleKeyDown: (event: KeyboardEvent) => boolean;
    handleMentionSelect: (option: MentionOption) => void;
    handleTextChange: (content: string, mentions: Mention[]) => void;
    hasQuery: boolean;
    isPathSearchActive: boolean;
    isPathSearchLoading: boolean;
    onActiveQueryChange: (query: ActiveMentionQuery | null) => void;
    options: MentionOption[];
    prefetchMentionOptions: () => void;
    value: string;
}

export function useServerMentionComposer({
    agents,
    chatId,
    content,
    mentionableAgentIds,
    onMentionsChange,
    onSubmit,
    onTextChange,
    serverId,
}: {
    agents: Agent[];
    chatId: string;
    content: string;
    mentionableAgentIds: readonly string[];
    onMentionsChange?: (mentions: Mention[]) => void;
    onSubmit?: () => void;
    onTextChange: (content: string) => void;
    serverId: string;
}) {
    const mentionAgents = React.useMemo<MentionAgent[]>(
        () =>
            agents.map((agent) => ({
                avatarUrl: agent.avatarUrl,
                id: agent.id,
                name: agent.displayName,
            })),
        [agents]
    );
    const scaffold = useMentionComposerScaffold({
        agentId: mentionableAgentIds[0] ?? '',
        mentionableAgentIds,
    });
    const input = React.useMemo(
        () => ({
            agentIds: [...scaffold.skillScopeAgentIds],
            chatId,
            serverId,
        }),
        [chatId, scaffold.skillScopeAgentIds, serverId]
    );
    const optionsQuery = grottoTrpc.chat.mentionOptions.useQuery(input, {
        enabled: scaffold.activeQuery !== null,
    });
    const utils = grottoTrpc.useUtils();
    const options = React.useMemo(
        () =>
            filterMentionOptionsForQuery(
                (optionsQuery.data?.options ?? []).map((option): MentionOption => {
                    if (option.kind !== 'agent') {
                        return option;
                    }
                    const agentId = parseAgentReferenceTarget(option.id);
                    return agentId
                        ? buildAgentMentionOption({ agentId, agents: mentionAgents })
                        : option;
                }),
                scaffold.activeQuery?.query ?? ''
            ),
        [mentionAgents, optionsQuery.data?.options, scaffold.activeQuery?.query]
    );
    const prefetchMentionOptions = React.useCallback(() => {
        // Depend on the memoized `utils` root, never on a `utils.chat.mentionOptions`
        // proxy path: tRPC rebuilds that path object on every access, so depending on
        // it re-created this callback each render and prefetched once per keystroke.
        void utils.chat.mentionOptions.prefetch(input, queryPolicy.syncedSnapshot);
    }, [input, utils]);

    return useMentionComposerController({
        content,
        mentionOptionsState: {
            isPathSearchActive: false,
            isPathSearchLoading: optionsQuery.isLoading || optionsQuery.isFetching,
            options,
        },
        onMentionsChange,
        onSubmit,
        onTextChange,
        prefetchMentionOptions,
        scaffold,
    });
}

interface MentionComposerScaffold {
    activeQuery: ActiveMentionQuery | null;
    mentions: Mention[];
    setActiveQuery: React.Dispatch<React.SetStateAction<ActiveMentionQuery | null>>;
    setMentions: React.Dispatch<React.SetStateAction<Mention[]>>;
    skillScopeAgentIds: string[];
}

export function useMentionComposerScaffold({
    agentId,
    mentionableAgentIds,
}: {
    agentId: string;
    mentionableAgentIds: readonly string[];
}): MentionComposerScaffold {
    const [mentions, setMentions] = React.useState<Mention[]>([]);
    const [activeQuery, setActiveQuery] = React.useState<ActiveMentionQuery | null>(null);
    // The editor emits a fresh `mentions` array on every keystroke, so an
    // identity-keyed memo here produces a new scope array per render and
    // invalidates every downstream query input and prefetch callback. Key the
    // memo on the resolved scope value instead.
    const skillScopeAgentIdsKey = resolveSkillScopeAgentIdsKey({
        agentId,
        mentionableAgentIds,
        mentions,
    });
    const skillScopeAgentIds = React.useMemo(
        () =>
            skillScopeAgentIdsKey === '' ? [] : skillScopeAgentIdsKey.split(SCOPE_KEY_SEPARATOR),
        [skillScopeAgentIdsKey]
    );

    return {
        activeQuery,
        mentions,
        setActiveQuery,
        setMentions,
        skillScopeAgentIds,
    };
}

export function useMentionComposerController({
    content,
    mentionOptionsState,
    onMentionsChange,
    onSubmit,
    onTextChange,
    prefetchMentionOptions,
    scaffold,
}: {
    content: string;
    mentionOptionsState: {
        isPathSearchActive: boolean;
        isPathSearchLoading: boolean;
        options: MentionOption[];
    };
    onMentionsChange?: (mentions: Mention[]) => void;
    onSubmit?: () => void;
    onTextChange: (content: string) => void;
    prefetchMentionOptions: () => void;
    scaffold: MentionComposerScaffold;
}) {
    const editorRef = React.useRef<MentionEditorHandle | null>(null);
    const dismissedQueryRef = React.useRef<ActiveMentionQuery | null>(null);
    const [activeIndex, setActiveIndex] = React.useState(0);
    const { activeQuery, mentions, setActiveQuery, setMentions } = scaffold;
    const trigger = activeQuery?.trigger ?? '@';
    const visibleMentionOptions = selectVisibleOptions({
        activeQuery,
        mentionOptions: mentionOptionsState.options,
    });

    React.useEffect(() => {
        prefetchMentionOptions();
    }, [prefetchMentionOptions]);

    React.useEffect(() => {
        if (visibleMentionOptions.length === 0) {
            setActiveIndex(0);
            return;
        }

        setActiveIndex((index) => Math.min(index, visibleMentionOptions.length - 1));
    }, [visibleMentionOptions.length]);

    React.useEffect(() => {
        if (content.length === 0 && mentions.length > 0) {
            setMentions([]);
            onMentionsChange?.([]);
        }
    }, [content.length, mentions.length, onMentionsChange, setMentions]);

    function commitMentions(nextMentions: Mention[]) {
        setMentions(nextMentions);
        onMentionsChange?.(nextMentions);
    }

    function handleTextChange(nextContent: string, nextMentions: Mention[]) {
        onTextChange(nextContent);
        commitMentions(nextMentions);
    }

    function handleMentionSelect(option: MentionOption) {
        dismissedQueryRef.current = null;
        editorRef.current?.insertMention(option);
    }

    function handleKeyDown(event: KeyboardEvent) {
        return handlePickerKeyDown(event) || handleSubmitKeyDown(event);
    }

    function handlePickerKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            if (!(activeQuery || dismissedQueryRef.current)) {
                return false;
            }

            event.preventDefault();
            dismissedQueryRef.current = activeQuery ?? dismissedQueryRef.current;
            setActiveQuery(null);
            return true;
        }

        if (visibleMentionOptions.length === 0) {
            return false;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % visibleMentionOptions.length);
            return true;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(
                (index) => (index - 1 + visibleMentionOptions.length) % visibleMentionOptions.length
            );
            return true;
        }

        if (
            (event.key === 'Enter' && !(event.metaKey || event.ctrlKey || event.shiftKey)) ||
            event.key === 'Tab'
        ) {
            event.preventDefault();
            handleMentionSelect(visibleMentionOptions[activeIndex]);
            return true;
        }

        return false;
    }

    function handleActiveQueryChange(query: ActiveMentionQuery | null) {
        if (!query) {
            dismissedQueryRef.current = null;
            setActiveQuery(null);
            return;
        }

        if (isSameMentionQuery(query, dismissedQueryRef.current)) {
            setActiveQuery(null);
            return;
        }

        dismissedQueryRef.current = null;
        setActiveQuery(query);
    }

    function handleSubmitKeyDown(event: KeyboardEvent) {
        if (
            event.key !== 'Enter' ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.isComposing
        ) {
            return false;
        }

        event.preventDefault();
        onSubmit?.();
        return true;
    }

    return {
        activeIndex,
        editorRef,
        focusTextEditor: () => editorRef.current?.focus(),
        handleKeyDown,
        handleMentionSelect,
        handleTextChange,
        hasQuery: Boolean(activeQuery),
        isPathSearchActive:
            trigger !== '@' && trigger !== '$' && mentionOptionsState.isPathSearchActive,
        isPathSearchLoading:
            trigger !== '@' && trigger !== '$' && mentionOptionsState.isPathSearchLoading,
        onActiveQueryChange: handleActiveQueryChange,
        options: visibleMentionOptions,
        prefetchMentionOptions,
        value: content,
    } satisfies MentionComposerState;
}

export function resolveSkillScopeAgentIds({
    agentId,
    mentionableAgentIds = [],
    mentions,
}: {
    agentId: string;
    mentionableAgentIds?: readonly string[];
    mentions: readonly Mention[];
}) {
    const mentionable = new Set(mentionableAgentIds);
    const taggedAgentIds = mentions.flatMap((mention) => {
        if (mention.kind !== 'agent' || mention.projection !== 'agent-reference') {
            return [];
        }

        const parsed = parseAgentReferenceTarget(mention.id);
        if (!parsed) {
            return [];
        }

        if (mentionable.size > 0 && !mentionable.has(parsed)) {
            return [];
        }

        return [parsed];
    });
    const fallbackAgentIds = mentionableAgentIds.length > 0 ? mentionableAgentIds : [agentId];
    const scopedAgentIds = taggedAgentIds.length > 0 ? taggedAgentIds : fallbackAgentIds;

    return [...new Set(scopedAgentIds.map((id) => id.trim()).filter(Boolean))];
}

const SCOPE_KEY_SEPARATOR = '\n';

/**
 * Value key for the resolved skill scope. Two renders that resolve the same
 * agent ids produce the same key, which keeps the scope array, query inputs,
 * and prefetch callbacks referentially stable across unrelated re-renders.
 */
export function resolveSkillScopeAgentIdsKey(params: {
    agentId: string;
    mentionableAgentIds?: readonly string[];
    mentions: readonly Mention[];
}) {
    return resolveSkillScopeAgentIds(params).join(SCOPE_KEY_SEPARATOR);
}

function isSameMentionQuery(left: ActiveMentionQuery, right: ActiveMentionQuery | null) {
    return (
        right !== null &&
        left.end === right.end &&
        left.query === right.query &&
        left.start === right.start &&
        left.trigger === right.trigger
    );
}

export function MentionComposerEditor({
    ariaLabel,
    autoFocus,
    composer,
    disabled,
    id,
    name,
    placeholder,
}: {
    ariaLabel: string;
    autoFocus?: boolean;
    composer: MentionComposerState;
    disabled?: boolean;
    id?: string;
    name: string;
    placeholder?: string;
}) {
    return (
        <MentionEditor
            ariaLabel={ariaLabel}
            autoFocus={autoFocus}
            disabled={disabled}
            id={id}
            name={name}
            onActiveQueryChange={composer.onActiveQueryChange}
            onChange={composer.handleTextChange}
            onFocus={composer.prefetchMentionOptions}
            onKeyDown={composer.handleKeyDown}
            placeholder={placeholder}
            ref={composer.editorRef}
            value={composer.value}
        />
    );
}

export function MentionComposerPicker({ composer }: { composer: MentionComposerState }) {
    return (
        <MentionPicker
            activeIndex={composer.activeIndex}
            hasQuery={composer.hasQuery}
            isPathSearchActive={composer.isPathSearchActive}
            isPathSearchLoading={composer.isPathSearchLoading}
            onSelect={composer.handleMentionSelect}
            options={composer.options}
        />
    );
}
