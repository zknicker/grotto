import { useResolvedThemeOptional } from '../../components/theme-provider.tsx';
import { AgentFace, type HeadName } from '../chats/agent-face.tsx';
import { resolveAgentInk } from './agent-color-presets.ts';

export interface AgentSelectOption {
    character: HeadName;
    id: string;
    name: string;
    primaryColor: string | null;
}

// Matches the sidebar avatar treatment: the face core fills its 20px slot
// (no bleed into row gaps); overflow bits may still poke past.
const faceStyle = { flexShrink: 0, height: 20, overflow: 'visible', width: 20 } as const;

export function AgentOptionLabel({ agent }: { agent: AgentSelectOption }) {
    const dark = useResolvedThemeOptional() === 'dark';

    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center">
                <AgentFace
                    animate={false}
                    dark={dark}
                    head={agent.character}
                    ink={resolveAgentInk(dark, agent.primaryColor)}
                    size={20}
                    style={faceStyle}
                />
            </span>
            <span className="truncate">{agent.name}</span>
        </span>
    );
}
