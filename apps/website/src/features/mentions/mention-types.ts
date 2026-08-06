export type MentionKind =
    | 'agent'
    | 'app'
    | 'directory'
    | 'file'
    | 'image'
    | 'plugin'
    | 'skill'
    | 'user';
export type ReferenceKind = MentionKind | 'website';
export type MentionOptionKind = MentionKind;
export type MentionTrigger = '@' | '$';
export type MentionProjection =
    | 'agent-reference'
    | 'capability-reference'
    | 'image-input'
    | 'path-reference'
    | 'skill-activation';

export interface Mention {
    end: number;
    id: string;
    kind: MentionKind;
    label: string;
    metadata?: Record<string, unknown>;
    projection: MentionProjection;
    start: number;
    text: string;
}

export interface MentionOption {
    description?: string | null;
    groupLabel?: string;
    id: string;
    insertText: string;
    kind: MentionOptionKind;
    label: string;
    metadata?: Record<string, unknown>;
    projection: MentionProjection;
    sourceLabel?: string | null;
}

export interface ActiveMentionQuery {
    end: number;
    query: string;
    start: number;
    trigger: MentionTrigger;
}
