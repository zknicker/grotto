@testable import HausUI
import Testing

struct TranscriptNearNewestTests {
    @Test func aTranscriptOpensOnItsNewestItem() {
        #expect(TranscriptNearNewest().reported)
    }

    @Test func theToleranceIsAHalfOpenBandAtTheRestingEdge() {
        #expect(TranscriptNearNewest.isNear(distance: 0))
        #expect(TranscriptNearNewest.isNear(distance: TranscriptNearNewest.tolerance - 1))
        #expect(!TranscriptNearNewest.isNear(distance: TranscriptNearNewest.tolerance))
    }

    @Test func landingAtTheNewestItemPublishesNothing() {
        // The transient far geometry a landing transcript passes through — an
        // inset grown before the resting offset is reapplied — is never a
        // reading: only the settled distance reaches this rule, so the chevron
        // is never turned on for a viewport that came to rest at the bottom.
        var state = TranscriptNearNewest()
        #expect(state.settle(distance: 0) == nil)
        #expect(state.reported)
    }

    @Test func aSettledFarReadingPublishesOnce() {
        var state = TranscriptNearNewest()
        #expect(state.settle(distance: 400) == false)
        #expect(!state.reported)
        #expect(state.settle(distance: 400) == nil)
        #expect(state.settle(distance: 900) == nil)
    }

    @Test func aSettleWithNothingToAnimatePublishesOrdinaryGeometry() {
        // A settle whose viewport is already at rest never opens: there is
        // nothing to animate, so no end-animation callback would ever arrive.
        // Ending unconditionally on that path leaves the next reading ordinary
        // rather than a stuck destination.
        var state = TranscriptNearNewest()
        state.endSettling()
        #expect(!state.isSettling)
        #expect(state.settle(distance: 0) == nil)
        #expect(state.settle(distance: 900) == false)
    }

    @Test func aCancelledSettleThatEndsStrandedPublishesFar() {
        // An inset write mid-flight — the composer collapsing after a send —
        // cancels the travel and the scroll view never reports an end. The
        // deferred fallback redeems the ticket anyway, so the stranded viewport
        // turns the chevron on.
        var state = TranscriptNearNewest()
        let ticket = state.beginSettling()
        #expect(state.settle(distance: 900) == nil)
        let closed = state.endSettling(ticket)
        #expect(closed)
        #expect(state.settle(distance: 900) == false)
        #expect(!state.reported)
    }

    @Test func aSettleThatEndsAtRestPublishesNothing() {
        var state = TranscriptNearNewest()
        let ticket = state.beginSettling()
        state.endSettling(ticket)
        #expect(!state.isSettling)
        #expect(state.settle(distance: 4) == nil)
        #expect(state.reported)
    }

    @Test func aSettlingTranscriptCountsAsNearFromAnyOffset() {
        // Mid-travel the offset is parked far from rest, and the coordinator
        // asks this same question for the inset anchor and the append policy:
        // an inset write landing during a settle (the composer collapsing
        // right after a send) must re-rest the viewport, not read it as far.
        var state = TranscriptNearNewest()
        #expect(!state.countsAsNear(distance: 900))
        let ticket = state.beginSettling()
        #expect(state.countsAsNear(distance: 900))
        state.endSettling(ticket)
        #expect(!state.countsAsNear(distance: 900))
    }

    @Test func aSettleFromAFarViewportHidesTheChevronWhileItTravels() {
        var state = TranscriptNearNewest()
        _ = state.settle(distance: 400)
        let ticket = state.beginSettling()
        #expect(state.settle(distance: 400) == true)
        state.endSettling(ticket)
        #expect(state.settle(distance: 0) == nil)
    }

    @Test func aSettleClosesOnceAndTheLosingSignalChangesNothing() {
        // Both signals race: the scroll view's end-of-animation callback and
        // the deferred fallback. The first closes the settle; the second finds
        // its ticket spent and must not reopen or re-publish anything.
        var state = TranscriptNearNewest()
        let ticket = state.beginSettling()
        let closed = state.endSettling(ticket)
        let closedAgain = state.endSettling(ticket)
        #expect(closed)
        #expect(!closedAgain)
        #expect(!state.isSettling)
    }

    @Test func aSupersededSettlesFallbackCannotCloseItsSuccessor() {
        var state = TranscriptNearNewest()
        let stale = state.beginSettling()
        let current = state.beginSettling()
        let staleClosed = state.endSettling(stale)
        #expect(!staleClosed)
        #expect(state.isSettling)
        let currentClosed = state.endSettling(current)
        #expect(currentClosed)
        #expect(!state.isSettling)
    }

    @Test func aDragOrphansEveryTicketOutstanding() {
        // `scrollViewWillBeginDragging` ends the settle unconditionally: the
        // finger owns the viewport, and the fallback armed for the travel it
        // interrupted must not close a later one.
        var state = TranscriptNearNewest()
        let ticket = state.beginSettling()
        state.endSettling()
        #expect(!state.isSettling)
        let closed = state.endSettling(ticket)
        #expect(!closed)
    }

    @Test func returningToTheNewestItemPublishesAgain() {
        var state = TranscriptNearNewest()
        _ = state.settle(distance: 400)
        #expect(state.settle(distance: 0) == true)
        #expect(state.reported)
        #expect(state.settle(distance: 12) == nil)
    }
}
