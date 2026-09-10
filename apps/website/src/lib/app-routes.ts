export const appRoutes = {
    search: '/search',
    chats: '/chats',
    chat(chatId: string) {
        return `/chats/${chatId}`;
    },
    archivedChats: '/chats/archived',
    inbox: '/inbox',
    tasks: '/tasks',
    activity: '/activity',
    usage: '/usage',

    settings: '/settings',
    settingsPreferences: '/settings/preferences',
    settingsProfile: '/settings/profile',
    settingsMembers: '/settings/members',
    settingsServers: '/settings/servers',
    settingsSkills: '/settings/skills',
    settingsConnections: '/settings/connections',
    settingsModels: '/settings/models',
} as const;
