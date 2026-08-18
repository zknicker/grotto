import Foundation
import GrottoModels
import OSLog

extension GrottoStore {
    private static let realtimeLogger = Logger(
        subsystem: "build.grotto.ios",
        category: "chat-realtime"
    )

    /// Recovers the durable Chat log while the live SSE subscription is
    /// starting or reconnecting. The SSE connection is established first;
    /// this walk then completes before its buffered live events are consumed,
    /// closing the reconnect gap without losing events that arrive meanwhile.
    func catchUpChatEvents(serverID: String) async {
        guard !Task.isCancelled, activeServer?.id == serverID else { return }
        if chatEventCatchUpInFlight {
            chatEventCatchUpPending = true
            return
        }

        chatEventCatchUpInFlight = true
        defer { chatEventCatchUpInFlight = false }

        repeat {
            chatEventCatchUpPending = false
            await performChatEventCatchUp(serverID: serverID)
        } while chatEventCatchUpPending && !Task.isCancelled
    }

    private func performChatEventCatchUp(serverID: String) async {
        guard !Task.isCancelled, activeServer?.id == serverID else { return }

        do {
            if chatEventReplay.cursor == "0" {
                let head: ChatEventHead = try await client.query(
                    "chat.eventHead",
                    input: ServerScopedInput(serverId: serverID)
                )
                guard !Task.isCancelled, activeServer?.id == serverID else { return }
                try await refreshServerSnapshot(serverID: serverID)
                // The snapshot is the proof that every event through `head`
                // is represented locally. Keep cursor zero when it fails so
                // the next connection retries the cold-start recovery.
                chatEventReplay.advance(to: head.cursor)
                return
            }

            let (events, walkedCursor) = try await walkChatEvents(
                serverID: serverID,
                afterCursor: chatEventReplay.cursor
            )
            guard !Task.isCancelled, activeServer?.id == serverID else { return }
            await applyChatEvents(events, serverID: serverID)
            chatEventReplay.advance(to: walkedCursor)
        } catch is CancellationError {
            return
        } catch {
            sendError = error.localizedDescription
            Self.realtimeLogger.error(
                "Chat event catch-up failed: \(error.localizedDescription, privacy: .public)"
            )
        }
    }

    private func walkChatEvents(
        serverID: String,
        afterCursor: String
    ) async throws -> ([ChatEvent], String) {
        let pageSize = 100
        var cursor = afterCursor
        var events: [ChatEvent] = []

        while !Task.isCancelled {
            let page: [ChatEvent] = try await client.query(
                "chat.events",
                input: ChatEventsInput(
                    afterCursor: cursor,
                    limit: pageSize,
                    serverId: serverID
                )
            )
            guard !page.isEmpty else { break }
            events.append(contentsOf: page)
            if let lastCursor = page.last?.cursor {
                cursor = ChatEventCursor.later(cursor, lastCursor)
            }
            if page.count < pageSize {
                break
            }
        }

        return (events, cursor)
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
}
