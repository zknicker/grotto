import GrottoModels
import SwiftUI

struct PreparedActionCardView: View {
    let action: PreparedActionPresentation
    let canManage: Bool
    let onReviewCreateAgent: (PreparedCreateAgentActionPresentation) -> Void

    var body: some View {
        switch action {
        case let .createAgent(action):
            createAgentCard(action)
        case let .unsupported(action):
            cardShell(
                title: "Unsupported action",
                createdAt: action.createdAt,
                status: action.status
            ) {
                Text("This action is not available in this version of Grotto.")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func createAgentCard(_ action: PreparedCreateAgentActionPresentation) -> some View {
        cardShell(
            title: "Agent creation proposal",
            createdAt: action.createdAt,
            status: action.status
        ) {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    AvatarView(name: action.name, url: action.avatarURL, size: 64)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("New Agent")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)
                        Text(action.name).font(.headline)
                        if let description = action.description, !description.isEmpty {
                            Text(description).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }

                if let computerDetail = action.computerDetail {
                    detailRow("Computer", value: computerDetail)
                }
                if let draftHint = action.draftHint, !draftHint.isEmpty {
                    detailRow("Draft note", value: draftHint)
                }
                if action.status == .executed, let committer = action.executedByDisplayName {
                    Text("Committed by \(committer)")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if action.status == .pending, canManage {
                    Button("Create Agent") { onReviewCreateAgent(action) }
                        .buttonStyle(.borderedProminent)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .accessibilityIdentifier("prepared-action-create-agent")
                } else if action.status == .pending {
                    Text("Only a Server Owner or Admin can commit this Agent.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func cardShell<Content: View>(
        title: String,
        createdAt: Date,
        status: PreparedActionStatus,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.subheadline.weight(.semibold))
                    Text(createdAt, format: .dateTime.hour().minute())
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Text(status.label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(status.tint)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background(status.tint.opacity(0.12), in: .capsule)
            }
            Divider()
            content()
        }
        .padding(14)
        .background(GrottoPlatformColor.groupedSurface, in: .rect(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.secondary.opacity(0.16), lineWidth: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("prepared-action-card-\(status.rawValue)")
    }

    private func detailRow(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.subheadline)
        }
    }
}

private extension PreparedActionStatus {
    var label: String {
        switch self {
        case .pending: "Pending review"
        case .executed: "Done"
        case .superseded: "Superseded"
        }
    }

    var tint: Color {
        switch self {
        case .pending: .orange
        case .executed: .green
        case .superseded: .secondary
        }
    }
}
