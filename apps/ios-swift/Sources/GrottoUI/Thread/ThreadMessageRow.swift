import SwiftUI

struct ThreadMessageRow: View {
    let message: MessagePresentation
    var emphasized = false
    var onOpenAttachment: (MessageAttachmentPresentation) async throws -> URL = { attachment in
        guard let localURL = attachment.localURL else { throw CancellationError() }
        return localURL
    }
    var preview: Binding<AttachmentPreview?> = .constant(nil)
    var tiles: AttachmentImageTileRegistry?
    var canManagePreparedActions = false
    var onReviewPreparedCreateAgent: (PreparedCreateAgentActionPresentation) -> Void = { _ in }
    var onShowPreparedActionDetails: (PreparedCreateAgentActionPresentation) -> Void = { _ in }
    var onOpenAgent: (String) -> Void = { _ in }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            AvatarView(
                name: message.author.name,
                url: message.author.avatarURL,
                presence: message.author.presence,
                size: 36
            )

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 7) {
                    Text(message.author.name)
                        .font(.body.weight(.semibold))
                        .lineLimit(1)
                    Text(message.createdAt, format: .dateTime.hour().minute())
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !message.content.isEmpty {
                    RichMessageContentView(
                        segments: message.richSegments,
                        font: emphasized ? .body : .subheadline
                    )
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if !message.attachments.isEmpty {
                    MessageAttachmentGroup(
                        attachments: message.attachments,
                        isPending: message.isPending,
                        preview: preview,
                        tiles: tiles,
                        onOpen: onOpenAttachment
                    )
                }

                if let preparedAction = message.preparedAction {
                    PreparedActionCardView(
                        action: preparedAction,
                        canManage: canManagePreparedActions,
                        onReviewCreateAgent: onReviewPreparedCreateAgent,
                        onShowDetails: onShowPreparedActionDetails,
                        onOpenAgent: onOpenAgent
                    )
                    // The card's collapse and its memory of having been live
                    // are per-action state, and transcript rows are hosted in
                    // recycled cells reconfigured in place. Keying on the
                    // action retires that state with the action it belongs to,
                    // so a collapsed card cannot blank the next message's live
                    // one.
                    .id(preparedAction.id)
                    .padding(.top, message.content.isEmpty ? 0 : 6)
                }

                if message.isPending {
                    HStack(spacing: 5) {
                        ProgressView()
                            .controlSize(.mini)
                        Text("Sending")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 2)
                }
            }
        }
        .padding(emphasized ? 12 : 0)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            emphasized ? GrottoPlatformColor.inputSurface : .clear,
            in: .rect(cornerRadius: emphasized ? 16 : 0)
        )
    }
}
