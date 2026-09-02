import SwiftUI

/// What a transcript row asks its screen to open.
///
/// Rows never present. They are hosted inside `UIHostingConfiguration` cells,
/// which have no view controller of their own, and the image viewer's zoom
/// transition has to be presented from a controller that outlives the cell it
/// grew out of. A row writes a request into the screen's binding instead, and
/// the screen's `attachmentPreview` modifier owns every presentation.
enum AttachmentPreview: Equatable {
    /// A non-image attachment, already resolved to its cache-owned file.
    case file(URL)
    /// An image attachment, opened by id. There is no download step: the tile
    /// has already cached both the bytes and a decoded bitmap, so the viewer
    /// opens on the frame of the tap and resolves the rest itself.
    case image(attachmentID: String)
    case failure(String)
}

extension View {
    /// Installs a screen's attachment presentations.
    ///
    /// - Parameters:
    ///   - images: every image the screen's transcript holds, in order; the
    ///     viewer pages through these.
    ///   - tiles: where the viewer finds the tile to grow out of and fall into.
    func attachmentPreview(
        _ preview: Binding<AttachmentPreview?>,
        images: [MessageAttachmentPresentation],
        tiles: AttachmentImageTileRegistry,
        onOpen: @escaping (MessageAttachmentPresentation) async throws -> URL
    ) -> some View {
        modifier(
            AttachmentPreviewModifier(
                preview: preview,
                images: images,
                tiles: tiles,
                onOpen: onOpen
            )
        )
    }
}

private struct AttachmentPreviewModifier: ViewModifier {
    @Binding var preview: AttachmentPreview?
    let images: [MessageAttachmentPresentation]
    let tiles: AttachmentImageTileRegistry
    let onOpen: (MessageAttachmentPresentation) async throws -> URL

    func body(content: Content) -> some View {
        content
            .background { presenters }
            .alert("Couldn’t open attachment", isPresented: failurePresented) {
                Button("OK", role: .cancel) { preview = nil }
            } message: {
                Text(failureMessage ?? "Try again.")
            }
    }

    @ViewBuilder
    private var presenters: some View {
        #if os(iOS)
        AttachmentQuickLook(url: fileURL)
        AttachmentImageViewerPresenter(
            attachmentID: imageAttachmentID,
            pages: images,
            tiles: tiles,
            onOpen: onOpen
        )
        #endif
    }

    private var fileURL: Binding<URL?> {
        Binding(
            get: { if case .file(let url) = preview { url } else { nil } },
            set: { url in
                if url == nil, case .file = preview { preview = nil }
            }
        )
    }

    private var imageAttachmentID: Binding<String?> {
        Binding(
            get: { if case .image(let id) = preview { id } else { nil } },
            set: { id in
                if id == nil, case .image = preview { preview = nil }
            }
        )
    }

    private var failureMessage: String? {
        if case .failure(let message) = preview { message } else { nil }
    }

    private var failurePresented: Binding<Bool> {
        Binding(
            get: { failureMessage != nil },
            set: { presented in
                if !presented, case .failure = preview { preview = nil }
            }
        )
    }
}
