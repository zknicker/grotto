import Foundation
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

@Suite("Prepared action card")
struct PreparedActionCardTests {
    @Test("the proposal's note is what the anchor message said")
    func notesReadAsTheMessageBody() {
        #expect(proposal(draftHint: "Runtime and model are yours to pick.").messageText
            == "Runtime and model are yours to pick.")
        #expect(proposal(draftHint: "Replaced draft", status: .superseded).messageText
            == "Replaced draft")
    }

    @Test("a superseded proposal with no note still leaves the row a body")
    func supersededProposalsFallBackToAShortNote() {
        #expect(proposal(draftHint: nil, status: .superseded).messageText
            == "Earlier proposal, replaced.")
        #expect(proposal(draftHint: "").messageText == "")
    }

    @Test("an empty Server body renders the note instead")
    func emptyAnchorBodiesRenderTheNote() {
        let message = MessagePresentation(
            id: "msg_1",
            author: MessageAuthorPresentation(id: "agent_cove", name: "Cove", avatarURL: nil),
            content: "",
            createdAt: .now,
            preparedAction: proposal(draftHint: "Give Marlow read access to #product first."),
            richSegments: []
        )

        #expect(message.content == "Give Marlow read access to #product first.")
        #expect(message.richSegments.isEmpty == false)
    }

    @Test("a card on screen when its proposal is superseded collapses out")
    func supersededCardsCollapseOutOnce() {
        #expect(ActionCardVisibility.resolve(hidden: false, superseded: false, wasVisible: false) == .live)
        #expect(ActionCardVisibility.resolve(hidden: false, superseded: true, wasVisible: true) == .exiting)
        #expect(ActionCardVisibility.resolve(hidden: true, superseded: true, wasVisible: true) == .hidden)
    }

    @Test("Open reaches the created Agent's own Chat, and stands down when it is gone")
    func openResolvesTheCreatedAgentsChat() {
        let marlow = AgentPresentation(id: "agt_marlow", name: "Marlow", avatarURL: nil, presence: .idle)
        let destinations: [ChatDestination] = [
            .durableChat(ChatPresentation(id: "product", title: "product", kind: .channel)),
            .implicitAgentDM(marlow),
        ]

        #expect(destinations.agentDestination(agentID: "agt_marlow")?.id == .agentDM("agt_marlow"))
        #expect(destinations.agentDestination(agentID: "agt_retired") == nil)
    }

    @Test("a proposal that arrives already superseded never renders a card")
    func alreadySupersededProposalsNeverRender() {
        #expect(ActionCardVisibility.resolve(hidden: false, superseded: true, wasVisible: false) == .hidden)
    }

    @Test("an unsupported kind keeps its card at every status")
    func unsupportedKindsAlwaysRender() {
        // Its row carries no note of its own, so collapsing the card the way a
        // superseded proposal does would leave nothing behind.
        let unsupported = PreparedActionPresentation.unsupported(
            UnsupportedPreparedActionPresentation(
                createdAt: .now,
                id: "act_2",
                kind: "cloud.run",
                status: .superseded
            )
        )

        #expect(unsupported.messageText == "")
        #expect(unsupported.leavesWhenSuperseded == false)
        #expect(proposal(draftHint: nil).leavesWhenSuperseded)
    }

    private func proposal(
        draftHint: String?,
        status: PreparedActionStatus = .pending
    ) -> PreparedActionPresentation {
        .createAgent(
            PreparedCreateAgentActionPresentation(
                avatarURL: nil,
                chatID: "chat_1",
                computerDetail: nil,
                createdAt: .now,
                description: "Docs steward",
                draftHint: draftHint,
                executedByDisplayName: nil,
                id: "act_1",
                name: "Marlow",
                proposedComputerID: nil,
                requiredComputerID: nil,
                status: status
            )
        )
    }
}

@Suite("Prepared action detail")
struct PreparedActionDetailTests {
    private let executedAt = Date(timeIntervalSince1970: 1_700_000_000)

    @Test("the sheet is the whole proposal the card only summarizes")
    func detailCarriesTheFullRecord() {
        let detail = PreparedActionDetail.resolve(proposal(), canManage: true)

        #expect(PreparedActionDetail.title == "Agent proposal")
        #expect(detail.name == "Orbit")
        #expect(detail.description == longDescription)
        #expect(detail.runsOn == "Mac mini (suggested)")
        #expect(detail.note == "Runtime and model are yours to pick.")
        #expect(detail.receipt == nil)
        #expect(detail.status == nil)
    }

    @Test("a part with nothing to say is left out rather than drawn empty")
    func emptyValuesLeaveNoRow() {
        let detail = PreparedActionDetail.resolve(
            proposal(computerDetail: nil, description: "", draftHint: ""),
            canManage: true
        )

        #expect(detail.description == nil)
        #expect(detail.note == nil)
        #expect(detail.runsOn == nil)
    }

    @Test("the sheet offers exactly the action the card does")
    func detailAndCardOfferOneAction() {
        #expect(PreparedActionDetail.resolve(proposal(), canManage: true).action == .createAgent)
        #expect(PreparedActionDetail.resolve(proposal(), canManage: false).action == PreparedActionDetail.Action.none)
        #expect(PreparedActionDetail.resolve(
            proposal(status: .superseded),
            canManage: true
        ).action == PreparedActionDetail.Action.none)
        #expect(PreparedActionDetail.resolve(
            proposal(createdAgentID: "agt_orbit", status: .executed),
            canManage: false
        ).action == .openAgent(id: "agt_orbit"))
    }

    @Test("an executed proposal names who committed it and when")
    func executedProposalsCarryTheirReceipt() {
        let detail = PreparedActionDetail.resolve(
            proposal(
                createdAgentID: "agt_orbit",
                executedByDisplayName: "Zach Knickerbocker",
                status: .executed
            ),
            canManage: true
        )

        #expect(detail.status?.label == "Created")
        #expect(detail.receipt == "Created by Zach Knickerbocker · \(executedAt.formatted(.dateTime.hour().minute()))")
    }

    private var longDescription: String {
        "Release manager. Watches CI, prepares releases.json, and keeps the target jobs honest across every checkout."
    }

    private func proposal(
        computerDetail: String? = "Mac mini (suggested)",
        createdAgentID: String? = nil,
        description: String? = nil,
        draftHint: String? = "Runtime and model are yours to pick.",
        executedByDisplayName: String? = nil,
        status: PreparedActionStatus = .pending
    ) -> PreparedCreateAgentActionPresentation {
        PreparedCreateAgentActionPresentation(
            avatarURL: nil,
            chatID: "chat_1",
            computerDetail: computerDetail,
            createdAgentID: createdAgentID,
            createdAt: .now,
            description: description ?? longDescription,
            draftHint: draftHint,
            executedAt: status == .executed ? executedAt : nil,
            executedByDisplayName: executedByDisplayName,
            id: "act_1",
            name: "Orbit",
            proposedComputerID: nil,
            requiredComputerID: nil,
            status: status
        )
    }
}
