import Foundation
import HausModels
import HausUI
import OSLog

extension HausStore {
    func cancelCloudAgent(workID: String) async throws {
        guard let serverID = activeServer?.id else { throw HausStoreError.serverUnavailable }
        let _: CloudAgentCancelReceipt = try await client.mutation(
            "cloudAgentWork.cancel", input: CloudAgentCancelInput(serverId: serverID, workId: workID)
        )
    }

    func cloudAgentPresentation(_ body: ChatMessageBody?) -> CloudAgentPresentation? {
        guard case .cloudAgentWork(let work) = body else { return nil }
        return CloudAgentPresentation(
            work: work,
            delegatedBy: actorPresentation(agentID: work.agentId, userID: nil)?.name ?? "Deleted agent"
        )
    }

    func loadCloudAgentWork(serverID: String, chatID: String) async {
        do {
            let rows: [ThreadCloudAgentWork] = try await client.query(
                "cloudAgentWork.listForChat",
                input: CloudAgentChatInput(serverId: serverID, chatId: chatID)
            )
            guard activeServer?.id == serverID else { return }
            if cloudAgentWorkByChatID[chatID] != rows { cloudAgentWorkByChatID[chatID] = rows }
        } catch {
            Self.logger.error("Loading cloud agents failed: \(error.localizedDescription, privacy: .public)")
            sendError = "Cloud agent status could not refresh. Check your connection and try again."
        }
    }

    func cloudAgentPresentations(_ rows: [ThreadCloudAgentWork]) -> [CloudAgentPresentation] {
        rows.map { row in
            CloudAgentPresentation(work: row.work, delegatedBy:
                actorPresentation(agentID: row.work.agentId, userID: nil)?.name ?? "Deleted agent")
        }
    }

    var cloudAgentSettings: CloudAgentSettingsActions {
        CloudAgentSettingsActions { [weak self] computerID, operation in
            guard let self, let serverID = await self.activeServer?.id else { throw CancellationError() }
            let input = CloudAgentProviderInput(serverId: serverID, computerId: computerID)
            if operation == .get {
                return try await self.client.query("cloudAgentProvider.get", input: input)
            }
            let result: CloudAgentCapability = try await self.client.mutation(
                "cloudAgentProvider.\(operation.rawValue)", input: input, timeout: 360
            )
            await self.loadComputers(serverID: serverID)
            return result
        }
    }
}

private struct CloudAgentChatInput: Encodable {
    let serverId: String
    let chatId: String
}

private struct CloudAgentCancelInput: Encodable {
    let serverId: String
    let workId: String
}

private struct CloudAgentCancelReceipt: Decodable {
    let cancelRequested: Bool
}

private struct CloudAgentProviderInput: Encodable {
    let serverId: String
    let computerId: String
    let provider = "cursor"
}
