import GrottoModels
import GrottoUI

extension GrottoStore {
    var chatDestinations: [ChatDestination] {
        let durable = chats.compactMap(durableChatDestination)
        let listedChatIDs = Set(chats.map(\.id))
        let receiptBacked: [ChatDestination] = receiptBackedAgentDMsByChatID.compactMap { chatID, agentID in
            guard !listedChatIDs.contains(chatID),
                  let agent = agents.first(where: { $0.id == agentID }) else { return nil }
            return ChatDestination.durableChat(ChatPresentation(
                id: chatID,
                title: agent.displayName,
                kind: .agentDirectMessage(agentPresentation(agent))
            ))
        }
        let materializedAgentIDs = Set(
            chats.compactMap(\.peerAgentID) + receiptBackedAgentDMsByChatID.values
        )
        let implicit = agents
            .filter { !materializedAgentIDs.contains($0.id) }
            .map { ChatDestination.implicitAgentDM(agentPresentation($0)) }
        return durable + receiptBacked + implicit
    }

    private func durableChatDestination(_ chat: ChatSummary) -> ChatDestination? {
        switch chat.kind {
        case .channel:
            return .durableChat(ChatPresentation(
                id: chat.id,
                title: chat.name ?? (chat.isAll ? "all" : "Channel"),
                kind: .channel,
                unreadCount: chat.unreadCount,
                appearance: ChannelAppearance(icon: chat.icon, color: chat.color)
            ))
        case .dm:
            if let agentID = chat.peerAgentID {
                let agent = agents.first { $0.id == agentID }
                let name = agent?.displayName ?? chat.peerAgentDisplayName ?? "Former Agent"
                let presentation = agent.map(agentPresentation)
                    ?? AgentPresentation(id: agentID, name: name, avatarURL: nil, presence: .offline)
                return .durableChat(ChatPresentation(
                    id: chat.id,
                    title: name,
                    kind: .agentDirectMessage(presentation),
                    unreadCount: chat.unreadCount
                ))
            }
            if let userID = chat.peerUserID {
                let member = members?.members.first { $0.userID == userID }
                let name = member?.displayName ?? member?.handle ?? member?.email ?? "Former member"
                return .durableChat(ChatPresentation(
                    id: chat.id,
                    title: name,
                    kind: .humanDirectMessage(HumanPresentation(
                        id: userID,
                        name: name,
                        handle: member?.handle,
                        avatarURL: resolvedAvatarURL(member?.avatarURL)
                    )),
                    unreadCount: chat.unreadCount
                ))
            }
            return nil
        }
    }

    private func agentPresentation(_ agent: AgentSummary) -> AgentPresentation {
        AgentPresentation(
            id: agent.id,
            name: agent.displayName,
            avatarURL: resolvedAvatarURL(agent.avatarURL),
            presence: presence(availability(for: agent))
        )
    }
}
