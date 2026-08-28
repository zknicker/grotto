import SwiftUI

struct ComposerAttachmentTile: View {
    let attachment: ComposerAttachment
    let onRemove: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if attachment.mediaType.hasPrefix("image/") {
                    LocalAttachmentImage(url: attachment.localURL)
                } else {
                    fileTile
                }
            }
            .frame(width: 88, height: 88)
            .background(.quaternary)
            .clipShape(.rect(cornerRadius: 14))

            // The remove control is a bubble inside the image's corner, so the tile needs no
            // compensating outer padding and sits flush with the composer's own insets.
            Button(action: onRemove) {
                GrottoIcon(.close, size: 12, weight: 2.4)
                    .foregroundStyle(.white)
                    .frame(width: 24, height: 24)
                    .background(.black.opacity(0.72), in: .circle)
            }
            .buttonStyle(.plain)
            .padding(5)
            .accessibilityLabel("Remove \(attachment.filename)")
        }
        .accessibilityElement(children: .contain)
    }

    private var fileTile: some View {
        VStack(spacing: 6) {
            GrottoIcon(attachmentIcon, size: 24, weight: 1.6)
            Text(attachment.filename)
                .font(.caption2.weight(.medium))
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 5)
        }
        .foregroundStyle(.secondary)
    }

    private var attachmentIcon: GrottoIconName {
        if attachment.mediaType == "application/pdf" { return .pdf }
        if attachment.mediaType.hasPrefix("video/") { return .video }
        if attachment.mediaType.hasPrefix("audio/") { return .voice }
        return .document
    }
}
