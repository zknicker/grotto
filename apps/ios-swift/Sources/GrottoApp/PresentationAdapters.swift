import Foundation
import GrottoModels
import GrottoUI

extension GrottoStore {
    var settingsPersistence: SettingsPersistence {
        SettingsPersistence(
            saveHumanProfile: { [weak self] userID, displayName, description in
                guard let self else { throw CancellationError() }
                return try await self.saveHumanProfile(
                    userID: userID,
                    displayName: displayName,
                    description: description
                )
            },
            saveAgentProfile: { [weak self] agentID, displayName, description in
                guard let self else { throw CancellationError() }
                return try await self.saveAgentProfile(
                    agentID: agentID,
                    displayName: displayName,
                    description: description
                )
            },
            saveHumanAvatar: { [weak self] userID, payload in
                guard let self else { throw CancellationError() }
                return try await self.saveHumanAvatar(userID: userID, payload: payload)
            },
            saveAgentAvatar: { [weak self] agentID, payload in
                guard let self else { throw CancellationError() }
                return try await self.saveAgentAvatar(agentID: agentID, payload: payload)
            }
        )
    }

    var serverPresentation: ServerPresentation? {
        guard let server = activeServer else { return nil }
        return ServerPresentation(
            name: server.displayName,
            agentCount: agents.count,
            memberCount: members?.members.count ?? 0
        )
    }

    var chatPresentations: [ChatPresentation] {
        chats.compactMap { chat in
            switch chat.kind {
            case .channel:
                return ChatPresentation(
                    id: chat.id,
                    title: chat.name ?? (chat.isAll ? "all" : "Channel"),
                    kind: .channel,
                    unreadCount: chat.unreadCount,
                    appearance: ChannelAppearance(icon: chat.icon, color: chat.color)
                )
            case .dm:
                guard let agentID = chat.peerAgentID,
                      let agent = agents.first(where: { $0.id == agentID }) else { return nil }
                let presentation = AgentPresentation(
                    id: agent.id,
                    name: agent.displayName,
                    avatarURL: resolvedAvatarURL(agent.avatarURL),
                    presence: presence(availability(for: agent))
                )
                return ChatPresentation(
                    id: chat.id,
                    title: agent.displayName,
                    kind: .directMessage(agent: presentation),
                    unreadCount: chat.unreadCount
                )
            }
        }
    }

    func messagePresentations(chatID: String) -> [MessagePresentation] {
        let page = messagesByChatID[chatID]
        let threadByAnchor = Dictionary(uniqueKeysWithValues: (page?.threads ?? []).map { ($0.anchorMessageID, $0) })
        let durable: [MessagePresentation] = (page?.messages ?? []).compactMap { message in
            guard let author = authorPresentation(message.author) else { return nil }
            // Task records carry the canonical child Chat created with the task;
            // ordinary messages only gain a child id once a Thread exists.
            let thread = threadByAnchor[message.id].map(threadPresentation)
                ?? message.task.map { task in
                    ThreadPreviewPresentation(
                        threadChatID: task.threadChatID,
                        replyCount: 0,
                        unreadCount: 0,
                        latestReply: nil
                    )
                }
            return MessagePresentation(
                id: message.id,
                author: author,
                content: message.content,
                createdAt: message.createdAt,
                attachments: message.attachments.map(attachmentPresentation),
                thread: thread,
                task: message.task.map(taskPresentation)
            )
        }
        let pending = (pendingMessagesByChatID[chatID] ?? []).map { message in
            MessagePresentation(
                id: message.id,
                author: viewerAuthorPresentation,
                content: message.content,
                createdAt: message.createdAt,
                attachments: message.attachments.map(\.presentation),
                isPending: true
            )
        }
        return durable + pending
    }

    private func attachmentPresentation(_ attachment: AttachmentMetadata) -> MessageAttachmentPresentation {
        MessageAttachmentPresentation(
            id: attachment.id,
            filename: attachment.filename,
            mediaType: attachment.mediaType,
            sizeBytes: attachment.sizeBytes
        )
    }

    /// Projects a task-list row back into the shared message presentation used
    /// by the Chat-owned Thread route. Tasks are canonical messages, so the
    /// list lens must not invent a second thread presentation.
    func taskMessagePresentation(_ item: TaskListItem) -> MessagePresentation? {
        guard let author = authorPresentation(item.message.author) else { return nil }
        return MessagePresentation(
            id: item.message.id,
            author: author,
            content: item.message.content,
            createdAt: item.message.createdAt,
            thread: threadPresentation(item.threadSummary),
            task: taskPresentation(item.task)
        )
    }

    private func threadPresentation(_ thread: ThreadSummary) -> ThreadPreviewPresentation {
        ThreadPreviewPresentation(
            threadChatID: thread.threadChatID,
            replyCount: thread.replyCount,
            unreadCount: thread.unreadCount,
            latestReply: thread.recentReplies.last.flatMap { reply in
                guard let author = actorPresentation(
                    agentID: reply.authorAgentID,
                    userID: reply.authorUserID
                ) else { return nil }
                return ThreadReplyPresentation(
                    id: reply.id,
                    author: author,
                    content: reply.content,
                    createdAt: reply.createdAt
                )
            }
        )
    }

    private func taskPresentation(_ task: MessageTask) -> TaskPresentation {
        let status: TaskStatusPresentation = switch task.status {
        case .todo: .todo
        case .inProgress: .inProgress
        case .inReview: .inReview
        case .done: .done
        case .closed: .closed
        }
        return TaskPresentation(
            number: task.number,
            status: status,
            assignee: actorPresentation(
                agentID: task.assigneeAgentID,
                userID: task.assigneeUserID
            ),
            creator: actorPresentation(
                agentID: task.createdByAgentID,
                userID: task.createdByUserID
            )
        )
    }

    func actorPresentation(
        agentID: String?,
        userID: String?
    ) -> MessageAuthorPresentation? {
        if let agentID {
            let agent = agents.first { $0.id == agentID }
            return MessageAuthorPresentation(
                id: agentID,
                name: agent?.displayName ?? "Deleted agent",
                avatarURL: resolvedAvatarURL(agent?.avatarURL),
                presence: agent.map { presence(availability(for: $0)) }
            )
        }
        if let userID {
            let member = members?.members.first { $0.userID == userID }
            return MessageAuthorPresentation(
                id: userID,
                name: member?.displayName ?? member?.handle ?? "Grotto member",
                avatarURL: resolvedAvatarURL(member?.avatarURL)
            )
        }
        return nil
    }

    func authorPresentation(_ author: ChatAuthor) -> MessageAuthorPresentation? {
        switch author {
        case .agent(let agentID, let profile):
            let agent = agents.first { $0.id == agentID }
            return MessageAuthorPresentation(
                id: agentID,
                name: agent?.displayName ?? profile?.displayName ?? "Deleted agent",
                avatarURL: resolvedAvatarURL(agent?.avatarURL ?? profile?.avatarURL),
                presence: agent.map { presence(availability(for: $0)) }
            )
        case .human(let profile, let userID):
            let member = members?.members.first { $0.userID == userID }
            return MessageAuthorPresentation(
                id: userID,
                name: member?.displayName ?? profile?.displayName ?? "Grotto member",
                avatarURL: resolvedAvatarURL(member?.avatarURL ?? profile?.avatarURL)
            )
        case .system:
            return nil
        }
    }

    private var viewerAuthorPresentation: MessageAuthorPresentation {
        guard let directory = members,
              let viewer = directory.members.first(where: { $0.userID == directory.viewerUserID })
        else {
            return MessageAuthorPresentation(id: "viewer", name: "You", avatarURL: nil)
        }

        return MessageAuthorPresentation(
            id: viewer.userID,
            name: viewer.displayName ?? viewer.email ?? "You",
            avatarURL: resolvedAvatarURL(viewer.avatarURL)
        )
    }

    private func presence(_ availability: AgentAvailability) -> AgentPresence {
        switch availability {
        case .error: .error
        case .idle: .idle
        case .offline: .offline
        case .stopped: .stopped
        case .working: .working
        }
    }

    func resolvedAvatarURL(_ value: String?) -> URL? {
        guard let value else { return nil }
        return URL(string: value, relativeTo: GrottoRuntimeConfiguration.serverOrigin)?.absoluteURL
    }

}
