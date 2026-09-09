import Foundation
import GrottoModels
import Testing

/// An Agent creating an Agent reaches the phone as one typed Message body. The
/// Server projects the live Agent row onto it, so decoding has to survive a
/// retired Agent, a missing avatar and description, and a body kind this build
/// has never heard of.
@Suite struct AgentCreatedModelsTests {
    @Test func decodesTheCreatedAgentFromTheMessageBody() throws {
        let body = try decodeBody(
            """
            {"kind":"agent-created","agent":{"agentId":"agt_orbit",
             "avatarUrl":"/api/avatars/av_1","description":"Watches CI.",
             "displayName":"Orbit","handle":"orbit","retired":false}}
            """
        )

        guard case let .agentCreated(agent) = body else {
            Issue.record("expected an agent-created body")
            return
        }
        #expect(agent.agentID == "agt_orbit")
        #expect(agent.avatarURL == "/api/avatars/av_1")
        #expect(agent.description == "Watches CI.")
        #expect(agent.displayName == "Orbit")
        #expect(agent.handle == "orbit")
        #expect(!agent.retired)
    }

    @Test func keepsARetiredAgentRatherThanDroppingTheBody() throws {
        let body = try decodeBody(
            """
            {"kind":"agent-created","agent":{"agentId":"agt_marlow","avatarUrl":null,
             "description":null,"displayName":"Marlow","handle":"marlow","retired":true}}
            """
        )

        guard case let .agentCreated(agent) = body else {
            Issue.record("expected an agent-created body")
            return
        }
        #expect(agent.retired)
        #expect(agent.avatarURL == nil)
        #expect(agent.description == nil)
    }

    @Test func roundTripsThroughTheProductionCodingFactories() throws {
        let body = ChatMessageBody.agentCreated(
            CreatedAgentSummary(
                agentID: "agt_orbit",
                avatarURL: nil,
                description: nil,
                displayName: "Orbit",
                handle: "orbit",
                retired: false
            )
        )
        let encoded = try GrottoJSON.encoder().encode(body)

        #expect(try GrottoJSON.decoder().decode(ChatMessageBody.self, from: encoded) == body)
    }

    /// A Server ahead of this build must not break the transcript: an unknown
    /// kind keeps its prose and loses only the body Grotto cannot read.
    @Test func unknownBodyKindsStillDegradeToUnsupported() throws {
        #expect(try decodeBody(#"{"kind":"agent-retired","agent":{"anything":true}}"#)
            == .unsupported("agent-retired"))
        #expect(try decodeBody(#"{"kind":"text"}"#) == .text)
    }

    /// The Message carries the body; nothing else on the row moved.
    @Test func messagesCarryTheBodyBesideTheirAuthoredContent() throws {
        let json = """
        {"attachments":[],"author":{"kind":"agent","agentId":"agt_cove"},
         "body":{"kind":"agent-created","agent":{"agentId":"agt_orbit","avatarUrl":null,
         "description":null,"displayName":"Orbit","handle":"orbit","retired":false}},
         "chatId":"cht_product","content":"Meet Orbit.","createdAt":"2026-09-07T18:00:00Z",
         "id":"msg_1","nonce":"n-1","sequence":4,"serverId":"srv_1"}
        """
        let message = try GrottoJSON.decoder().decode(ChatMessage.self, from: Data(json.utf8))

        #expect(message.content == "Meet Orbit.")
        guard case let .agentCreated(agent) = message.body else {
            Issue.record("expected an agent-created body")
            return
        }
        #expect(agent.handle == "orbit")
    }

    private func decodeBody(_ json: String) throws -> ChatMessageBody {
        try GrottoJSON.decoder().decode(ChatMessageBody.self, from: Data(json.utf8))
    }
}
