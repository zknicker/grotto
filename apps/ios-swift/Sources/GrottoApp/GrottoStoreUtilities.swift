import Foundation
import GrottoModels

/// Server-backed reads and mutations used by utility navigation surfaces.
///
/// These calls deliberately stay on the existing store and tRPC client: utility
/// screens do not get a second cache or a mobile-only API abstraction.
extension GrottoStore {
    func searchChatMessages(input: ChatSearchInput) async throws -> [ChatSearchResult] {
        try await client.query("chat.search", input: input)
    }

    func listArchivedChats(serverID: String) async throws -> [ChatSummary] {
        try await client.query(
            "chat.listArchived",
            input: ArchivedChatsInput(serverID: serverID)
        )
    }

    @discardableResult
    func createChannel(
        name: String,
        agentIDs: [String],
        serverID: String
    ) async throws -> ChatSummary {
        let created: ChatSummary = try await client.mutation(
            "chat.createChannel",
            input: CreateChannelInput(agentIDs: agentIDs, name: name, serverID: serverID)
        )
        try await reloadChats(serverID: serverID)
        return created
    }

    @discardableResult
    func unarchiveChannel(
        chatID: String,
        serverID: String
    ) async throws -> ChatChannelLifecycleReceipt {
        let receipt: ChatChannelLifecycleReceipt = try await client.mutation(
            "chat.unarchiveChannel",
            input: ChatScopeInput(chatID: chatID, serverID: serverID)
        )
        try await reloadChats(serverID: serverID)
        return receipt
    }
}
