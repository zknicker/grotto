#if os(iOS)
import SwiftUI
import UIKit

/// Puts the image viewer on screen with the system's zoom transition.
///
/// The interaction the reference sets — a card that grows out of the tapped
/// tile, follows a finger anywhere over the still-visible Chat, rounds and
/// shrinks as it travels, and either springs back open or falls into its tile —
/// is `UIViewController.preferredTransition = .zoom`. It is interruptible and
/// retargetable, and it honours Reduce Motion, because UIKit drives it. Writing
/// it by hand would be re-deriving all of that, worse.
///
/// The presentation is owned by the screen, not the row: transcript rows live
/// in `UIHostingConfiguration` cells, which have no view controller to present
/// from.
struct AttachmentImageViewerPresenter: UIViewControllerRepresentable {
    @Binding var attachmentID: String?
    let pages: [MessageAttachmentPresentation]
    let tiles: AttachmentImageTileRegistry
    let onOpen: (MessageAttachmentPresentation) async throws -> URL

    func makeUIViewController(context: Context) -> PresenterController {
        PresenterController()
    }

    func updateUIViewController(_ controller: PresenterController, context: Context) {
        controller.onDismiss = { attachmentID = nil }
        controller.update(attachmentID: attachmentID, pages: pages, tiles: tiles, open: onOpen)
    }

    /// An invisible anchor whose only job is to own the modal presentation and
    /// report its dismissal back to the binding.
    @MainActor
    final class PresenterController: UIViewController {
        var onDismiss: (() -> Void)?
        private var requestedAttachmentID: String?
        private weak var viewer: UIViewController?

        func update(
            attachmentID: String?,
            pages: [MessageAttachmentPresentation],
            tiles: AttachmentImageTileRegistry,
            open: @escaping (MessageAttachmentPresentation) async throws -> URL
        ) {
            guard attachmentID != requestedAttachmentID else { return }
            requestedAttachmentID = attachmentID

            guard let attachmentID else {
                viewer?.dismiss(animated: true)
                viewer = nil
                return
            }
            guard let startIndex = AttachmentImagePages.startIndex(of: attachmentID, in: pages)
            else {
                // The tapped image is not in the transcript the screen is
                // showing; there is no viewer to open, so the request is
                // retired rather than left pending.
                requestedAttachmentID = nil
                onDismiss?()
                return
            }
            let session = AttachmentImageViewerSession(
                pages: pages,
                startIndex: startIndex,
                tiles: tiles,
                decodePixelSize: decodePixelSize(),
                open: open
            )
            // Presenting inside a SwiftUI update pass races the hosting
            // hierarchy; the next runloop turn is the earliest safe moment.
            DispatchQueue.main.async { [weak self] in
                self?.present(session: session)
            }
        }

        private func present(session: AttachmentImageViewerSession) {
            guard requestedAttachmentID != nil, presentedViewController == nil else { return }
            let host = ViewerController()
            host.rootView = AttachmentImageViewer(
                session: session,
                onClose: { [weak host] in host?.dismiss(animated: true) },
                onShare: { [weak host, weak session] attachment in
                    Task {
                        guard let url = await session?.shareURL(for: attachment) else { return }
                        host?.share(url)
                    }
                }
            )
            host.view.backgroundColor = .black
            host.modalPresentationStyle = .fullScreen
            // Asked for again at dismissal, so a reader who swiped to another
            // image collapses into *that* image's tile. A tile that scrolled
            // away answers nil and UIKit falls back to a fade.
            host.preferredTransition = .zoom { [weak session] _ in
                session?.sourceView()
            }
            host.onDismiss = { [weak self] in
                guard let self, requestedAttachmentID != nil else { return }
                requestedAttachmentID = nil
                onDismiss?()
            }
            viewer = host
            present(host, animated: true)
        }

        private func decodePixelSize() -> CGFloat {
            let screen = view.window?.windowScene?.screen
            return AttachmentImageViewerDecode.pixelSize(
                screenSize: screen?.bounds.size ?? view.bounds.size,
                scale: screen?.scale ?? 1
            )
        }
    }

    /// The hosted viewer, which reports its own dismissal.
    ///
    /// `viewDidDisappear` covers both ways out — the close button and a drag
    /// carried past the threshold — where a presentation-controller delegate
    /// only fires for the interactive one.
    @MainActor
    private final class ViewerController: UIHostingController<AttachmentImageViewer?> {
        var onDismiss: (() -> Void)?

        init() {
            super.init(rootView: nil)
        }

        @available(*, unavailable)
        @MainActor required dynamic init?(coder: NSCoder) {
            fatalError("init(coder:) is not used")
        }

        func share(_ url: URL) {
            let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = view
            present(share, animated: true)
        }

        override func viewDidDisappear(_ animated: Bool) {
            super.viewDidDisappear(animated)
            guard isBeingDismissed else { return }
            onDismiss?()
        }
    }
}
#endif
