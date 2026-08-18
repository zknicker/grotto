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
}
