import SwiftUI

/// Canvas state the shell holds per destination. The canvas is keyed by the
/// selected destination, so anything that has to outlive a Chat switch — a
/// half-typed draft, a pending reveal — is owned here and reaches the screen as
/// a binding.
extension GrottoShellView {
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
