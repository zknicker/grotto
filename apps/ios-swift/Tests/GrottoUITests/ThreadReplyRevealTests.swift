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

struct ThreadReplyScrollPositionTests {
    @Test func shortThreadIsAlwaysAtTheBottom() {
        #expect(
            ThreadReplyScrollPosition.isNearBottom(
                contentHeight: 240,
                containerHeight: 640,
                visibleMaxY: -160
            )
        )
    }

    @Test func longThreadUsesTheVisibleTrailingEdge() {
        #expect(
            !ThreadReplyScrollPosition.isNearBottom(
                contentHeight: 1_200,
                containerHeight: 640,
                visibleMaxY: 800
            )
        )
        #expect(
            ThreadReplyScrollPosition.isNearBottom(
                contentHeight: 1_200,
                containerHeight: 640,
                visibleMaxY: 1_150
            )
        )
    }

    @Test func restingAtTheBottomIsNotPastTheContent() {
        #expect(
            !ThreadReplyScrollPosition.isPastContentEnd(
                contentHeight: 1_200,
                containerHeight: 640,
                bottomInset: 86,
                visibleMaxY: 1_286
            )
        )
    }

    @Test func aShrunkContentHeightStrandsTheReplies() {
        #expect(
            ThreadReplyScrollPosition.isPastContentEnd(
                contentHeight: 1_200,
                containerHeight: 640,
                bottomInset: 86,
                visibleMaxY: 1_900
            )
        )
    }

    @Test func repliesShorterThanTheScreenAreNeverPastTheirContent() {
        #expect(
            !ThreadReplyScrollPosition.isPastContentEnd(
                contentHeight: 120,
                containerHeight: 640,
                bottomInset: 86,
                visibleMaxY: 726
            )
        )
    }
}
