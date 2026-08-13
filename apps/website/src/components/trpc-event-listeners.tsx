import { useAgentEvents } from '../hooks/agents/use-agent-events.ts';
import { useChatEvents } from '../hooks/chats/use-chat-events.ts';
import { useEngineRestartToast } from '../hooks/connections/use-engine-restart-toast.ts';
import { useOpenRouterSettingsEvents } from '../hooks/connections/use-openrouter-settings-events.ts';
import {
    useRuntimeCapabilityEvents,
    useRuntimeConnectionEvents,
} from '../hooks/connections/use-runtime-events.ts';
import { useLabelEvents } from '../hooks/labels/use-label-events.ts';
import { useModelEvents } from '../hooks/models/use-model-events.ts';
import { useUsageEvents } from '../hooks/models/use-usage-events.ts';
import { usePaneEvents } from '../hooks/pane/use-pane-events.ts';
import { useSessionEvents } from '../hooks/sessions/use-session-events.ts';
import { useSkillEvents } from '../hooks/skills/use-events.ts';
import { useTaskEvents } from '../hooks/tasks/use-task-events.ts';
import { useWorkerEvents } from '../hooks/workers/use-worker-events.ts';

export function TrpcEventListeners() {
    useAgentEvents();
    useChatEvents();
    useEngineRestartToast();
    useRuntimeCapabilityEvents();
    useRuntimeConnectionEvents();
    useModelEvents();
    useOpenRouterSettingsEvents();
    usePaneEvents();
    useSessionEvents();
    useSkillEvents();
    useUsageEvents();
    useWorkerEvents();
    useTaskEvents();
    useLabelEvents();

    return null;
}
