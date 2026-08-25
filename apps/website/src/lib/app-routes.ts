export const appRoutes = {
    search: '/search',
    chats: '/chats',
    chat(chatId: string) {
        return `/chats/${chatId}`;
    },
    archivedChats: '/chats/archived',
    tasks: '/tasks',
    activity: '/activity',
    members: '/members',
    membersHumans: '/members/humans',
    memberAgent(agentId: string) {
        return `/members/agents/${encodeURIComponent(agentId)}`;
    },

    settings: '/settings',
    settingsPreferences: '/settings/preferences',
    settingsProfile: '/settings/profile',
    settingsMembers: '/settings/members',
    settingsSkills: '/settings/skills',
    settingsBrowser: '/settings/browser',
    settingsConnections: '/settings/connections',
    settingsModels: '/settings/models',
} as const;
