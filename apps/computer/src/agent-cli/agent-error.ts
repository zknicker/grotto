export type AgentCliErrorCode =
    | 'AMBIGUOUS_ID'
    | 'CONTENT_FLAG_UNSUPPORTED'
    | 'INFO_FAILED'
    | 'INTERNAL_BUG'
    | 'INVALID_ARG'
    | 'INVALID_JSON_RESPONSE'
    | 'INVALID_TARGET'
    | 'MISSING_AGENT_ID'
    | 'MISSING_CONTENT'
    | 'MISSING_SERVER_URL'
    | 'MISSING_TOKEN'
    | 'NOT_A_MEMBER'
    | 'NOT_YET_AVAILABLE'
    | 'OPERATOR_COMMAND_UNAVAILABLE'
    | 'POSITIONAL_CONTENT_UNSUPPORTED'
    | 'READ_FAILED'
    | 'RESOLVE_FAILED'
    | 'SEARCH_FAILED'
    | 'SEND_DRAFT_ANYWAY_REQUIRES_SEND_DRAFT'
    | 'SEND_DRAFT_ATTACHMENTS_UNSUPPORTED'
    | 'SEND_DRAFT_NOT_FOUND'
    | 'SEND_DRAFT_STDIN_UNSUPPORTED'
    | 'SEND_FAILED'
    | 'SERVER_5XX'
    | 'TARGET_NOT_FOUND'
    | 'TOKEN_FILE_EMPTY'
    | 'TOKEN_FILE_UNREADABLE';

export class AgentCliError extends Error {
    constructor(
        readonly code: AgentCliErrorCode | string,
        message: string,
        readonly options: { draftSaved?: boolean; nextAction?: string } = {}
    ) {
        super(message);
        this.name = 'AgentCliError';
    }
}

export function renderAgentCliError(error: AgentCliError): string {
    const lines = [`Error: ${error.message}`, `Code: ${error.code}`];
    if (error.options.draftSaved !== undefined) {
        lines.push(`Draft saved: ${error.options.draftSaved ? 'yes' : 'no'}`);
    }
    if (error.options.nextAction) {
        lines.push(`Next action: ${error.options.nextAction}`);
    }
    return `${lines.join('\n')}\n`;
}
