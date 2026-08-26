import SwiftUI

/// Canvas state the shell holds per destination. The canvas is keyed by the
/// selected destination, so anything that has to outlive a Chat switch — a
/// half-typed draft, a pending reveal — is owned here and reaches the screen as
/// a binding.
extension GrottoShellView {
    /// The composer state that owns the staged attachments for one destination,
    /// created the first time that Chat is drawn. The screen only borrows it, so
    /// picking a photo and switching Chats keeps the photo staged where it was
    /// picked.
    func composerInteraction(for destination: ChatDestination) -> ComposerInteraction {
        composerInteractions.interaction(for: destination.id)
    }

    /// A destination that has left the list can never be returned to, so its
    /// canvas state goes with it — including the staged files, which are deleted
    /// together with the attachments that reference them.
    func dropCanvasState(outside destinationIDs: [ChatDestination.ID]) {
        guard !destinationIDs.isEmpty else { return }
        let live = Set(destinationIDs)
        drafts = drafts.filter { live.contains($0.key) }
        composerInteractions.dropInteractions(outside: destinationIDs)
    }

    func draftBinding(for destination: ChatDestination) -> Binding<String> {
        Binding(
            get: { drafts[destination.id] ?? "" },
            set: { drafts[destination.id] = $0.isEmpty ? nil : $0 }
        )
    }

    func scrollTargetBinding(for destination: ChatDestination) -> Binding<String?> {
        Binding(
            get: {
                guard case .chat(let chatID) = destination.id else { return nil }
                return scrollTarget?.chatID == chatID ? scrollTarget?.messageID : nil
            },
            set: { if $0 == nil { scrollTarget = nil } }
        )
    }
}
