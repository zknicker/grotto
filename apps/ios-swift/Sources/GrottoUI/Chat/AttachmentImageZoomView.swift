#if os(iOS)
import SwiftUI
import UIKit

/// One viewer page's image, in a scroll view that pinches and double-taps to
/// zoom.
///
/// The zoomed view is a `UIImageView` rather than hosted SwiftUI on purpose: a
/// scroll view zooms by transforming its zoomed view's layer, and an image
/// view's layer *is* the bitmap, so the GPU resamples the decode itself and the
/// picture stays sharp. A hosting view rasterizes once at fit, and every zoom
/// past that magnifies the rasterization.
///
/// Arbitration with the zoom transition's own gestures is a matter of whether
/// this scroll view has anything to scroll. At fit its content is exactly its
/// bounds and it does not bounce, so its pan refuses to begin and the
/// transition's drag-to-dismiss and the pager's swipe see an untouched
/// hierarchy. Zoomed, it bounces, its pan wins over both, and the presenter
/// closes the transition's own door with `interactiveDismissShouldBegin`.
struct AttachmentImageZoomView: UIViewRepresentable {
    let bitmap: CGImage
    /// Reported on every crossing of the fit boundary, so the session — and
    /// through it the zoom transition — knows whether this page is still fitted.
    let onZoomChange: (Bool) -> Void

    func makeUIView(context: Context) -> AttachmentImageZoomScrollView {
        let view = AttachmentImageZoomScrollView()
        view.onZoomChange = onZoomChange
        view.show(bitmap)
        return view
    }

    func updateUIView(_ view: AttachmentImageZoomScrollView, context: Context) {
        view.onZoomChange = onZoomChange
        view.show(bitmap)
    }
}

@MainActor
final class AttachmentImageZoomScrollView: UIScrollView, UIScrollViewDelegate {
    var onZoomChange: ((Bool) -> Void)?

    private let imageView = UIImageView()
    private var shownBitmap: CGImage?
    private var laidOutFit: CGSize = .zero
    private var reportedZoomed = false

    init() {
        super.init(frame: .zero)
        delegate = self
        backgroundColor = .clear
        contentInsetAdjustmentBehavior = .never
        showsHorizontalScrollIndicator = false
        showsVerticalScrollIndicator = false
        minimumZoomScale = 1
        maximumZoomScale = 1
        bouncesZoom = true
        imageView.contentMode = .scaleAspectFit
        imageView.isUserInteractionEnabled = false
        addSubview(imageView)

        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap))
        doubleTap.numberOfTapsRequired = 2
        addGestureRecognizer(doubleTap)

        applyScrollability()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    /// The full-resolution decode replaces the tile's bitmap in place. It is the
    /// same picture at the same aspect, so the fitted box does not move and the
    /// reader's zoom and position survive the swap. A bitmap of a *different*
    /// shape is a different picture and lays out again from fit, rather than
    /// being letterboxed inside the previous one's box.
    func show(_ bitmap: CGImage) {
        guard shownBitmap !== bitmap else { return }
        shownBitmap = bitmap
        imageView.image = UIImage(cgImage: bitmap)
        setNeedsLayout()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 0, bounds.height > 0 else { return }
        guard let fitted = fittedSize() else { return }
        if AttachmentImageZoom.needsRelayout(from: laidOutFit, to: fitted) {
            laidOutFit = fitted
            resetToFit(fitted)
        }
        centerContent()
    }

    /// Nil until a bitmap has arrived.
    private func fittedSize() -> CGSize? {
        guard let bitmap = shownBitmap else { return nil }
        return AttachmentImageZoom.fittedSize(
            image: CGSize(width: bitmap.width, height: bitmap.height),
            in: bounds.size
        )
    }

    /// The whole arbitration, in one place: at fit there is nothing to scroll
    /// and no bounce, so this scroll view's pan refuses to begin and every
    /// gesture the zoom transition and the pager installed keeps working.
    /// Zoomed, this scroll view owns the pan.
    private func applyScrollability() {
        bounces = AttachmentImageZoom.isZoomed(zoomScale)
        alwaysBounceHorizontal = false
        alwaysBounceVertical = false
    }

    private func resetToFit(_ fitted: CGSize) {
        guard let bitmap = shownBitmap else { return }
        zoomScale = 1
        minimumZoomScale = 1
        maximumZoomScale = AttachmentImageZoom.maximumScale(
            image: CGSize(width: bitmap.width, height: bitmap.height),
            in: bounds.size
        )
        imageView.frame = CGRect(origin: .zero, size: fitted)
        contentSize = fitted
        applyScrollability()
        reportZoom()
    }

    private func centerContent() {
        let vertical = AttachmentImageZoom.centeringInset(
            content: contentSize.height,
            bounds: bounds.height
        )
        let horizontal = AttachmentImageZoom.centeringInset(
            content: contentSize.width,
            bounds: bounds.width
        )
        contentInset = UIEdgeInsets(
            top: vertical,
            left: horizontal,
            bottom: vertical,
            right: horizontal
        )
    }

    private func reportZoom() {
        let zoomed = AttachmentImageZoom.isZoomed(zoomScale)
        guard zoomed != reportedZoomed else { return }
        reportedZoomed = zoomed
        onZoomChange?(zoomed)
    }

    @objc private func handleDoubleTap(_ recognizer: UITapGestureRecognizer) {
        guard let bitmap = shownBitmap else { return }
        let image = CGSize(width: bitmap.width, height: bitmap.height)
        let target = AttachmentImageZoom.doubleTapScale(
            current: zoomScale,
            image: image,
            in: bounds.size
        )
        // Reduce Motion keeps the zoom — it is the point of the gesture — and
        // drops the travel to it.
        let animated = !UIAccessibility.isReduceMotionEnabled
        if AttachmentImageZoom.isZoomed(target) {
            zoom(
                to: AttachmentImageZoom.zoomRect(
                    scale: target,
                    around: recognizer.location(in: imageView),
                    in: bounds.size
                ),
                animated: animated
            )
        } else {
            setZoomScale(1, animated: animated)
        }
    }

    // MARK: - UIScrollViewDelegate

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        centerContent()
        applyScrollability()
        reportZoom()
    }

    func scrollViewDidEndZooming(
        _ scrollView: UIScrollView,
        with view: UIView?,
        atScale scale: CGFloat
    ) {
        applyScrollability()
        reportZoom()
    }
}
#endif
