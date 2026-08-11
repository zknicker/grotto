/** The Computer's local copy of the narrow Server activity frame vocabulary. */
export type ComputerAgentActivityCategory =
    | 'browsing'
    | 'checking_messages'
    | 'editing_files'
    | 'reading_files'
    | 'running_command'
    | 'searching_web'
    | 'sending_message'
    | 'starting_work'
    | 'thinking'
    | 'using_tool'
    | 'working';

export type ComputerAgentActivityPhase = 'completed' | 'failed' | 'started';

export interface ComputerAgentActivityUpdate {
    category: ComputerAgentActivityCategory;
    phase: ComputerAgentActivityPhase;
}
