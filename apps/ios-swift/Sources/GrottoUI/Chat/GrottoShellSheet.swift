/// A request to present Settings, optionally already pushed to a screen.
struct SettingsPresentationRequest: Identifiable, Hashable {
    let path: [SettingsRoute]

    var id: String { path.isEmpty ? "settings" : "settings-\(path.hashValue)" }
}

/// The sheets the Chat shell can present over its canvas.
enum GrottoShellSheet: Identifiable {
    case search
    case details(ChatDestination)
    case archived
    case newChannel

    var id: String {
        switch self {
        case .search:
            "chat-search"
        case .details(let chat):
            "chat-details-\(chat.id)"
        case .archived:
            "archived-channels"
        case .newChannel:
            "new-channel"
        }
    }
}
