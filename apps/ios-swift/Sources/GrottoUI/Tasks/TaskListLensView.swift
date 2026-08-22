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
    private let assignee: (TaskListItem) -> MessageAuthorPresentation?
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
        assignee: ((TaskListItem) -> MessageAuthorPresentation?)? = nil,
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
        self.assignee = assignee ?? { _ in nil }
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
                    ForEach(Array(statusGroups.enumerated()), id: \.element.status) { index, group in
                        Section {
                            ForEach(group.items) { item in
                                TaskListRow(
                                    item: item,
                                    viewerUserID: viewerUserID,
                                    chatLabel: chatLabel(item),
                                    assignee: assignee(item),
                                    isMutating: mutatingIDs.contains(item.id),
                                    actionsDisabled: actionsDisabled,
                                    onOpen: { onOpenTask(item) },
                                    onUpdateStatus: { onUpdateStatus(item, $0) },
                                    onClaim: { onClaim(item) },
                                    onUnclaim: { onUnclaim(item) }
                                )
                                .listRowInsets(
                                    EdgeInsets(
                                        top: 12,
                                        leading: TaskListMetrics.horizontalInset,
                                        bottom: 12,
                                        trailing: TaskListMetrics.horizontalInset
                                    )
                                )
                                .listRowBackground(GrottoPlatformColor.background)
                                // Linear mobile rules the section boundary, not
                                // the gaps between rows inside a group.
                                .listRowSeparator(.hidden)
                            }
                        } header: {
                            TaskSectionHeader(
                                status: group.status,
                                count: group.items.count,
                                showsBoundaryRule: index > 0
                            )
                            // The header owns its own padding so its boundary
                            // rule can bleed the full width of the screen.
                            .listRowInsets(EdgeInsets())
                        }
                    }
                }
                .listStyle(.plain)
                .grottoCompactListSections()
                .scrollContentBackground(.hidden)
            }
        }
        // The hosting destination owns the navigation title.
        .background(GrottoPlatformColor.background)
    }

    /// The non-empty status groups in canonical order.
    ///
    /// Materializing them lets the first section skip the boundary rule that
    /// every later header carries.
    private var statusGroups: [(status: TaskStatus, items: [TaskListItem])] {
        TaskStatus.ordered.compactMap { status in
            let groupedItems = items.filter { $0.task.status == status }
            return groupedItems.isEmpty ? nil : (status: status, items: groupedItems)
        }
    }
}

/// Shared list geometry so rows and headers keep one left margin.
private enum TaskListMetrics {
    static let horizontalInset: CGFloat = 20
    static let trailingSlotSize: CGFloat = 28
}

private func defaultTaskChatLabel(_ item: TaskListItem) -> String {
    switch item.chatKind {
    case .channel:
        "#\(item.chatName ?? "channel")"
    case .dm:
        "DM"
    }
}

/// The one place a task's assignee becomes words.
///
/// The resolved presentation is authoritative, so the row label, the avatar,
/// and the Thread task drawer always agree. The id-suffix forms only cover an
/// actor the App layer could not find in its directories.
enum TaskAssigneeLabel {
    static func text(for item: TaskListItem, assignee: MessageAuthorPresentation?) -> String {
        if let assignee {
            return assignee.name
        }
        if let agentID = item.task.assigneeAgentID {
            return "Agent \(String(agentID.suffix(6)))"
        }
        if let userID = item.task.assigneeUserID {
            return "Member \(String(userID.suffix(6)))"
        }
        return "Unassigned"
    }
}

private struct TaskSectionHeader: View {
    let status: TaskStatus
    let count: Int
    let showsBoundaryRule: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if showsBoundaryRule {
                // Edge to edge: the row owns zero insets, so this rule spans
                // the screen instead of starting under the title.
                Divider()
                    .padding(.bottom, 14)
            }

            // Linear mobile keeps the group header to plain muted text; the
            // status disc earns its color in the rows, not twice on a screen.
            HStack(spacing: 7) {
                Text(status.displayName)
                    .font(.subheadline.weight(.semibold))
                Text("\(count)")
                    .font(.subheadline)
                    .monospacedDigit()
            }
            .foregroundStyle(.secondary)
            .padding(.horizontal, TaskListMetrics.horizontalInset)
            .padding(.bottom, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .textCase(nil)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(status.displayName), \(count) tasks")
    }
}

private struct TaskListRow: View {
    let item: TaskListItem
    let viewerUserID: String?
    let chatLabel: String
    let assignee: MessageAuthorPresentation?
    let isMutating: Bool
    let actionsDisabled: Bool
    let onOpen: () -> Void
    let onUpdateStatus: (TaskStatus) -> Void
    let onClaim: () -> Void
    let onUnclaim: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 9) {
                TaskPriorityIcon(priority: item.task.priority)

                // No issue id on the row: Linear mobile leads with the two
                // glyphs and the title. The number stays in the a11y label.
                TaskStatusDisc(status: TaskStatusShape(item.task.status))

                Text(title)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.trailing, 4)

                trailingSlot
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(.isButton)
        .contextMenu { actionMenu }
        .swipeActions(edge: .trailing, allowsFullSwipe: false) { swipeActions }
    }

    // The row is one line, so a wrapped anchor collapses to a single line.
    private var title: String {
        item.message.content.split(whereSeparator: { $0.isNewline }).joined(separator: " ")
    }

    @ViewBuilder
    private var trailingSlot: some View {
        if isMutating {
            ProgressView()
                .controlSize(.small)
                .frame(
                    width: TaskListMetrics.trailingSlotSize,
                    height: TaskListMetrics.trailingSlotSize
                )
        } else if isAssigned {
            // AvatarView already falls back to initials when the actor has no
            // uploaded image, so the row never needs a second placeholder.
            AvatarView(
                name: assigneeLabel,
                url: assignee?.avatarURL,
                size: TaskListMetrics.trailingSlotSize
            )
        } else {
            // Keeps the trailing column aligned without claiming an actor.
            Circle()
                .strokeBorder(
                    Color.secondary.opacity(0.35),
                    style: StrokeStyle(lineWidth: 1, dash: [2.5, 2.5])
                )
                .frame(
                    width: TaskListMetrics.trailingSlotSize,
                    height: TaskListMetrics.trailingSlotSize
                )
        }
    }

    @ViewBuilder
    private var actionMenu: some View {
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
            Button(action: onClaim) {
                Label("Claim", systemImage: "hand.raised")
            }
        } else if canUnclaim {
            Button(action: onUnclaim) {
                Label("Unclaim", systemImage: "hand.raised.slash")
            }
        }
    }

    @ViewBuilder
    private var swipeActions: some View {
        if !actionsDisabled, !isMutating {
            if canClaim {
                Button(action: onClaim) {
                    Label("Claim", systemImage: "hand.raised")
                }
                .tint(.blue)
            } else if canUnclaim {
                Button(action: onUnclaim) {
                    Label("Unclaim", systemImage: "hand.raised.slash")
                }
                .tint(.orange)
            }
        }
    }

    private var assigneeLabel: String {
        TaskAssigneeLabel.text(for: item, assignee: assignee)
    }

    private var isAssigned: Bool {
        item.task.assigneeAgentID != nil || item.task.assigneeUserID != nil
    }

    // The row sheds metadata visually, so the a11y label still carries it.
    private var accessibilityLabel: String {
        var parts = [
            "Task #\(item.task.number)",
            title,
            item.task.status.displayName,
        ]
        if item.task.priority != .none {
            parts.append("\(item.task.priority.displayName) priority")
        }
        parts.append(assigneeLabel)
        parts.append(chatLabel)
        if isMutating {
            parts.append("Updating")
        }
        return parts.joined(separator: ", ")
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

#Preview("Tasks") {
    NavigationStack {
        TaskListLensView(
            items: TaskPreviewFixtures.items,
            viewerUserID: "user_preview",
            onOpenTask: { _ in }
        )
    }
}
