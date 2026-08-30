@testable import GrottoUI
import Testing

struct MessageTimelineScrollPositionTests {
    @Test func shortTimelineIsAlwaysAtTheBottom() {
        #expect(
            MessageTimelineScrollPosition.isNearBottom(
                contentHeight: 240,
                containerHeight: 640,
                visibleMaxY: -160
            )
        )
    }

    @Test func longTimelineUsesTheVisibleTrailingEdge() {
        #expect(
            !MessageTimelineScrollPosition.isNearBottom(
                contentHeight: 1_200,
                containerHeight: 640,
                visibleMaxY: 800
            )
        )
        #expect(
            MessageTimelineScrollPosition.isNearBottom(
                contentHeight: 1_200,
                containerHeight: 640,
                visibleMaxY: 1_150
            )
        )
    }

    @Test func restingAtTheBottomIsNotPastTheContent() {
        // The composer's clearance is where the transcript legitimately ends.
        #expect(
            !MessageTimelineScrollPosition.isPastContentEnd(
                contentHeight: 4_356,
                containerHeight: 752,
                bottomInset: 86,
                visibleMaxY: 4_442
            )
        )
    }

    @Test func aShrunkContentHeightStrandsTheViewport() {
        // The bottom resolved against a taller estimate; the rows then settled
        // shorter and left the viewport most of a screen past the last one.
        #expect(
            MessageTimelineScrollPosition.isPastContentEnd(
                contentHeight: 4_279,
                containerHeight: 752,
                bottomInset: 86,
                visibleMaxY: 5_057
            )
        )
    }

    @Test func roundingBetweenLayoutPassesIsNotAStrandedViewport() {
        #expect(
            !MessageTimelineScrollPosition.isPastContentEnd(
                contentHeight: 4_356,
                containerHeight: 752,
                bottomInset: 86,
                visibleMaxY: 4_442.5
            )
        )
    }

    @Test func aTranscriptShorterThanTheScreenIsNeverPastItsContent() {
        // `defaultScrollAnchor(.bottom)` pads the top of a short transcript by
        // nearly a screen to sit it on the composer, which puts the viewport's
        // trailing edge far below the last row without anything being wrong.
        #expect(
            !MessageTimelineScrollPosition.isPastContentEnd(
                contentHeight: 28,
                containerHeight: 752,
                bottomInset: 86,
                visibleMaxY: 838
            )
        )
    }
}
