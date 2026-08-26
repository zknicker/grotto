import Foundation

/// One `ComposerInteraction` per destination, held above the Chat canvas.
///
/// The canvas is keyed by the selected destination, so the screen is destroyed
/// on every Chat switch and on every push-over. Staged attachments have to
/// outlive that — a photo picked in one Chat is still staged when the user comes
/// back — so the interactions live here and reach the screen by reference.
///
/// This is a plain class rather than shell `@State` holding a dictionary:
/// creating an interaction on first use happens while the shell's body is being
/// evaluated, and mutating SwiftUI state there is undefined behavior. Nothing
/// observes the store itself; each interaction is `@Observable` and is observed
/// by the composer views that draw it.
@MainActor
final class ComposerInteractionStore {
    private var interactions: [ChatDestination.ID: ComposerInteraction] = [:]

    var count: Int { interactions.count }

    func interaction(for destinationID: ChatDestination.ID) -> ComposerInteraction {
        if let existing = interactions[destinationID] { return existing }
        let created = ComposerInteraction()
        interactions[destinationID] = created
        return created
    }

    /// Drops the interactions whose destination is gone, deleting their staged
    /// files as it goes — the one path that discards an interaction the user
    /// never sent from. An empty list is a reconnect or a first load rather than
    /// every Chat being deleted at once, so it discards nothing.
    func dropInteractions(outside destinationIDs: [ChatDestination.ID]) {
        guard !destinationIDs.isEmpty else { return }
        let live = Set(destinationIDs)
        for (destinationID, interaction) in interactions where !live.contains(destinationID) {
            interaction.cleanUp()
            interactions.removeValue(forKey: destinationID)
        }
    }
}
