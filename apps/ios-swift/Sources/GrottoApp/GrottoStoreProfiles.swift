import Foundation
import GrottoModels
import GrottoTransport
import GrottoUI

extension GrottoStore {
    func saveHumanProfile(
        userID: String,
        displayName: String,
        description: String
    ) async throws -> SettingsPerson {
        guard let serverID = activeServer?.id,
              let directory = members,
              directory.viewerUserID == userID else {
            throw GrottoStoreError.profileUnavailable
        }
        let _: TRPCNoContent = try await client.mutation(
            "member.updateProfile",
            input: UpdateHumanProfileInput(
                description: description.nilIfBlank,
                displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            )
        )
        let refreshed: MemberList = try await client.query(
            "member.list",
            input: ServerScopedInput(serverId: serverID)
        )
        members = refreshed
        guard let viewer = settingsData?.viewer else {
            throw GrottoStoreError.profileUnavailable
        }
        return viewer
    }

    func saveAgentProfile(
        agentID: String,
        displayName: String,
        description: String
    ) async throws -> SettingsAgent {
        guard let serverID = activeServer?.id else {
            throw GrottoStoreError.profileUnavailable
        }
        let updated: AgentSummary = try await client.mutation(
            "agent.updateProfile",
            input: UpdateAgentProfileInput(
                agentID: agentID,
                description: description.nilIfBlank,
                displayName: displayName.trimmingCharacters(in: .whitespacesAndNewlines),
                serverID: serverID
            )
        )
        agents = agents.map { $0.id == updated.id ? updated : $0 }
        guard let agent = settingsData?.agents.first(where: { $0.id == agentID }) else {
            throw GrottoStoreError.profileUnavailable
        }
        return agent
    }

    func saveHumanAvatar(
        userID: String,
        payload: AvatarImagePayload
    ) async throws -> SettingsPerson {
        guard let serverID = activeServer?.id,
              let directory = members,
              directory.viewerUserID == userID else {
            throw GrottoStoreError.profileUnavailable
        }
        let _: Avatar = try await client.mutation(
            "avatar.set",
            input: SetAvatarInput(
                bytesBase64: payload.data.base64EncodedString(),
                mediaType: transportMediaType(for: payload.mediaType),
                serverID: serverID,
                target: .user
            )
        )
        let refreshed: MemberList = try await client.query(
            "member.list",
            input: ServerScopedInput(serverId: serverID)
        )
        members = refreshed
        guard let viewer = settingsData?.viewer else {
            throw GrottoStoreError.profileUnavailable
        }
        return viewer
    }

    func saveAgentAvatar(
        agentID: String,
        payload: AvatarImagePayload
    ) async throws -> SettingsAgent {
        guard let serverID = activeServer?.id,
              agents.contains(where: { $0.id == agentID }) else {
            throw GrottoStoreError.profileUnavailable
        }
        let _: Avatar = try await client.mutation(
            "avatar.set",
            input: SetAvatarInput(
                bytesBase64: payload.data.base64EncodedString(),
                mediaType: transportMediaType(for: payload.mediaType),
                serverID: serverID,
                target: .agent(agentID: agentID)
            )
        )
        let refreshed: [AgentSummary] = try await client.query(
            "agent.list",
            input: ServerScopedInput(serverId: serverID)
        )
        agents = refreshed
        guard let agent = settingsData?.agents.first(where: { $0.id == agentID }) else {
            throw GrottoStoreError.profileUnavailable
        }
        return agent
    }

    func generateAgentAvatar(agentID: String, concept: String) async throws -> AvatarImagePayload {
        guard let serverID = activeServer?.id,
              agents.contains(where: { $0.id == agentID }) else {
            throw GrottoStoreError.profileUnavailable
        }
        let response: GenerateAgentAvatarResponse = try await client.mutation(
            "avatar.generate",
            input: GenerateAgentAvatarInput(
                agentID: agentID,
                concept: concept,
                serverID: serverID
            )
        )
        let avatar = response.avatar
        guard avatar.width == AvatarImageConstraints.pixelSize,
              avatar.height == AvatarImageConstraints.pixelSize,
              avatar.mediaType == .png,
              let data = Data(base64Encoded: avatar.bytesBase64),
              !data.isEmpty,
              data.count == avatar.byteSize,
              AvatarImageConstraints.fits(byteCount: data.count) else {
            throw GrottoStoreError.invalidGeneratedAvatar
        }
        return AvatarImagePayload(
            data: data,
            mediaType: .png
        )
    }

    private func transportMediaType(for mediaType: AvatarImageMediaType) -> AvatarMediaType {
        switch mediaType {
        case .jpeg:
            .jpeg
        case .png:
            .png
        }
    }

}
