import Foundation
import GrottoModels
import GrottoTransport
import GrottoUI

extension GrottoStore {
    func mentionOptions(for destination: ChatDestination) -> [MentionOptionPresentation] {
        mentionOptionsByDestinationID[destination.id] ?? []
    }

    func loadMentionOptions(for destination: ChatDestination) async {
        guard let serverID = activeServer?.id else { return }
        do {
            let response: MentionOptions
            switch destination {
            case .durableChat(let chat):
                response = try await client.query(
                    "chat.mentionOptions",
                    input: ChatMentionOptionsInput(chatID: chat.id, serverID: serverID)
                )
            case .implicitAgentDM(let agent):
                response = try await client.query(
                    "chat.mentionOptions",
                    input: AgentDMMentionOptionsInput(agentID: agent.id, serverID: serverID)
                )
            }
            mentionOptionsByDestinationID[destination.id] = response.options.compactMap {
                mentionPresentation($0)
            }
        } catch is CancellationError {
            return
        } catch {
            Self.logger.error(
                "Loading mention options failed: \(error.localizedDescription, privacy: .public)"
            )
        }
    }

    private func mentionPresentation(_ option: MentionOption) -> MentionOptionPresentation? {
        let kind: MentionPresentationKind
        let avatarURL: URL?
        switch option.kind {
        case .agent:
            kind = .agent
            let agentID = referenceID(option.id, scheme: "agent")
            avatarURL = agentID
                .flatMap { agentsByID[$0]?.avatarURL }
                .flatMap(resolvedAvatarURL)
        case .user:
            kind = .human
            avatarURL = resolvedAvatarURL(option.metadata?.userAvatarURL)
        case .skill:
            return nil
        }
        return MentionOptionPresentation(
            id: option.id,
            insertText: option.insertText,
            label: option.label,
            detail: option.description,
            kind: kind,
            avatarURL: avatarURL
        )
    }

    private func referenceID(_ target: String, scheme: String) -> String? {
        let prefix = "\(scheme)://"
        guard target.hasPrefix(prefix) else { return nil }
        return String(target.dropFirst(prefix.count)).removingPercentEncoding
    }
}
