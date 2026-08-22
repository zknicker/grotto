import GrottoModels
import SwiftUI

/// The narrow App-layer seam for the Server task lens.
///
/// Each mutation returns a freshly loaded list so the view only renders
/// authoritative task rows. The view does not maintain a second task cache.
public struct TaskListPersistence: Sendable {
    public let viewerUserID: String?
    /// The task's assignee as the App layer resolved it, or `nil` when the
    /// actor is unassigned or missing from the agent and member directories.
    /// Rows derive both the avatar and the assignee label from this, so there
    /// is no second name to disagree with the Thread task drawer.
    public let assignee: @Sendable (TaskListItem) -> MessageAuthorPresentation?
    public let load: @Sendable () async throws -> [TaskListItem]
    public let updateStatus: @Sendable (TaskListItem, TaskStatus) async throws -> [TaskListItem]
    public let claim: @Sendable (TaskListItem) async throws -> [TaskListItem]
    public let unclaim: @Sendable (TaskListItem) async throws -> [TaskListItem]

    public init(
        viewerUserID: String?,
        assignee: @escaping @Sendable (TaskListItem) -> MessageAuthorPresentation? = { _ in nil },
        load: @escaping @Sendable () async throws -> [TaskListItem],
        updateStatus: @escaping @Sendable (TaskListItem, TaskStatus) async throws -> [TaskListItem],
        claim: @escaping @Sendable (TaskListItem) async throws -> [TaskListItem],
        unclaim: @escaping @Sendable (TaskListItem) async throws -> [TaskListItem]
    ) {
        self.viewerUserID = viewerUserID
        self.assignee = assignee
        self.load = load
        self.updateStatus = updateStatus
        self.claim = claim
        self.unclaim = unclaim
    }
}

extension TaskListPersistence {
    static let preview = TaskListPersistence(
        viewerUserID: "user_preview",
        assignee: { item in
            if let agentID = item.task.assigneeAgentID {
                return MessageAuthorPresentation(id: agentID, name: "Cove", avatarURL: nil)
            }
            if let userID = item.task.assigneeUserID {
                return MessageAuthorPresentation(id: userID, name: "Ada Lovelace", avatarURL: nil)
            }
            return nil
        },
        load: { TaskPreviewFixtures.items },
        updateStatus: { _, _ in TaskPreviewFixtures.items },
        claim: { _ in TaskPreviewFixtures.items },
        unclaim: { _ in TaskPreviewFixtures.items }
    )
}

/// Server-backed Tasks destination pushed on the root stack from the sidebar.
///
/// Loading, refresh, and mutation errors stay local to this destination while
/// the App layer owns authorization, tRPC, and cache invalidation. Opening a
/// row delegates to the existing canonical Thread route.
public struct TaskListDestinationView: View {
    private let persistence: TaskListPersistence
    private let onOpenTask: (TaskListItem) -> Void

    @State private var state: LoadState = .loading
    @State private var errorMessage: String?
    @State private var mutatingIDs: Set<String> = []
    @State private var reloadToken = 0
    @State private var mutationSuccessFeedback = 0

    public init(
        persistence: TaskListPersistence,
        onOpenTask: @escaping (TaskListItem) -> Void
    ) {
        self.persistence = persistence
        self.onOpenTask = onOpenTask
    }

    public var body: some View {
        content
            .navigationTitle("Tasks")
            .grottoInlineNavigationTitle()
            .task(id: reloadToken) {
                await loadTasks()
            }
            .refreshable {
                await loadTasks()
            }
            .sensoryFeedback(.success, trigger: mutationSuccessFeedback)
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case let .loaded(items):
            VStack(spacing: 0) {
                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                }

                TaskListLensView(
                    items: items,
                    viewerUserID: persistence.viewerUserID,
                    assignee: persistence.assignee,
                    mutatingIDs: mutatingIDs,
                    actionsDisabled: !mutatingIDs.isEmpty,
                    onOpenTask: onOpenTask,
                    onUpdateStatus: { item, status in
                        Task { await mutate(item) { try await persistence.updateStatus(item, status) } }
                    },
                    onClaim: { item in
                        Task { await mutate(item) { try await persistence.claim(item) } }
                    },
                    onUnclaim: { item in
                        Task { await mutate(item) { try await persistence.unclaim(item) } }
                    }
                )
            }
        case let .failed(message):
            ContentUnavailableView {
                Label("Tasks unavailable", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") {
                    reloadToken += 1
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private func loadTasks() async {
        state = .loading
        errorMessage = nil
        do {
            let items = try await persistence.load()
            guard !Task.isCancelled else { return }
            state = .loaded(items)
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            state = .failed(error.localizedDescription)
        }
    }

    private func mutate(
        _ item: TaskListItem,
        operation: @escaping @Sendable () async throws -> [TaskListItem]
    ) async {
        guard mutatingIDs.isEmpty else { return }
        mutatingIDs.insert(item.id)
        defer { mutatingIDs.remove(item.id) }

        do {
            let items = try await operation()
            guard !Task.isCancelled else { return }
            state = .loaded(items)
            errorMessage = nil
            mutationSuccessFeedback += 1
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            errorMessage = error.localizedDescription
        }
    }

    private enum LoadState {
        case loading
        case loaded([TaskListItem])
        case failed(String)
    }
}

#Preview("Tasks destination") {
    NavigationStack {
        TaskListDestinationView(
            persistence: .preview,
            onOpenTask: { _ in }
        )
    }
}
