import GrottoModels
import Testing
@testable import GrottoUI

@Suite("Prepared Agent creation")
struct PreparedAgentCreationTests {
    private let computers = [
        PreparedAgentComputer(
            id: "computer_a",
            label: "MacBook",
            runtimes: [
                PreparedAgentRuntime(
                    id: "codex",
                    label: "Codex",
                    models: [PreparedAgentModel(id: "gpt-5", label: "GPT-5")]
                )
            ]
        ),
        PreparedAgentComputer(
            id: "computer_b",
            label: "Mac mini",
            runtimes: [
                PreparedAgentRuntime(
                    id: "claude",
                    label: "Claude Code",
                    models: [PreparedAgentModel(id: "opus", label: "Opus")]
                )
            ]
        ),
    ]

    @Test("proposal Computer wins while Cove supplies matching execution defaults")
    func resolvesProposalComputerDeterministically() {
        let cove = PreparedAgentDefaults(
            computerID: "computer_a",
            modelID: "gpt-5",
            reasoningEffort: .high,
            runtimeID: "codex"
        )

        let result = PreparedAgentCreationDefaults.resolve(
            proposedComputerID: "computer_b",
            computers: computers,
            cove: cove
        )

        #expect(result == PreparedAgentDefaults(
            computerID: "computer_b",
            modelID: "opus",
            reasoningEffort: .high,
            runtimeID: "claude"
        ))
    }

    @Test("stale proposal and Cove inventory fall back to the first reported path")
    func fallsBackToCurrentInventory() {
        let result = PreparedAgentCreationDefaults.resolve(
            proposedComputerID: "retired",
            computers: computers,
            cove: nil
        )

        #expect(result == PreparedAgentDefaults(
            computerID: "computer_a",
            modelID: "gpt-5",
            reasoningEffort: .medium,
            runtimeID: "codex"
        ))
    }

    @Test("a missing required Computer never falls back to another Computer")
    func rejectsUnavailableRequiredComputer() {
        let result = PreparedAgentCreationDefaults.resolve(
            proposedComputerID: "computer_b",
            requiredComputerID: "retired",
            computers: computers,
            cove: nil
        )

        #expect(result == nil)
    }

    @Test("handle generation normalizes names and avoids active collisions")
    func generatesAvailableHandle() {
        #expect(PreparedAgentHandle.create(name: "Möss Sprite", existingHandles: []) == "moss-sprite")
        #expect(PreparedAgentHandle.create(name: "Moss", existingHandles: ["moss"]) == "moss-2")
        #expect(PreparedAgentHandle.create(name: "Cove", existingHandles: []) == "cove-2")
    }
}
