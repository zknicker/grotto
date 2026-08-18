import GrottoModels
import SwiftUI

/// The narrow App-layer seam for the Server task lens.
///
/// Each mutation returns a freshly loaded list so the view only renders
/// authoritative task rows. The view does not maintain a second task cache.
public struct TaskListPersistence: Sendable {
    public let viewerUserID: String?
    public let assigneeLabel: @Sendable (TaskListItem) -> String
    public let load: @Sendable () async throws -> [TaskListItem]
    public let updateStatus: @Sendable (TaskListItem, TaskStatus) async throws -> [TaskListItem]
    public let claim: @Sendable (TaskListItem) async throws -> [TaskListItem]
    public let unclaim: @Sendable (TaskListItem) async throws -> [TaskListItem]

    public init(
        viewerUserID: String?,
        assigneeLabel: @escaping @Sendable (TaskListItem) -> String = { _ in "Unassigned" },
        load: @escaping @Sendable () async throws -> [TaskListItem],
        updateStatus: @escaping @Sendable (TaskListItem, TaskStatus) async throws -> [TaskListItem],
        claim: @escaping @Sendable (TaskListItem) async throws -> [TaskListItem],
        unclaim: @escaping @Sendable (TaskListItem) async throws -> [TaskListItem]
    ) {
        self.viewerUserID = viewerUserID
        self.assigneeLabel = assigneeLabel
        self.load = load
        self.updateStatus = updateStatus
        self.claim = claim
        self.unclaim = unclaim
    }
}

extension TaskListPersistence {
    static let preview = TaskListPersistence(
        viewerUserID: "user_preview",
        assigneeLabel: { item in
            item.task.assigneeAgentID == nil && item.task.assigneeUserID == nil
                ? "Unassigned"
                : "Cove"
        },
        load: { TaskPreviewFixtures.items },
        updateStatus: { _, _ in TaskPreviewFixtures.items },
        claim: { _ in TaskPreviewFixtures.items },
        unclaim: { _ in TaskPreviewFixtures.items }
    )
}

/// Server-backed Tasks destination used from Settings → Server.
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
            ProgressView("Loading tasks…")
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
                    assigneeLabel: persistence.assigneeLabel,
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
