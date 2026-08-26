import Foundation
import GrottoModels
import GrottoUI
import OSLog

private let readStateLogger = Logger(
    subsystem: "build.grotto.ios",
    category: "chat-read"
)

extension GrottoStore {
    /// Loads the selected Chat and acknowledges only the history currently visible
    /// in that open surface. Unselected cached Chats stay unread.
    func openChat(chatID: String) async {
        openChatID = chatID
        await loadMessages(chatID: chatID)
        await markChatReadIfNeeded(chatID: chatID)
    }

    /// Mirrors the React `useChatRead` view key while keeping unread counts
    /// Server-owned.
    ///
    /// The durable `chat.read` event owns the Chat-list refresh, exactly as the
    /// web App's `useChatRead` does. Server writes that event only when the read
    /// actually moved, addresses it to the reader alone, and both live delivery
    /// and the reconnect walk carry it, so one acknowledgement produces one list
    /// refresh. Refreshing here as well made every opened Chat refetch twice.
    func markChatReadIfNeeded(chatID: String) async {
        guard let serverID = activeServer?.id,
              openChatID == chatID,
              let sequence = messagesByChatID[chatID]?.messages.last?.sequence,
              sequence > 0
        else { return }

        let scope = ChatReadScope(serverID: serverID, chatID: chatID)
        guard (acknowledgedReadSequences[scope] ?? 0) < sequence else { return }

        let acknowledgement = ChatReadAcknowledgement(scope: scope, sequence: sequence)
        guard readAcknowledgementsInFlight.insert(acknowledgement).inserted else { return }
        defer { readAcknowledgementsInFlight.remove(acknowledgement) }

        do {
            let receipt: ChatReadReceipt = try await client.mutation(
                "chat.markRead",
                input: ChatReadInput(chatID: chatID, sequence: sequence, serverID: serverID)
            )
            guard activeServer?.id == serverID else { return }
            acknowledgedReadSequences[scope] = max(
                acknowledgedReadSequences[scope] ?? 0,
                receipt.sequence
            )

            // A new message can land while the mutation is in flight. Match the
            // view-key effect by immediately acknowledging the newer loaded tail.
            if openChatID == chatID,
               let latest = messagesByChatID[chatID]?.messages.last?.sequence,
               latest > (acknowledgedReadSequences[scope] ?? 0) {
                await markChatReadIfNeeded(chatID: chatID)
            }
        } catch is CancellationError {
            return
        } catch {
            readStateLogger.error(
                "Marking Chat read failed: \(error.localizedDescription, privacy: .public)"
            )
        }
    }

    func threadChatID(parentChatID: String, anchorMessageID: String) -> String? {
        messagesByChatID[parentChatID]?.threads.first {
            $0.anchorMessageID == anchorMessageID
        }?.threadChatID
    }

    /// Local-only key for optimistic replies before Server creates the child
    /// Chat. This value must never be sent to a Server procedure.
    func pendingThreadChatID(anchorMessageID: String) -> String {
        "thread-pending:\(anchorMessageID)"
    }

    @discardableResult
    func send(
        _ content: String,
        to chatID: String,
        attachments: [ComposerAttachment] = [],
        threadAnchorMessageID: String? = nil,
        pendingChatID: String? = nil,
        attachmentChatID: String? = nil
    ) async -> Bool {
        await sendReceipt(
            content,
            to: chatID,
            attachments: attachments,
            threadAnchorMessageID: threadAnchorMessageID,
            pendingChatID: pendingChatID,
            attachmentChatID: attachmentChatID
        ) != nil
    }

    /// Sends a Thread reply through the parent Chat and returns the canonical
    /// child Chat id created (or found) by Server. The child id is deliberately
    /// receipt-backed: the iPhone client must never derive or invent one while
    /// the first reply is in flight.
    @discardableResult
    func sendThreadReply(
        _ content: String,
        to parentChatID: String,
        anchorMessageID: String,
        pendingChatID: String? = nil,
        attachments: [ComposerAttachment] = [],
        attachmentChatID: String? = nil
    ) async -> String? {
        let receipt = await sendReceipt(
            content,
            to: parentChatID,
            attachments: attachments,
            threadAnchorMessageID: anchorMessageID,
            pendingChatID: pendingChatID,
            attachmentChatID: attachmentChatID
        )
        return receipt?.threadChatID
    }

    private func sendReceipt(
        _ content: String,
        to chatID: String,
        attachments: [ComposerAttachment],
        threadAnchorMessageID: String?,
        pendingChatID: String?,
        attachmentChatID: String?
    ) async -> SendReceipt? {
        guard let serverID = activeServer?.id else { return nil }
        let content = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty || !attachments.isEmpty else { return nil }
        let uploadChatID = attachmentChatID ?? chatID
        if !attachments.isEmpty, threadAnchorMessageID != nil, attachmentChatID == nil {
            sendError = "Send one reply before attaching a file to a new Thread."
            return nil
        }

        let nonce = UUID().uuidString.lowercased()
        let pendingChatID = pendingChatID ?? chatID
        pendingMessagesByChatID[pendingChatID, default: []].append(
            PendingChatMessage(
                attachments: attachments,
                chatID: pendingChatID,
                content: content,
                createdAt: .now,
                nonce: nonce
            )
        )
        sendError = nil

        do {
            let uploadedAttachments = try await uploadAttachments(
                attachments,
                serverID: serverID,
                chatID: uploadChatID
            )
            let receipt: SendReceipt = try await client.mutation(
                "chat.send",
                input: ChatSendInput(
                    serverId: serverID,
                    chatId: chatID,
                    content: content,
                    nonce: nonce,
                    attachmentIds: uploadedAttachments.map(\.id),
                    thread: threadAnchorMessageID.map(ChatThreadInput.init(anchorMessageId:))
                )
            )
            // A first reply is optimistically keyed by its anchor (or another
            // temporary route key). Move it to the child Chat returned by
            // Server before loading that page so reconciliation retires the
            // pending row instead of leaving a duplicate in the transcript.
            adoptPendingMessages(from: pendingChatID, to: receipt.message.chatID)
            await loadMessages(chatID: receipt.message.chatID)
            await markChatReadIfNeeded(chatID: receipt.message.chatID)
            if threadAnchorMessageID != nil {
                // Thread sends are addressed to the parent Chat plus anchor. Refresh both
                // pages because the receipt lives in the child Chat while its reply count
                // is projected onto the parent anchor.
                await loadMessages(chatID: chatID)
            }
            // The send receipt is the durable acknowledgement. A projection
            // refresh can race with the event stream; it must not turn an
            // accepted message back into a failed mutation or strand the
            // optimistic row after it has been moved to the canonical Chat.
            try? await reloadChats(serverID: serverID)
            return receipt
        } catch {
            // Another in-flight send can adopt this row into the canonical
            // child before this mutation fails. Remove by nonce across both
            // the provisional and canonical keys.
            removePendingMessage(nonce: nonce)
            sendError = error.localizedDescription
            return nil
        }
    }

    func downloadAttachment(_ attachment: MessageAttachmentPresentation) async throws -> URL {
        if let localURL = attachment.localURL { return localURL }
        guard let serverID = activeServer?.id else { throw GrottoStoreError.serverUnavailable }
        return try await client.downloadAttachment(
            serverID: serverID,
            attachmentID: attachment.id,
            displayFilename: attachment.filename
        )
    }

    private func uploadAttachments(
        _ attachments: [ComposerAttachment],
        serverID: String,
        chatID: String
    ) async throws -> [AttachmentMetadata] {
        var uploaded: [AttachmentMetadata] = []
        uploaded.reserveCapacity(attachments.count)
        for attachment in attachments {
            let reservation: AttachmentReservation = try await client.mutation(
                "attachment.reserve",
                input: AttachmentReserveInput(
                    chatId: chatID,
                    filename: attachment.filename,
                    mediaType: attachment.mediaType,
                    nonce: attachment.id,
                    serverId: serverID
                )
            )
            guard attachment.sizeBytes <= reservation.maxSizeBytes else {
                throw AttachmentSendError.tooLarge(filename: attachment.filename)
            }
            let result = try await client.uploadAttachment(
                serverID: serverID,
                attachmentID: reservation.attachmentId,
                fileURL: attachment.localURL
            )
            uploaded.append(result.attachment)
        }
        return uploaded
    }

    func reloadChats(serverID: String) async throws {
        let refreshed: [ChatSummary] = try await client.query(
            "chat.list",
            input: ServerScopedInput(serverId: serverID)
        )
        // Events, sends, and reads all land here, and most of those reads come
        // back byte-identical. A freshly decoded equal value is still a write
        // Observation reports, which is what reshuffled the sidebar mid-gesture.
        if chats != refreshed { chats = refreshed }
    }

    func reconcilePendingMessages(chatID: String, page: ChatMessagePage) {
        guard let pending = pendingMessagesByChatID[chatID] else { return }
        let remaining = pending.filter { message in
            !page.messages.contains { $0.nonce == message.nonce }
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

private enum AttachmentSendError: LocalizedError {
    case tooLarge(filename: String)

    var errorDescription: String? {
        switch self {
        case .tooLarge(let filename): "\(filename) exceeds the Server’s attachment limit."
        }
    }
}
