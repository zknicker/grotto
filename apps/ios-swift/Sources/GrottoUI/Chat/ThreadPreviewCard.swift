import SwiftUI

struct ThreadPreviewCard: View {
    let thread: ThreadPreviewPresentation?
    let task: TaskPresentation?
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 7) {
                HStack(spacing: 7) {
                    if let task {
                        TaskSummary(task: task)
                    }

                    Spacer(minLength: 8)

                    HStack(spacing: 4) {
                        if let replyLabel {
                            Text(replyLabel)
                        }
                        if let unreadCount = thread?.unreadCount, unreadCount > 0 {
                            Text("· \(unreadCount) new")
                                .foregroundStyle(.tint)
                        }
                        Image(systemName: "chevron.right")
                            .font(.caption2.weight(.bold))
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                }

                if let reply = thread?.latestReply {
                    HStack(spacing: 7) {
                        AvatarView(
                            name: reply.author.name,
                            url: reply.author.avatarURL,
                            presence: nil,
                            size: 22
                        )
                        Text(reply.author.name)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                        Text(oneLine(reply.content))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Text(GrottoCompactRelativeTime.label(for: reply.createdAt))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(GrottoPlatformColor.inputSurface, in: .rect(cornerRadius: 12))
        }
        .buttonStyle(.pressableRow(cornerRadius: 12))
        .accessibilityLabel(accessibilityLabel)
        .padding(.top, 5)
    }

    // A task ingress with no replies yet keeps just the chevron; the row is
    // still the way in, but "0 replies" is noise next to the task summary.
    private var replyLabel: String? {
        guard let thread, thread.replyCount > 0 else {
            return task == nil ? "Reply in thread" : nil
        }
        return thread.replyCount == 1 ? "1 reply" : "\(thread.replyCount) replies"
    }

    private var accessibilityLabel: String {
        if let task {
            return "Task number \(task.number), \(task.status.rawValue), \(replyLabel ?? "no replies"). Open thread"
        }
        return "Open thread, \(replyLabel ?? "no replies")"
    }

    private func oneLine(_ value: String) -> String {
        value.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }
}

private struct TaskSummary: View {
    let task: TaskPresentation

    var body: some View {
        HStack(spacing: 6) {
            Text("Task #\(task.number)")
                .font(.caption.weight(.semibold))
                .monospacedDigit()
            TaskStatusDisc(
                status: TaskStatusShape(task.status),
                size: 13,
                surface: GrottoPlatformColor.inputSurface
            )

            if let assignee = task.assignee {
                AvatarView(
                    name: assignee.name,
                    url: assignee.avatarURL,
                    presence: nil,
                    size: 16
                )
                Text(assignee.name)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
    }
}

#Preview {
    ThreadPreviewCard(
        thread: ChatFixtures.messages[1].thread!,
        task: nil,
        onOpen: {}
    )
    .padding(60)
}
