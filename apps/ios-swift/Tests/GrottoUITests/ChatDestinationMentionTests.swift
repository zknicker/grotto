import Foundation
import Testing
@testable import GrottoUI

@Suite struct ChatDestinationMentionTests {
    private let agent = AgentPresentation(
        id: "agt_cove",
        name: "Cove",
        avatarURL: nil,
        presence: .idle
    )

    @Test func implicitAgentDestinationHasNoDurableChat() {
        let destination = ChatDestination.implicitAgentDM(agent)

        #expect(destination.id == .agentDM("agt_cove"))
        #expect(destination.durableChat == nil)
        #expect(destination.pendingKey == "agent-dm:agt_cove")
    }

    @Test func materializedAgentDestinationKeepsTheServerChatID() {
        let chat = ChatPresentation(
            id: "chat_1",
            title: "Cove",
            kind: .agentDirectMessage(agent)
        )
        let destination = ChatDestination.durableChat(chat)

        #expect(destination.id == .chat("chat_1"))
        #expect(destination.durableChat?.id == "chat_1")
    }

    @Test func materializedHumanDestinationKeepsDirectoryIdentityAndServerChatID() throws {
        let human = HumanPresentation(
            id: "usr_ada",
            name: "Ada Lovelace",
            handle: "ada",
            avatarURL: nil
        )
        let destination = ChatDestination.durableChat(ChatPresentation(
            id: "chat_human",
            title: human.name,
            kind: .humanDirectMessage(human)
        ))

        #expect(destination.id == .chat("chat_human"))
        let kind = try #require(destination.durableChat?.kind)
        guard case .humanDirectMessage(let peer) = kind else {
            Issue.record("Expected a materialized human DM")
            return
        }
        #expect(peer.id == "usr_ada")
        #expect(peer.handle == "ada")
    }

    @Test func mentionSelectionSerializesSharedMarkdownSyntax() throws {
        let text = "Ask @ad"
        let query = try #require(ComposerMentionQuery.active(in: text))
        let option = MentionOptionPresentation(
            id: "user://usr_ada",
            insertText: "@Ada Lovelace",
            label: "Ada Lovelace",
            detail: "Human · @ada",
            kind: .human,
            avatarURL: nil
        )

        #expect(query.inserting(option, into: text) == "Ask [@Ada Lovelace](user://usr_ada) ")
    }

    @Test func richParserResolvesAgentAndHumanReferencesByImmutableID() {
        let segments = RichMessageParser.parse(
            "Ask [@Cove](agent://agt_cove) and [@Ada](user://usr_ada)."
        ) { kind, id, _ in
            RichReferencePresentation(id: id, kind: kind, label: id, avatarURL: nil)
        }

        #expect(segments.contains(.reference(.init(id: "agt_cove", kind: .agent, label: "agt_cove", avatarURL: nil))))
        #expect(segments.contains(.reference(.init(id: "usr_ada", kind: .human, label: "usr_ada", avatarURL: nil))))
    }
}

@Suite struct ParticipantHandleValidationTests {
    @Test(arguments: ["ada", "ada-2", "a1"])
    func acceptsSharedHandleGrammar(_ value: String) {
        #expect(ParticipantHandleValidation.error(for: value) == nil)
    }

    @Test func rejectsReservedAndMalformedHandles() {
        #expect(ParticipantHandleValidation.error(for: "grotto") != nil)
        #expect(ParticipantHandleValidation.error(for: "Ada Lovelace") != nil)
        #expect(ParticipantHandleValidation.error(for: "a") != nil)
    }
}
