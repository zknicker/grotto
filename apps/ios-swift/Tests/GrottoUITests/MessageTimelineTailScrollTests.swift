@testable import GrottoUI
import Testing

struct MessageTimelineTailScrollTests {
    @Test func firstPageOfAChatArrivesAlreadySettled() {
        #expect(
            MessageTimelineTailScroll.decide(
                hadMessages: false,
                isNearBottom: true,
                isLatestPending: false
            ) == .snap
        )
    }

    @Test func firstPageSnapsEvenWhenTheReaderIsNotAtTheBottom() {
        // A freshly shown Chat has no reading position to respect yet, so the
        // page must not sweep into place.
        #expect(
            MessageTimelineTailScroll.decide(
                hadMessages: false,
                isNearBottom: false,
                isLatestPending: false
            ) == .snap
        )
    }

    @Test func appendAtTheBottomAnimates() {
        #expect(
            MessageTimelineTailScroll.decide(
                hadMessages: true,
                isNearBottom: true,
                isLatestPending: false
            ) == .animate
        )
    }

    @Test func ownSendRevealsItselfFromAboveTheTail() {
        #expect(
            MessageTimelineTailScroll.decide(
                hadMessages: true,
                isNearBottom: false,
                isLatestPending: true
            ) == .animate
        )
    }

    @Test func incomingMessageLeavesAScrolledBackReaderAlone() {
        #expect(
            MessageTimelineTailScroll.decide(
                hadMessages: true,
                isNearBottom: false,
                isLatestPending: false
            ) == .ignore
        )
    }
}

struct ChatCanvasOpenTests {
    @Test func opensTheSelectedChatWhileTheCanvasIsVisible() {
        #expect(
            ChatCanvasOpen.chatID(selectedID: .chat("c1"), isCovered: false) == "c1"
        )
    }

    @Test func standsDownWhileAPushedRouteCoversTheCanvas() {
        #expect(
            ChatCanvasOpen.chatID(selectedID: .chat("c1"), isCovered: true) == nil
        )
    }

    @Test func reopensTheSameChatOnceTheStackEmpties() {
        // Popping back from the Tasks list lands on the Chat the user left,
        // which the canvas then owns again.
        let covered = ChatCanvasOpen.chatID(selectedID: .chat("left"), isCovered: true)
        let uncovered = ChatCanvasOpen.chatID(selectedID: .chat("left"), isCovered: false)
        #expect(covered == nil)
        #expect(uncovered == "left")
    }

    @Test func anImplicitAgentDMHasNoServerChatToOpen() {
        #expect(ChatCanvasOpen.chatID(selectedID: .agentDM("a1"), isCovered: false) == nil)
        #expect(ChatCanvasOpen.chatID(selectedID: nil, isCovered: false) == nil)
    }
}
