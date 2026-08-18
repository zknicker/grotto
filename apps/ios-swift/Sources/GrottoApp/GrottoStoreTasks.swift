import Foundation
import GrottoModels

/// Server-backed task reads and lifecycle mutations for native task lenses.
///
/// The store intentionally returns authoritative projections instead of
/// maintaining a second task cache. A parent surface can keep the returned
/// snapshot in its own view state and replace it after each mutation.
extension GrottoStore {
    func loadTasks(chatID: String? = nil) async throws -> [TaskListItem] {
        guard let serverID = activeServer?.id else {
            throw GrottoStoreError.serverUnavailable
        }
        return try await client.query(
            "task.list",
            input: TaskListInput(serverID: serverID, chatID: chatID)
        )
    }

    @discardableResult
    func updateTaskStatus(_ task: MessageTask, status: TaskStatus) async throws -> MessageTask {
        guard let serverID = activeServer?.id else {
            throw GrottoStoreError.serverUnavailable
        }
        let receipt: TaskMutationReceipt = try await client.mutation(
            "task.update",
            input: TaskUpdateInput(
                serverID: serverID,
                messageID: task.messageID,
                expectedVersion: task.version,
                patch: TaskUpdatePatch(status: status)
            )
        )
        return receipt.task
    }

    @discardableResult
    func claimTask(_ task: MessageTask) async throws -> MessageTask {
        try await mutateTask(task, procedure: "task.claim")
    }

    @discardableResult
    func unclaimTask(_ task: MessageTask) async throws -> MessageTask {
        try await mutateTask(task, procedure: "task.unclaim")
    }

    private func mutateTask(
        _ task: MessageTask,
        procedure: String
    ) async throws -> MessageTask {
        guard let serverID = activeServer?.id else {
            throw GrottoStoreError.serverUnavailable
        }
        let receipt: TaskMutationReceipt = try await client.mutation(
            procedure,
            input: TaskMutationInput(
                serverID: serverID,
                messageID: task.messageID,
                expectedVersion: task.version
            )
        )
        return receipt.task
    }
}
