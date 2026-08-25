import GrottoUI
import SwiftUI

/// The settings sheet's fallback when Server settings data has not loaded yet.
struct SettingsUnavailableSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label("Settings unavailable", systemImage: "gearshape")
            } description: {
                Text("Settings are still loading. Try again in a moment.")
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

/// Tasks and Threads share the root stack, so a Thread opened from a Task pops
/// back to the Task list rather than to the Chat canvas.
enum GrottoRootRoute: Hashable {
    case tasks
    case thread(ThreadSelection)
}

/// A Thread route anchored by the parent message, which exists before the child
/// Chat does.
struct ThreadSelection: Hashable, Identifiable {
    let parentChatID: String
    var threadChatID: String?
    let anchor: MessagePresentation

    var id: String { anchor.id }
}

extension Array where Element == GrottoRootRoute {
    var carriesThread: Bool {
        contains { if case .thread = $0 { true } else { false } }
    }
}
