import SwiftUI

struct ThreadMessageRow: View {
    let message: MessagePresentation
    var emphasized = false
    var onOpenAttachment: (MessageAttachmentPresentation) async throws -> URL = { attachment in
        guard let localURL = attachment.localURL else { throw CancellationError() }
        return localURL
    }

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

                let content = message.content.trimmingCharacters(in: .whitespacesAndNewlines)
                if !content.isEmpty {
                    Text(content)
                        .font(emphasized ? .body : .subheadline)
                        .foregroundStyle(.primary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if !message.attachments.isEmpty {
                    MessageAttachmentGroup(
                        attachments: message.attachments,
                        isPending: message.isPending,
                        onOpen: onOpenAttachment
                    )
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
