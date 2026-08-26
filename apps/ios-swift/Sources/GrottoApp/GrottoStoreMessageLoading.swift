import GrottoModels
import OSLog

/// The loaded Chat pages: what refreshes them, and how the viewer's optimistic
/// rows are retired against them.
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
            // A no-op refetch — a read echo, an event for a sibling Chat — must
            // not invalidate the timeline that is already showing this page.
            // The setter drops the equal write.
            messagesByChatID[chatID] = storedPage
            // Same synchronous pass as the page write: no frame can show the
            // optimistic row beside the canonical one, or neither of them.
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

    /// Refetches only the loaded message pages touched by the event batch,
    /// while refreshing the Chat list once for ordering, unread counts, and
    /// lifecycle changes. Event IDs make live/catch-up overlap idempotent.
    func applyChatEvents(_ events: [ChatEvent], serverID: String) async {
        guard activeServer?.id == serverID, chatEventServerID == serverID else { return }

        var affectedChatIDs: Set<String> = []
        var shouldReloadChats = false
        for event in events {
            guard event.serverID == serverID else { continue }
            guard chatEventReplay.receive(event) else { continue }

            switch event.type {
            case .messageCreated:
                if let chatID = event.chatID {
                    affectedChatIDs.insert(chatID)
                }
                if let parentChatID = event.parentChatID {
                    affectedChatIDs.insert(parentChatID)
                }
                shouldReloadChats = true
            case .chatRead:
                // Server addresses this event to the reader alone, so every one
                // that reaches this client is the echo of its own
                // acknowledgement. It is the single refresh for that read.
                shouldReloadChats = true
            case .threadFollowUpdated:
                if let parentChatID = event.parentChatID {
                    affectedChatIDs.insert(parentChatID)
                }
                shouldReloadChats = true
            case .taskCreated, .taskUpdated:
                if let chatID = event.chatID {
                    affectedChatIDs.insert(chatID)
                }
            case .chatLifecycle:
                shouldReloadChats = true
            case .taskLabelUpdated, .reminderChanged:
                break
            }
        }

        for chatID in affectedChatIDs.sorted() where messagesByChatID[chatID] != nil {
            await loadMessages(chatID: chatID)
            if openChatID == chatID {
                await markChatReadIfNeeded(chatID: chatID)
            }
        }
        if shouldReloadChats {
            try? await reloadChats(serverID: serverID)
        }
    }

    // MARK: - Optimistic rows

    /// Binds the optimistic row to the canonical message the send receipt
    /// named, before the page carrying it is refetched. The durable row that
    /// replaces it then arrives under the same id, so the transcript updates
    /// that row in place instead of dropping it and inserting a new one.
    func adoptSentMessageID(_ messageID: String, nonce: String, in chatID: String) {
        guard var pending = pendingMessagesByChatID[chatID],
              let index = pending.firstIndex(where: { $0.nonce == nonce })
        else { return }

        pending[index].serverMessageID = messageID
        pendingMessagesByChatID[chatID] = pending
    }

    /// Retires the optimistic rows this page now accounts for. The projection
    /// applies the same rule while rendering, so the two can never disagree
    /// about which row is on screen.
    func reconcilePendingMessages(chatID: String, page: ChatMessagePage) {
        guard let pending = pendingMessagesByChatID[chatID] else { return }
        let durableNonces = OptimisticMessageRow.durableNonces(in: page.messages)
        let remaining = pending.filter {
            !OptimisticMessageRow.isSuperseded(nonce: $0.nonce, durableNonces: durableNonces)
        }
        if remaining.isEmpty {
            pendingMessagesByChatID.removeValue(forKey: chatID)
        } else {
            pendingMessagesByChatID[chatID] = remaining
        }
    }

    func removePendingMessage(chatID: String, nonce: String) {
        pendingMessagesByChatID[chatID]?.removeAll { $0.nonce == nonce }
        if pendingMessagesByChatID[chatID]?.isEmpty == true {
            pendingMessagesByChatID.removeValue(forKey: chatID)
        }
    }

    func removePendingMessage(nonce: String) {
        for chatID in Array(pendingMessagesByChatID.keys) {
            removePendingMessage(chatID: chatID, nonce: nonce)
        }
    }

    func adoptPendingMessages(from sourceChatID: String, to canonicalChatID: String) {
        guard sourceChatID != canonicalChatID,
              let pending = pendingMessagesByChatID.removeValue(forKey: sourceChatID),
              !pending.isEmpty
        else { return }

        pendingMessagesByChatID[canonicalChatID, default: []].append(contentsOf: pending)
    }
}
