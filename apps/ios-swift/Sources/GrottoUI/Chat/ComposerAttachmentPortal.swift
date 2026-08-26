import SwiftUI

struct ComposerAttachmentPortal: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Bindable var interaction: ComposerInteraction
    let availableSize: CGSize
    let transitionNamespace: Namespace.ID?
    @State private var presentedOverlay: ComposerOverlay?
    @State private var morphingSource: MorphingAttachmentSource?
    @State private var showsMorphingSource = false
    @State private var collapseProgress: CGFloat = 0
    @AccessibilityFocusState private var focusedSource: ComposerSource?

    /// The card shrinks into the attachment tile over this window; the reference lands in ~0.24s.
    private static let collapseDuration: TimeInterval = 0.24
    /// The menu and the photo grid are one card, so the frame change carries the morph.
    private static let cardMorphAnimation: Animation = .smooth(duration: 0.3)

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if interaction.overlay != nil {
                Color.black.opacity(0.001)
                    .ignoresSafeArea()
                    .onTapGesture { close() }
            }

            if interaction.overlay != nil || interaction.morphingAttachmentID != nil {
                transitioningPortal
                    .padding(.leading, 12)
                    .padding(.bottom, portalBottomPadding)
                    .transition(reduceMotion ? .opacity : activePortalTransition)
            }

            if showsMorphingSource, let morphingSource {
                morphingAttachment(morphingSource)
            }
        }
        .animation(Self.cardMorphAnimation, value: portalBottomPadding)
        .onChange(of: interaction.overlay) { _, overlay in
            if let overlay {
                presentedOverlay = overlay
            } else if interaction.morphingAttachmentID == nil {
                presentedOverlay = nil
            }
            Task { @MainActor in
                await Task.yield()
                focusedSource = overlay == .sources ? .camera : nil
            }
        }
    }

    private var portalTransition: AnyTransition {
        .scale(scale: 0.85, anchor: .bottomLeading)
            .combined(with: .offset(x: 2, y: 10))
            .combined(with: .opacity)
    }

    private var activePortalTransition: AnyTransition {
        interaction.overlay == .sources ? portalTransition : .opacity
    }

    @ViewBuilder
    private var transitioningPortal: some View {
        let destinationScale = portalDestinationScale
        // Reduce Motion keeps the fade but drops the travel, so the card dissolves in place.
        let travelProgress = reduceMotion ? 0 : collapseProgress
        let fadeProgress = min(1, collapseProgress / 0.45)

        portal
            .frame(width: portalWidth, height: portalHeight)
            .scaleEffect(
                x: interpolate(from: 1, to: destinationScale.width, progress: travelProgress),
                y: interpolate(from: 1, to: destinationScale.height, progress: travelProgress),
                anchor: .topLeading
            )
            .offset(
                x: portalCollapseOffset.width * travelProgress,
                y: portalCollapseOffset.height * travelProgress
            )
            .opacity(1 - fadeProgress)
            .blur(radius: reduceMotion ? 0 : 6 * fadeProgress)
            .allowsHitTesting(!isCommittingAttachment)
            .animation(.easeOut(duration: Self.collapseDuration), value: collapseProgress)
            .animation(.smooth(duration: 0.12), value: interaction.morphDestinationFrame)
    }

    @ViewBuilder
    private func morphingAttachment(_ source: MorphingAttachmentSource) -> some View {
        let destination = morphDestinationFrame ?? source.frame
        MorphingAttachmentImage(
            url: source.attachment.localURL,
            sourceFrame: source.frame,
            destinationFrame: destination,
            sourceCornerRadius: source.cornerRadius,
            progress: collapseProgress
        )
            .zIndex(30)
            .animation(.smooth(duration: 0.12), value: interaction.morphDestinationFrame)
    }

    @ViewBuilder
    private var portal: some View {
        if #available(iOS 26, macOS 26, *), displayedOverlay == .sources {
            GlassEffectContainer(spacing: 12) {
                portalContents
                    .glassEffect(.regular, in: .rect(cornerRadius: portalCornerRadius))
            }
            .accessibilityAddTraits(.isModal)
        } else {
            portalContents
                .background(portalFallbackBackground)
                .clipShape(.rect(cornerRadius: portalCornerRadius))
                .overlay {
                    RoundedRectangle(cornerRadius: portalCornerRadius)
                        .stroke(.white.opacity(0.12), lineWidth: 0.5)
                }
                .shadow(color: .black.opacity(0.28), radius: 24, y: 10)
                .accessibilityAddTraits(.isModal)
        }
    }

    /// The media card sits nearly full-bleed, so its corners must nest concentrically inside the
    /// display's (~55pt) rounding: inner radius ≈ outer minus inset. The source menu floats
    /// mid-screen with no bezel relationship and keeps the ordinary card radius.
    private var portalCornerRadius: CGFloat {
        displayedOverlay == .sources ? 30 : 44
    }

    private var portalContents: some View {
        ZStack {
            if displayedOverlay == .sources {
                ComposerSourceMenu(
                    focusedSource: $focusedSource,
                    onCamera: { show(.camera) },
                    onPhotos: { show(.photos) },
                    onFiles: {
                        presentedOverlay = nil
                        interaction.overlay = nil
                        interaction.isFileImporterPresented = true
                    }
                )
                .transition(portalContentTransition)
            }
            if displayedOverlay == .photos {
                #if os(iOS)
                ComposerPhotoPickerView(
                    maximumSelectionCount: interaction.remainingCapacity,
                    onCancel: { show(.sources) },
                    onAdd: commitPhotos
                )
                .transition(portalContentTransition)
                #else
                EmptyView()
                #endif
            }
            if displayedOverlay == .camera {
                #if os(iOS)
                CameraCaptureView(
                    onCancel: { show(.sources) },
                    onCapture: commitCapture
                )
                .transition(portalContentTransition)
                #else
                ContentUnavailableView("Camera unavailable", systemImage: "camera")
                #endif
            }
        }
        .animation(.smooth(duration: 0.22), value: displayedOverlay)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityAction(.escape, close)
    }

    @ViewBuilder
    private var portalFallbackBackground: some View {
        if displayedOverlay == .sources {
            Rectangle().fill(.regularMaterial)
        } else {
            Color.black
        }
    }

    private var portalWidth: CGFloat {
        switch displayedOverlay {
        case .sources: min(286, availableSize.width - 32)
        default: availableSize.width - 24
        }
    }

    private var portalHeight: CGFloat {
        switch displayedOverlay {
        case .sources: 210
        default: min(520, max(390, availableSize.height * 0.58))
        }
    }

    /// The source menu pops off the plus and stands clear of the composer; the media portals are
    /// full-bleed cards that sit on the container floor the way the reference does.
    private var portalBottomPadding: CGFloat {
        guard displayedOverlay == .sources else { return 8 }
        guard let composerTop = interaction.composerSurfaceFrame?.minY else { return 8 }
        return Self.sourceMenuBottomPadding(
            composerTop: composerTop,
            containerHeight: availableSize.height,
            menuHeight: portalHeight
        )
    }

    /// Sits the menu on the composer's top edge, but never so high that a tall draft or a full
    /// attachment strip pushes the card off the top of the screen.
    static func sourceMenuBottomPadding(
        composerTop: CGFloat,
        containerHeight: CGFloat,
        menuHeight: CGFloat
    ) -> CGFloat {
        let aboveComposer = containerHeight - composerTop + 8
        let highestAllowed = max(8, containerHeight - menuHeight - 8)
        return min(max(8, aboveComposer), highestAllowed)
    }

    private var portalContentTransition: AnyTransition {
        .modifier(
            active: PortalContentTransitionModifier(opacity: 0, blur: 2),
            identity: PortalContentTransitionModifier(opacity: 1, blur: 0)
        )
    }

    private var portalCollapseOffset: CGSize {
        guard let destination = morphDestinationFrame else { return .zero }
        return CGSize(
            width: destination.minX - portalOrigin.x,
            height: destination.minY - portalOrigin.y
        )
    }

    private var portalDestinationScale: CGSize {
        guard let destination = morphDestinationFrame else { return CGSize(width: 1, height: 1) }
        return CGSize(
            width: destination.width / portalWidth,
            height: destination.height / portalHeight
        )
    }

    private var portalOrigin: CGPoint {
        CGPoint(x: 12, y: availableSize.height - portalBottomPadding - portalHeight)
    }

    private var morphDestinationFrame: CGRect? {
        interaction.morphDestinationFrame.map {
            CGRect(x: $0.minX, y: $0.minY, width: 88, height: 88)
        }
    }

    private func close() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            presentedOverlay = nil
            interaction.overlay = nil
        }
    }

    private var displayedOverlay: ComposerOverlay? {
        presentedOverlay ?? interaction.overlay
    }

    private var isCommittingAttachment: Bool {
        interaction.morphingAttachmentID != nil
    }

    private func show(_ overlay: ComposerOverlay) {
        withAnimation(Self.cardMorphAnimation) {
            presentedOverlay = overlay
            interaction.overlay = overlay
        }
    }

    private func commitPhotos(_ urls: [URL], sourceFrame: CGRect?) {
        Task { @MainActor in
            let prepared = await interaction.preparePhotoFiles(urls)
            commit(prepared, sourceFrame: sourceFrame)
        }
    }

    private func commitCapture(_ data: Data) {
        commit(
            interaction.prepareCapturedPhoto(data).map { [$0] } ?? [],
            sourceFrame: nil
        )
    }

    private func commit(
        _ prepared: [ComposerAttachment],
        sourceFrame: CGRect?
    ) {
        guard let first = prepared.first else { return }
        if transitionNamespace != nil, !reduceMotion {
            let localSourceFrame = sourceFrame ?? CGRect(
                x: 0,
                y: 0,
                width: portalWidth,
                height: portalHeight
            )
            morphingSource = MorphingAttachmentSource(
                attachment: first,
                frame: localSourceFrame.offsetBy(dx: portalOrigin.x, dy: portalOrigin.y),
                cornerRadius: sourceFrame == nil ? portalCornerRadius : 1
            )
            showsMorphingSource = true
            collapseProgress = 0
        }
        Task { @MainActor in
            await Task.yield()
            interaction.morphDestinationFrame = nil
            interaction.morphingAttachmentID = first.id
            // Hand the keyboard back as the morph starts, not once the card has finished leaving.
            interaction.overlay = nil
            interaction.appendPrepared(prepared)

            let deadline = ContinuousClock.now + .milliseconds(120)
            while interaction.morphDestinationFrame == nil, ContinuousClock.now < deadline {
                try? await Task.sleep(for: .milliseconds(16))
            }

            withAnimation(.easeOut(duration: Self.collapseDuration)) {
                collapseProgress = 1
            }
            try? await Task.sleep(for: .milliseconds(280))

            withAnimation(.easeOut(duration: 0.08)) {
                showsMorphingSource = false
                presentedOverlay = nil
                morphingSource = nil
                collapseProgress = 0
                interaction.morphingAttachmentID = nil
                interaction.morphDestinationFrame = nil
            }
        }
    }

    private func interpolate(from start: CGFloat, to end: CGFloat, progress: CGFloat) -> CGFloat {
        start + ((end - start) * progress)
    }
}
private struct PortalContentTransitionModifier: ViewModifier {
    let opacity: Double
    let blur: CGFloat

    func body(content: Content) -> some View {
        content.opacity(opacity).blur(radius: blur)
    }
}
