import Foundation
import XCTest
@testable import GrottoModels

final class AgentActivityModelsTests: XCTestCase {
    func testDecodesSemanticActivityWireContract() throws {
        let event = try GrottoJSON.decoder().decode(
            AgentActivityEvent.self,
            from: Data(
                """
                {"agentId":"agent_1","category":"reading_files","id":"activity_1","occurredAt":"2026-08-16T12:00:00Z","phase":"started","position":4,"producer":"computer","producerId":"computer_1","producerSequence":3,"runId":"run_1","serverId":"server_1","toolRef":"read"}
                """.utf8
            )
        )

        XCTAssertEqual(event.category, .readingFiles)
        XCTAssertEqual(event.phase, .started)
        XCTAssertEqual(event.runID, "run_1")
        XCTAssertFalse(event.isTerminal)
    }

    func testRecognizesTerminalAndFinishingServerEvents() {
        let finishing = event(category: .sendingMessage, phase: .completed)
        let terminal = event(category: .working, phase: .completed)

        XCTAssertTrue(finishing.isFinishing)
        XCTAssertFalse(finishing.isTerminal)
        XCTAssertTrue(terminal.isTerminal)
        XCTAssertEqual(finishing.projectedAsWorking().phase, .started)
        XCTAssertEqual(finishing.projectedAsWorking().category, .working)
    }

    private func event(
        category: AgentActivityCategory,
        phase: AgentActivityPhase
    ) -> AgentActivityEvent {
        AgentActivityEvent(
            agentID: "agent_1",
            category: category,
            id: "activity_1",
            occurredAt: Date(timeIntervalSince1970: 1),
            phase: phase,
            position: 1,
            producer: .server,
            producerID: "server_1",
            producerSequence: 1,
            runID: "run_1",
            serverID: "server_1"
        )
    }
}
