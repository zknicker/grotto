import Foundation
import Testing
@testable import HausUI

/// The registry is what lets a card grow: the screen reads `revision`, so every
/// bump re-hosts every visible row. A frame reports two or three times per load,
/// so the bumps are coalesced.
@MainActor
struct VisualHeightRegistryTests {
    private func key(_ ordinal: Int) -> VisualKey {
        VisualKey(messageID: "msg_1", ordinal: ordinal)
    }

    @Test func storesEveryReportImmediately() {
        let registry = VisualHeightRegistry()

        registry.report(300, for: key(1))
        registry.report(500, for: key(2))

        #expect(registry.height(key(1)) == 300)
        #expect(registry.height(key(2)) == 500)
    }

    @Test func coalescesManyReportsInOneTurnIntoOneRevision() async {
        let registry = VisualHeightRegistry()

        // What one load actually looks like: DOMContentLoaded, the
        // ResizeObserver, then `load` — times the cards on screen.
        registry.report(240, for: key(1))
        registry.report(300, for: key(1))
        registry.report(320, for: key(1))
        registry.report(500, for: key(2))
        #expect(registry.revision == 0)

        await Task.yield()

        #expect(registry.revision == 1)
    }

    @Test func bumpsAgainOnALaterTurn() async {
        let registry = VisualHeightRegistry()

        registry.report(300, for: key(1))
        await Task.yield()
        registry.report(420, for: key(1))
        await Task.yield()

        #expect(registry.revision == 2)
    }

    @Test func ignoresNonsenseAndUnchangedHeights() async {
        let registry = VisualHeightRegistry()

        registry.report(.nan, for: key(1))
        registry.report(0, for: key(1))
        registry.report(-40, for: key(1))
        await Task.yield()
        #expect(registry.revision == 0)
        #expect(registry.height(key(1)) == nil)

        registry.report(300, for: key(1))
        await Task.yield()
        registry.report(300, for: key(1))
        await Task.yield()
        #expect(registry.revision == 1)
    }

    /// A tap is one event, not a burst, and the card has to answer it now.
    @Test func bumpsImmediatelyForACollapseToggle() {
        let registry = VisualHeightRegistry()

        registry.toggleExpanded(key(1))

        #expect(registry.isExpanded(key(1)))
        #expect(registry.revision == 1)
    }
}
