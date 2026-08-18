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
                        Text(replyLabel)
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
                        Text(compactRelativeTime(reply.createdAt))
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
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
        .padding(.top, 5)
    }

    private var replyLabel: String {
        guard let thread else { return "Reply in thread" }
        return thread.replyCount == 1 ? "1 reply" : "\(thread.replyCount) replies"
    }

    private var accessibilityLabel: String {
        if let task {
            return "Task number \(task.number), \(task.status.rawValue), \(replyLabel). Open thread"
        }
        return "Open thread, \(replyLabel)"
    }

    private func oneLine(_ value: String) -> String {
        value.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    }

    private func compactRelativeTime(_ date: Date, now: Date = .now) -> String {
        let seconds = max(0, Int(now.timeIntervalSince(date)))
        if seconds < 60 { return "now" }
        if seconds < 3_600 { return "\(seconds / 60)m" }
        if seconds < 86_400 { return "\(seconds / 3_600)h" }
        if seconds < 604_800 { return "\(seconds / 86_400)d" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }
}

private struct TaskSummary: View {
    let task: TaskPresentation

    var body: some View {
        HStack(spacing: 6) {
            Text("Task #\(task.number)")
                .font(.caption.weight(.semibold))
                .monospacedDigit()
            Circle()
                .fill(statusColor)
                .frame(width: 10, height: 10)
                .accessibilityHidden(true)

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

    private var statusColor: Color {
        switch task.status {
        case .todo, .closed: .secondary
        case .inProgress: .blue
        case .inReview: .orange
        case .done: .green
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
