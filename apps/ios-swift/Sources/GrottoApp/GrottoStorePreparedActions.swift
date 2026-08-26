import Foundation
import GrottoModels
import GrottoUI

extension GrottoStore {
    var canManagePreparedActions: Bool {
        guard let role = members?.viewerRole else { return false }
        return role == .owner || role == .admin
    }

    var preparedAgentCreationConfiguration: PreparedAgentCreationConfiguration {
        let reported = (computers ?? []).compactMap { computer -> PreparedAgentComputer? in
            guard let inventory = computer.reportedInventory, !inventory.runtimes.isEmpty else {
                return nil
            }
            return PreparedAgentComputer(
                id: computer.id,
                label: computer.name ?? inventory.name ?? computer.id,
                runtimes: inventory.runtimes.map { runtime in
                    PreparedAgentRuntime(
                        id: runtime.id,
                        label: runtime.label,
                        models: runtime.models.map {
                            PreparedAgentModel(id: $0.id, label: $0.label)
                        }
                    )
                }.filter { !$0.models.isEmpty }
            )
        }.filter { !$0.runtimes.isEmpty }

        let cove = agents.first { $0.factoryKind == .cove }.map {
            PreparedAgentDefaults(
                computerID: $0.computerID,
                modelID: $0.desiredModelID,
                reasoningEffort: $0.desiredReasoningEffort ?? .medium,
                runtimeID: $0.desiredRuntimeID
            )
        }

        return PreparedAgentCreationConfiguration(
            canManage: canManagePreparedActions,
            computers: reported,
            coveDefaults: cove,
            existingHandles: agents.map(\.handle),
            onCommit: { [weak self] action, draft in
                guard let self else { throw CancellationError() }
                try await self.commitPreparedCreateAgent(action: action, draft: draft)
            }
        )
    }

    private func commitPreparedCreateAgent(
        action: PreparedCreateAgentActionPresentation,
        draft: PreparedAgentCreateDraft
    ) async throws {
        guard let serverID = activeServer?.id else {
            throw GrottoStoreError.serverUnavailable
        }
        let avatar = draft.avatar.map { payload in
            let mediaType: PreparedActionAvatarMediaType = switch payload.mediaType {
            case .jpeg: .jpeg
            case .png: .png
            }
            return AvatarBytesInput(
                bytesBase64: payload.data.base64EncodedString(),
                mediaType: mediaType
            )
        }
        let result: PreparedActionCommitResult = try await client.mutation(
            "preparedAction.commit",
            input: PreparedActionCommitInput(
                actionID: action.id,
                avatar: avatar,
                computerID: draft.computerID,
                description: draft.description,
                displayName: draft.displayName,
                handle: draft.handle,
                modelID: draft.modelID,
                reasoningEffort: draft.reasoningEffort,
                runtimeID: draft.runtimeID,
                serverID: serverID
            )
        )

        if let index = agents.firstIndex(where: { $0.id == result.agent.id }) {
            agents[index] = result.agent
        } else {
            agents.append(result.agent)
        }
        if !chats.contains(where: { $0.id == result.chat.id }) {
            chats.append(result.chat)
        }
        await loadMessages(chatID: action.chatID)
    }

    func reloadAgents(serverID: String) async throws {
        let refreshed: [AgentSummary] = try await client.query(
            "agent.list",
            input: ServerScopedInput(serverId: serverID)
        )
        agents = refreshed
        lifecycleAvailability.removeAll()
    }
}
