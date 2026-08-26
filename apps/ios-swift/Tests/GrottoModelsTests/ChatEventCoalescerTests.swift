import Foundation
import XCTest
@testable import GrottoModels

final class ChatEventCoalescerTests: XCTestCase {
    func testFirstEventOpensAWindowAndLaterEventsJoinIt() {
        var coalescer = ChatEventCoalescer()

        XCTAssertEqual(coalescer.buffer(event(cursor: "1")), .scheduleFlush)
        XCTAssertEqual(coalescer.buffer(event(cursor: "2")), .awaitScheduledFlush)
        XCTAssertEqual(coalescer.buffer(event(cursor: "3")), .awaitScheduledFlush)
        XCTAssertEqual(coalescer.count, 3)
    }

    func testDrainReturnsTheBatchInArrivalOrderAndEmptiesTheBuffer() {
        var coalescer = ChatEventCoalescer()
        _ = coalescer.buffer(event(cursor: "1"))
        _ = coalescer.buffer(event(cursor: "2"))

        XCTAssertEqual(coalescer.drain().map(\.cursor), ["1", "2"])
        XCTAssertTrue(coalescer.isEmpty)
        XCTAssertEqual(coalescer.drain(), [])
    }

    func testDrainingClosesTheWindowSoTheNextEventSchedulesAgain() {
        var coalescer = ChatEventCoalescer()
        _ = coalescer.buffer(event(cursor: "1"))
        _ = coalescer.drain()

        XCTAssertEqual(coalescer.buffer(event(cursor: "2")), .scheduleFlush)
    }

    func testReachingTheBatchLimitFlushesWithoutWaitingForTheWindow() {
        var coalescer = ChatEventCoalescer(batchLimit: 3)

        XCTAssertEqual(coalescer.buffer(event(cursor: "1")), .scheduleFlush)
        XCTAssertEqual(coalescer.buffer(event(cursor: "2")), .awaitScheduledFlush)
        XCTAssertEqual(coalescer.buffer(event(cursor: "3")), .flushNow)
        XCTAssertEqual(coalescer.drain().map(\.cursor), ["1", "2", "3"])
        // The limited flush closed the window, so the next burst reschedules.
        XCTAssertEqual(coalescer.buffer(event(cursor: "4")), .scheduleFlush)
    }

    func testABatchLimitOfOneNeverBuffers() {
        var coalescer = ChatEventCoalescer(batchLimit: 1)

        XCTAssertEqual(coalescer.buffer(event(cursor: "1")), .flushNow)
        XCTAssertEqual(coalescer.drain().map(\.cursor), ["1"])
        XCTAssertEqual(coalescer.buffer(event(cursor: "2")), .flushNow)
    }

    func testAnInvalidBatchLimitIsClampedRatherThanTrapping() {
        var coalescer = ChatEventCoalescer(batchLimit: 0)

        XCTAssertEqual(coalescer.batchLimit, 1)
        XCTAssertEqual(coalescer.buffer(event(cursor: "1")), .flushNow)
    }

    private func event(cursor: String) -> ChatEvent {
        ChatEvent(
            chatID: "chat_1",
            createdAt: Date(timeIntervalSince1970: 1),
            cursor: cursor,
            id: "event_\(cursor)",
            parentChatID: nil,
            sequence: Int(cursor) ?? 0,
            serverID: "server_1",
            type: .messageCreated
        )
    }
}
