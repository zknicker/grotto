import GrottoModels
import OSLog

extension GrottoStore {
    func loadMessages(chatID: String) async {
        guard let serverID = activeServer?.id else { return }
        do {
            let page: ChatMessagePage = try await client.query(
                "chat.messages",
                input: ChatMessagesInput(serverId: serverID, chatId: chatID, limit: 50)
            )
            let storedPage: ChatMessagePage
            if let existing = messagesByChatID[chatID],
               let existingFirstSequence = existing.messages.first?.sequence,
               let pageFirstSequence = page.messages.first?.sequence,
               existingFirstSequence < pageFirstSequence {
                storedPage = page.merging(older: existing)
            } else {
                storedPage = page
            }
            messagesByChatID[chatID] = storedPage
            reconcilePendingMessages(chatID: chatID, page: storedPage)
        } catch {
            sendError = error.localizedDescription
            Self.logger.error("Loading messages failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func hasOlderMessages(chatID: String) -> Bool {
        messagesByChatID[chatID]?.nextBeforeSequence != nil
    }

    func isLoadingOlderMessages(chatID: String) -> Bool {
        olderMessageLoadsInFlight.contains(chatID)
    }

    @discardableResult
    func loadOlderMessages(chatID: String) async -> Bool {
        guard let serverID = activeServer?.id,
              let current = messagesByChatID[chatID],
              let beforeSequence = current.nextBeforeSequence,
              olderMessageLoadsInFlight.insert(chatID).inserted
        else { return false }
        defer { olderMessageLoadsInFlight.remove(chatID) }

        do {
            let older: ChatMessagePage = try await client.query(
                "chat.messages",
                input: ChatMessagesInput(
                    serverId: serverID,
                    chatId: chatID,
                    limit: 50,
                    beforeSequence: beforeSequence
                )
            )
            let merged = messagesByChatID[chatID, default: current].merging(older: older)
            messagesByChatID[chatID] = merged
            reconcilePendingMessages(chatID: chatID, page: merged)
            return true
        } catch {
            sendError = error.localizedDescription
            Self.logger.error("Loading older messages failed: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    func availability(for agent: AgentSummary) -> AgentAvailability {
        lifecycleAvailability[agent.id] ?? agent.availability
    }
}
