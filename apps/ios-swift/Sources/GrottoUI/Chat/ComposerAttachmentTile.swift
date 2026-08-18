import SwiftUI

struct ComposerAttachmentTile: View {
    let attachment: ComposerAttachment
    let transitionNamespace: Namespace.ID?
    let isTransitionDestination: Bool
    let onRemove: () -> Void

    init(
        attachment: ComposerAttachment,
        transitionNamespace: Namespace.ID? = nil,
        isTransitionDestination: Bool = false,
        onRemove: @escaping () -> Void
    ) {
        self.attachment = attachment
        self.transitionNamespace = transitionNamespace
        self.isTransitionDestination = isTransitionDestination
        self.onRemove = onRemove
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if attachment.mediaType.hasPrefix("image/") {
                    attachmentImage
                } else {
                    fileTile
                }
            }
            .frame(width: 88, height: 88)
            .background(.quaternary)
            .clipShape(.rect(cornerRadius: 14))

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 24, height: 24)
                    .background(.black.opacity(0.72), in: .circle)
            }
            .buttonStyle(.plain)
            .offset(x: 7, y: -7)
            .accessibilityLabel("Remove \(attachment.filename)")
        }
        .padding(.top, 7)
        .padding(.trailing, 7)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var attachmentImage: some View {
        if isTransitionDestination, let transitionNamespace {
            LocalAttachmentImage(url: attachment.localURL)
                .matchedGeometryEffect(
                    id: attachment.id,
                    in: transitionNamespace,
                    properties: .frame,
                    anchor: .center,
                    isSource: false
                )
        } else {
            LocalAttachmentImage(url: attachment.localURL)
        }
    }

    private var fileTile: some View {
        VStack(spacing: 6) {
            Image(systemName: attachmentSymbol)
                .font(.title2)
            Text(attachment.filename)
                .font(.caption2.weight(.medium))
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 5)
        }
        .foregroundStyle(.secondary)
    }

    private var attachmentSymbol: String {
        if attachment.mediaType == "application/pdf" { return "doc.richtext" }
        if attachment.mediaType.hasPrefix("video/") { return "video" }
        if attachment.mediaType.hasPrefix("audio/") { return "waveform" }
        return "doc"
    }
}
