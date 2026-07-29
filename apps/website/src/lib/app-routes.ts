export const appRoutes = {
    search: '/search',
    chats: '/chats',
    chat(chatId: string) {
        return `/chats/${chatId}`;
    },
    archivedChats: '/chats/archived',
    tasks: '/tasks',
    activity: '/activity',
    reminders: '/reminders',
    members: '/members',
    membersHumans: '/members/humans',
    memberAgent(agentId: string) {
        return `/members/agents/${encodeURIComponent(agentId)}`;
    },

    designFaces: '/design/faces',
    settings: '/settings',
    settingsAgentRuntime: '/settings/agent-runtime',
    settingsAppearance: '/settings/appearance',
    settingsProfile: '/settings/profile',
    settingsUpdates: '/settings/updates',
    settingsStats: '/settings/stats',
    settingsSkills: '/settings/skills',
    settingsBrowser: '/settings/browser',
    settingsConnections: '/settings/connections',
    settingsModels: '/settings/models',
} as const;
