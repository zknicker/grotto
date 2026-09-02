#if os(iOS)
import SwiftUI

/// One image in the viewer, full-bleed on its own ground and zoomable.
///
/// The page paints the tile's bitmap — already decoded, already in memory,
/// already on screen behind the transition — on its first frame, then replaces
/// it with a full-resolution decode of the same bytes. The two are the same
/// picture at different sharpness, so the replacement is a straight swap rather
/// than a crossfade: dissolving one over the other would double-composite every
/// partly transparent pixel and make the artwork visibly denser through the
/// blend, which is the one thing a transparency grid exists to show honestly.
/// It is also a swap inside a live scroll view, so it keeps whatever zoom and
/// position the reader had reached.
struct AttachmentImageViewerPage: View {
    let attachment: MessageAttachmentPresentation
    let session: AttachmentImageViewerSession

    @State private var loaded: LoadedFullImage?

    var body: some View {
        let full = loaded?.image(for: attachment.id) ?? session.fullImage(for: attachment)
        let thumbnail = session.thumbnail(for: attachment)
        let bitmap = full?.bitmap ?? thumbnail?.bitmap
        ZStack {
            backdrop(full?.backdrop ?? thumbnail?.backdrop ?? .opaque)
            if let bitmap {
                AttachmentImageZoomView(bitmap: bitmap) { zoomed in
                    session.setZoomed(zoomed, for: attachment.id)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // The paged container still lays its pages out inside the safe area,
        // so the ground has to claim the status-bar strip itself or the card
        // opens with a black band across its top.
        .ignoresSafeArea()
        .accessibilityLabel(attachment.filename)
        .task(id: attachment.id) {
            guard full == nil else { return }
            let resolved = await session.load(attachment)
            guard !Task.isCancelled, let resolved else { return }
            loaded = LoadedFullImage(attachmentID: attachment.id, image: resolved)
        }
        .onDisappear {
            // A page torn down mid-zoom must not leave the transition's
            // dismissal switched off for the pages that outlive it.
            session.setZoomed(false, for: attachment.id)
        }
    }

    @ViewBuilder
    private func backdrop(_ backdrop: AttachmentImageBackdrop) -> some View {
        switch backdrop {
        case .opaque:
            Color.black
        case .checkerboard(let tone):
            AttachmentImageCheckerboard(tone: tone)
        }
    }
}

/// One landed decode pinned to the page it belongs to, the same guard the
/// inline tile uses: a recycled page must never paint the previous image.
private struct LoadedFullImage {
    let attachmentID: String
    let image: AttachmentFullImage

    func image(for id: String) -> AttachmentFullImage? {
        attachmentID == id ? image : nil
    }
}
#endif
