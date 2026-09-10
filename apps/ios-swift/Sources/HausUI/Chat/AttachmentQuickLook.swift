#if os(iOS)
import QuickLook
import SwiftUI
import UIKit

/// Presents Quick Look the way the system's own apps do: a real
/// `QLPreviewController` presented modally from UIKit, so the preview opens
/// with its chrome visible — title, close, share — and a tap on the content
/// is what toggles immersion, matching Files and Messages. SwiftUI's
/// `quickLookPreview` modifier opened straight into the immersive state and
/// offers no control over it.
struct AttachmentQuickLook: UIViewControllerRepresentable {
    @Binding var url: URL?

    func makeUIViewController(context: Context) -> PresenterController {
        PresenterController()
    }

    func updateUIViewController(_ controller: PresenterController, context: Context) {
        controller.onDismiss = { url = nil }
        controller.update(url: url)
    }

    /// An invisible anchor in the hierarchy whose only job is to own the
    /// modal presentation and report its dismissal back to the binding.
    final class PresenterController: UIViewController {
        var onDismiss: (() -> Void)?
        private var currentURL: URL?

        func update(url: URL?) {
            guard url != currentURL else { return }
            currentURL = url

            guard let url else {
                // The binding was cleared from outside; take the modal down
                // with it so state and screen cannot disagree.
                presentedViewController?.dismiss(animated: true)
                return
            }

            let preview = QLPreviewController()
            preview.dataSource = self
            preview.delegate = self
            // Presented bare, iOS 26 opens an image straight into the
            // immersive state: no title, no close control until a content
            // tap. Inside a navigation controller the preview opens with its
            // bar, and a content tap still toggles immersion, as in Files.
            // Quick Look supplies title, share, and markup for that bar but
            // no way out, so the close control is ours.
            preview.navigationItem.rightBarButtonItem = UIBarButtonItem(
                systemItem: .close,
                primaryAction: UIAction { [weak self] _ in self?.close() }
            )
            let container = UINavigationController(rootViewController: preview)
            container.modalPresentationStyle = .fullScreen
            // Presenting inside a SwiftUI update pass races the hosting
            // hierarchy; the next runloop turn is the earliest safe moment.
            DispatchQueue.main.async { [weak self] in
                guard let self, self.currentURL != nil, self.presentedViewController == nil else {
                    return
                }
                self.present(container, animated: true)
            }
        }

        private func close() {
            presentedViewController?.dismiss(animated: true)
            didDismiss()
        }

        /// Runs once per preview whichever way it ends — the close control or
        /// Quick Look's own dismissal — so the binding is cleared exactly once.
        fileprivate func didDismiss() {
            guard currentURL != nil else { return }
            currentURL = nil
            onDismiss?()
        }
    }
}

extension AttachmentQuickLook.PresenterController: @MainActor QLPreviewControllerDataSource {
    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        currentURL == nil ? 0 : 1
    }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        (currentURL ?? URL(fileURLWithPath: "/")) as NSURL
    }
}

extension AttachmentQuickLook.PresenterController: @MainActor QLPreviewControllerDelegate {
    func previewControllerDidDismiss(_ controller: QLPreviewController) {
        didDismiss()
    }
}
#endif
