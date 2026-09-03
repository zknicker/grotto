import SwiftUI

struct ThreadPreviewCard: View {
    let thread: ThreadPreviewPresentation?
    let task: TaskPresentation?
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 7) {
                header

                if let replies = thread?.recentReplies, !replies.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(replies) { reply in
                            ThreadPreviewReplyRow(reply: reply)
                        }
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
        // A card attached under a message body takes the same step the
        // prepared-action card takes. The message's own attachments sit closer,
        // at 3pt, because they are the message rather than about it.
        .padding(.top, 6)
    }

    /// A task leads with its own summary and sends the count to the trailing
    /// edge; a plain Thread has nothing to lead with, so the count itself is
    /// the header and only the chevron stays pinned trailing.
    private var header: some View {
        HStack(spacing: 4) {
            if let task {
                TaskSummary(task: task)
                Spacer(minLength: 8)
            }

            HStack(spacing: 4) {
                if let replyLabel {
                    Text(replyLabel)
                }
                if let unreadCount = thread?.unreadCount, unreadCount > 0 {
                    Text("· \(unreadCount) new")
                        .foregroundStyle(.tint)
                }
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .lineLimit(1)

            if task == nil {
                Spacer(minLength: 8)
            }

            Image(systemName: "chevron.right")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
        }
    }

    private var replyLabel: String? {
        ThreadPreviewProjection.replyLabel(
            replyCount: thread?.replyCount ?? 0,
            hasTask: task != nil
        )
    }

    private var accessibilityLabel: String {
        if let task {
            return "Task number \(task.number), \(task.status.rawValue), \(replyLabel ?? "no replies"). Open thread"
        }
        return "Open thread, \(replyLabel ?? "no replies")"
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

private struct ThreadPreviewReplyRow: View {
    let reply: ThreadReplyPresentation

    var body: some View {
        HStack(spacing: 7) {
            AvatarView(
                name: reply.author.name,
                url: reply.author.avatarURL,
                presence: nil,
                size: 18
            )
            Text(reply.author.name)
                .font(.caption.weight(.semibold))
                .lineLimit(1)
            Text(RichMessageParser.oneLinePreview(reply.content))
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

#Preview {
    VStack(alignment: .leading, spacing: 24) {
        ThreadPreviewCard(
            thread: ChatFixtures.messages[1].thread!,
            task: nil,
            onOpen: {}
        )
        ThreadPreviewCard(
            thread: ChatFixtures.messages[2].thread!,
            task: ChatFixtures.messages[2].task,
            onOpen: {}
        )
    }
    .padding(40)
}
