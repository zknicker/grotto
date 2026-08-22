import SwiftUI

/// How the shell reaches its sheets and the Chats they hand back. The canvas
/// owns what is on screen; this extension owns which surface asked for it.
extension GrottoShellView {
    func selectCreatedChannel(_ channel: CreatedChannelPresentation) {
        selectChannel(id: channel.id)
    }

    /// A restored channel reappears in `chats` on the next Server list, exactly
    /// like a freshly created one, so both wait on the same pending selection.
    func selectRestoredChannel(_ channel: ArchivedChannelPresentation) {
        selectChannel(id: channel.id)
    }

    private func selectChannel(id: String) {
        if let chat = chats.first(where: { $0.id == id }) {
            open(chat)
            return
        }
        pendingChatSelectionID = id
        activeChatSheet = nil
    }

    func openSettings() {
        setDrawer(open: false)
        settingsRequest = SettingsPresentationRequest(path: [])
    }

    func openTasks() {
        setDrawer(open: false)
        onOpenTasks()
    }

    /// Chat details and Settings are mutually exclusive sheets, so the details
    /// sheet dismisses first and Settings presents from its `onDismiss`.
    func openAgentProfile(_ agentID: String) {
        queuedSettingsRequest = SettingsPresentationRequest(path: [.agent(id: agentID)])
        activeChatSheet = nil
    }

    func presentQueuedSettings() {
        guard let queuedSettingsRequest else { return }
        self.queuedSettingsRequest = nil
        settingsRequest = queuedSettingsRequest
    }
}
