@testable import GrottoUI
import Testing

struct ThreadReplyRevealTests {
    @Test func firstPageSettlesWithoutAnimation() {
        #expect(
            ThreadReplyReveal.onLatestReplyChange(
                previousLatestID: nil,
                isNearBottom: true,
                latestIsPending: false
            ) == .settle
        )
        // Even a first page whose newest row is the viewer's pending send
        // appears settled rather than animating into place.
        #expect(
            ThreadReplyReveal.onLatestReplyChange(
                previousLatestID: nil,
                isNearBottom: false,
                latestIsPending: true
            ) == .settle
        )
    }

    @Test func appendNearTheBottomAnimatesToTheLatestReply() {
        #expect(
            ThreadReplyReveal.onLatestReplyChange(
                previousLatestID: "reply-1",
                isNearBottom: true,
                latestIsPending: false
            ) == .animate
        )
    }

    @Test func ownPendingSendRevealsItselfFromAnywhere() {
        #expect(
            ThreadReplyReveal.onLatestReplyChange(
                previousLatestID: "reply-1",
                isNearBottom: false,
                latestIsPending: true
            ) == .animate
        )
    }

    @Test func otherAppendsLeaveAScrolledUpReaderAlone() {
        #expect(
            ThreadReplyReveal.onLatestReplyChange(
                previousLatestID: "reply-1",
                isNearBottom: false,
                latestIsPending: false
            ) == .stay
        )
    }
}

