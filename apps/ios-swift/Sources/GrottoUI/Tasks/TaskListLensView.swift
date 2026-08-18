import GrottoModels
import SwiftUI

/// A native, grouped Tasks lens over the canonical `task.list` projection.
///
/// The list is deliberately display-first: opening a row delegates to the
/// existing Thread route, while lifecycle controls call explicit callbacks so
/// the App layer can perform Server mutations and replace the row with the
/// returned authoritative version.
public struct TaskListLensView: View {
    private let items: [TaskListItem]
    private let viewerUserID: String?
    private let chatLabel: (TaskListItem) -> String
    private let assigneeLabel: (TaskListItem) -> String
    private let mutatingIDs: Set<String>
    private let actionsDisabled: Bool
    private let onOpenTask: (TaskListItem) -> Void
    private let onUpdateStatus: (TaskListItem, TaskStatus) -> Void
    private let onClaim: (TaskListItem) -> Void
    private let onUnclaim: (TaskListItem) -> Void

    public init(
        items: [TaskListItem],
        viewerUserID: String? = nil,
        chatLabel: ((TaskListItem) -> String)? = nil,
        assigneeLabel: ((TaskListItem) -> String)? = nil,
        mutatingIDs: Set<String> = [],
        actionsDisabled: Bool = false,
        onOpenTask: @escaping (TaskListItem) -> Void,
        onUpdateStatus: @escaping (TaskListItem, TaskStatus) -> Void = { _, _ in },
        onClaim: @escaping (TaskListItem) -> Void = { _ in },
        onUnclaim: @escaping (TaskListItem) -> Void = { _ in }
    ) {
        self.items = items
        self.viewerUserID = viewerUserID
        self.chatLabel = chatLabel ?? defaultTaskChatLabel
        self.assigneeLabel = assigneeLabel ?? defaultTaskAssigneeLabel
        self.mutatingIDs = mutatingIDs
        self.actionsDisabled = actionsDisabled
        self.onOpenTask = onOpenTask
        self.onUpdateStatus = onUpdateStatus
        self.onClaim = onClaim
        self.onUnclaim = onUnclaim
    }

    public var body: some View {
        Group {
            if items.isEmpty {
                ContentUnavailableView(
                    "No tasks",
                    systemImage: "checklist",
                    description: Text("Tasks created from Grotto messages will appear here.")
                )
            } else {
                List {
                    ForEach(TaskStatus.ordered, id: \.self) { status in
                        let groupedItems = items.filter { $0.task.status == status }
                        if !groupedItems.isEmpty {
                            Section {
                                ForEach(groupedItems) { item in
                                    TaskListRow(
                                        item: item,
                                        viewerUserID: viewerUserID,
                                        chatLabel: chatLabel(item),
                                        assigneeLabel: assigneeLabel(item),
                                        isMutating: mutatingIDs.contains(item.id),
                                        actionsDisabled: actionsDisabled,
                                        onOpen: { onOpenTask(item) },
                                        onUpdateStatus: { onUpdateStatus(item, $0) },
                                        onClaim: { onClaim(item) },
                                        onUnclaim: { onUnclaim(item) }
                                    )
                                }
                            } header: {
                                TaskSectionHeader(status: status, count: groupedItems.count)
                            }
                        }
                    }
                }
#if os(iOS)
                .listStyle(.insetGrouped)
#else
                .listStyle(.inset)
#endif
                .scrollContentBackground(.hidden)
            }
        }
        .background(GrottoPlatformColor.groupedBackground)
        .navigationTitle("Tasks")
        .grottoInlineNavigationTitle()
    }

}

private func defaultTaskChatLabel(_ item: TaskListItem) -> String {
    switch item.chatKind {
    case .channel:
        "#\(item.chatName ?? "channel")"
    case .dm:
        "Direct message"
    }
}

private func defaultTaskAssigneeLabel(_ item: TaskListItem) -> String {
    if let agentID = item.task.assigneeAgentID {
        return "Agent \(String(agentID.suffix(6)))"
    }
    if let userID = item.task.assigneeUserID {
        return "Member \(String(userID.suffix(6)))"
    }
    return "Unassigned"
}

private struct TaskSectionHeader: View {
    let status: TaskStatus
    let count: Int

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(status.color)
                .frame(width: 9, height: 9)
            Text(status.displayName)
            Text("\(count)")
                .foregroundStyle(.secondary)
                .monospacedDigit()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(status.displayName), \(count) tasks")
    }
}

private struct TaskListRow: View {
    let item: TaskListItem
    let viewerUserID: String?
    let chatLabel: String
    let assigneeLabel: String
    let isMutating: Bool
    let actionsDisabled: Bool
    let onOpen: () -> Void
    let onUpdateStatus: (TaskStatus) -> Void
    let onClaim: () -> Void
    let onUnclaim: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 7) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("#\(item.task.number)")
                            .font(.caption.monospacedDigit())
                            .foregroundStyle(.secondary)
                        Text(item.message.content)
                            .font(.body.weight(.medium))
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                            .lineLimit(2)
                    }

                    HStack(spacing: 8) {
                        Label(chatLabel, systemImage: item.chatKind == .channel ? "number" : "bubble.left")
                        Label(assigneeLabel, systemImage: "person")
                        Label(threadLabel, systemImage: "bubble.left.and.bubble.right")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                    HStack(spacing: 8) {
                        Label(item.task.priority.displayName, systemImage: priorityIcon)
                            .foregroundStyle(item.task.priority.color)
                        Text(item.task.updatedAt, style: .relative)
                            .foregroundStyle(.tertiary)
                    }
                    .font(.caption2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isMutating {
                ProgressView()
                    .controlSize(.small)
                    .frame(width: 32, height: 32)
                    .accessibilityElement()
                    .accessibilityLabel("Updating task")
            } else {
                Menu {
                    Section("Status") {
                        ForEach(TaskStatus.ordered, id: \.self) { status in
                            Button { onUpdateStatus(status) } label: {
                                if status == item.task.status {
                                    Label(status.displayName, systemImage: "checkmark")
                                } else {
                                    Text(status.displayName)
                                }
                            }
                        }
                    }

                    if canClaim {
                        Divider()
                        Button(action: onClaim) {
                            Label("Claim", systemImage: "hand.raised")
                        }
                    } else if canUnclaim {
                        Divider()
                        Button(action: onUnclaim) {
                            Label("Unclaim", systemImage: "hand.raised.slash")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .menuOrder(.fixed)
                .disabled(actionsDisabled)
                .accessibilityLabel("Task actions")
            }
        }
        .padding(.vertical, 6)
    }

    private var threadLabel: String {
        let count = item.threadSummary.replyCount
        return count == 1 ? "1 reply" : "\(count) replies"
    }

    private var canClaim: Bool {
        guard item.task.status != .done,
              item.task.assigneeAgentID == nil,
              let viewerUserID
        else { return false }
        return item.task.assigneeUserID == nil
            || (item.task.assigneeUserID == viewerUserID && item.task.claimedAt == nil)
    }

    private var canUnclaim: Bool {
        guard item.task.status != .done,
              let viewerUserID,
              item.task.assigneeAgentID == nil,
              item.task.assigneeUserID == viewerUserID
        else { return false }
        return item.task.claimedAt != nil
    }
}

private extension TaskStatus {
    var color: Color {
        switch self {
        case .todo: .orange
        case .inProgress: .blue
        case .inReview: .purple
        case .done: .green
        case .closed: .secondary
        }
    }
}

private extension TaskPriority {
    var color: Color {
        switch self {
        case .none: .secondary
        case .urgent: .red
        case .high: .orange
        case .medium: .yellow
        case .low: .blue
        }
    }

    var icon: String {
        switch self {
        case .none: "minus"
        case .urgent: "exclamationmark.2"
        case .high: "chevron.up.2"
        case .medium: "chevron.up"
        case .low: "chevron.down"
        }
    }
}

private extension TaskListRow {
    var priorityIcon: String { item.task.priority.icon }
}

#Preview("Tasks") {
    NavigationStack {
        TaskListLensView(
            items: TaskPreviewFixtures.items,
            viewerUserID: "user_preview",
            onOpenTask: { _ in }
        )
    }
}
