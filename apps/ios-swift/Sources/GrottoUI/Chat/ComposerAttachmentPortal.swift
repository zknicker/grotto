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
        .scale(scale: 0.92, anchor: .bottomLeading)
            .combined(with: .offset(x: 4, y: 12))
            .combined(with: .opacity)
    }

    private var activePortalTransition: AnyTransition {
        interaction.overlay == .sources ? portalTransition : .opacity
    }

    @ViewBuilder
    private var transitioningPortal: some View {
        let destinationScale = portalDestinationScale
        let fadeProgress = min(1, collapseProgress / 0.65)

        portal
            .frame(width: portalWidth, height: portalHeight)
            .scaleEffect(
                x: interpolate(from: 1, to: destinationScale.width, progress: collapseProgress),
                y: interpolate(from: 1, to: destinationScale.height, progress: collapseProgress),
                anchor: .topLeading
            )
            .offset(
                x: portalCollapseOffset.width * collapseProgress,
                y: portalCollapseOffset.height * collapseProgress
            )
            .opacity(1 - fadeProgress)
            .blur(radius: 5 * fadeProgress)
            .allowsHitTesting(!isCommittingAttachment)
            .animation(.easeOut(duration: 0.26), value: collapseProgress)
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
                    .glassEffect(.regular, in: .rect(cornerRadius: 30))
            }
            .accessibilityAddTraits(.isModal)
        } else {
            portalContents
                .background(portalFallbackBackground)
                .clipShape(.rect(cornerRadius: 30))
                .overlay {
                    RoundedRectangle(cornerRadius: 30)
                        .stroke(.white.opacity(0.12), lineWidth: 0.5)
                }
                .shadow(color: .black.opacity(0.28), radius: 24, y: 10)
                .accessibilityAddTraits(.isModal)
        }
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
        .animation(.smooth(duration: 0.2), value: displayedOverlay)
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

    private var portalBottomPadding: CGFloat {
        8
    }

    private var portalContentTransition: AnyTransition {
        .modifier(
            active: PortalContentTransitionModifier(opacity: 0, blur: 2),
            identity: PortalContentTransitionModifier(opacity: 1, blur: 0)
        )
    }

    private var portalCollapseOffset: CGSize {
        guard let destination = morphDestinationFrame else { return .zero }
        let origin = CGPoint(
            x: 12,
            y: availableSize.height - portalBottomPadding - portalHeight
        )
        return CGSize(
            width: destination.minX - origin.x,
            height: destination.minY - origin.y
        )
    }

    private var portalDestinationScale: CGSize {
        guard let destination = morphDestinationFrame else { return CGSize(width: 1, height: 1) }
        return CGSize(
            width: destination.width / portalWidth,
            height: destination.height / portalHeight
        )
    }

    private var morphDestinationFrame: CGRect? {
        interaction.morphDestinationFrame.map {
            CGRect(x: $0.minX, y: $0.minY + 7, width: 88, height: 88)
        }
    }

    private func close() {
        presentedOverlay = nil
        interaction.overlay = nil
    }

    private var displayedOverlay: ComposerOverlay? {
        presentedOverlay ?? interaction.overlay
    }

    private var isCommittingAttachment: Bool {
        interaction.morphingAttachmentID != nil
    }

    private func show(_ overlay: ComposerOverlay) {
        withAnimation(.smooth(duration: 0.22)) {
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
        if transitionNamespace != nil {
            let portalOrigin = CGPoint(
                x: 12,
                y: availableSize.height - portalBottomPadding - portalHeight
            )
            let localSourceFrame = sourceFrame ?? CGRect(
                x: 0,
                y: 0,
                width: portalWidth,
                height: portalHeight
            )
            morphingSource = MorphingAttachmentSource(
                attachment: first,
                frame: localSourceFrame.offsetBy(dx: portalOrigin.x, dy: portalOrigin.y),
                cornerRadius: sourceFrame == nil ? 30 : 1
            )
            showsMorphingSource = true
            collapseProgress = 0
        }
        Task { @MainActor in
            await Task.yield()
            interaction.morphDestinationFrame = nil
            interaction.morphingAttachmentID = first.id
            interaction.appendPrepared(prepared)

            let deadline = ContinuousClock.now + .milliseconds(160)
            while interaction.morphDestinationFrame == nil, ContinuousClock.now < deadline {
                try? await Task.sleep(for: .milliseconds(16))
            }

            withAnimation(.easeOut(duration: 0.26)) {
                collapseProgress = 1
                interaction.overlay = nil
            }
            try? await Task.sleep(for: .milliseconds(320))

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

    private func interpolate(from start: CGRect, to end: CGRect, progress: CGFloat) -> CGRect {
        CGRect(
            x: interpolate(from: start.minX, to: end.minX, progress: progress),
            y: interpolate(from: start.minY, to: end.minY, progress: progress),
            width: interpolate(from: start.width, to: end.width, progress: progress),
            height: interpolate(from: start.height, to: end.height, progress: progress)
        )
    }
}

private struct PortalContentTransitionModifier: ViewModifier {
    let opacity: Double
    let blur: CGFloat

    func body(content: Content) -> some View {
        content.opacity(opacity).blur(radius: blur)
    }
}

private struct MorphingAttachmentSource {
    let attachment: ComposerAttachment
    let frame: CGRect
    let cornerRadius: CGFloat
}

private struct MorphingAttachmentImage: View, @preconcurrency Animatable {
    let url: URL
    let sourceFrame: CGRect
    let destinationFrame: CGRect
    let sourceCornerRadius: CGFloat
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let frame = interpolate(from: sourceFrame, to: destinationFrame, progress: progress)
        let cornerRadius = interpolate(from: sourceCornerRadius, to: 14, progress: progress)
        let revealProgress = min(1, max(0, (progress - 0.78) / 0.22))

        LocalAttachmentImage(url: url)
            .frame(width: frame.width, height: frame.height)
            .clipShape(.rect(cornerRadius: cornerRadius))
            .position(x: frame.midX, y: frame.midY)
            .opacity(revealProgress)
            .blur(radius: 5 * (1 - revealProgress))
    }

    private func interpolate(from start: CGFloat, to end: CGFloat, progress: CGFloat) -> CGFloat {
        start + ((end - start) * progress)
    }

    private func interpolate(from start: CGRect, to end: CGRect, progress: CGFloat) -> CGRect {
        CGRect(
            x: interpolate(from: start.minX, to: end.minX, progress: progress),
            y: interpolate(from: start.minY, to: end.minY, progress: progress),
            width: interpolate(from: start.width, to: end.width, progress: progress),
            height: interpolate(from: start.height, to: end.height, progress: progress)
        )
    }
}

private struct ComposerSourceMenu: View {
    @AccessibilityFocusState.Binding var focusedSource: ComposerSource?
    let onCamera: () -> Void
    let onPhotos: () -> Void
    let onFiles: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            sourceRow(.camera, title: "Camera", systemImage: "camera", action: onCamera)
            sourceRow(.photos, title: "Photos", systemImage: "photo.on.rectangle", action: onPhotos)
            sourceRow(.files, title: "Files", systemImage: "paperclip", action: onFiles)
        }
        .padding(.vertical, 6)
        .foregroundStyle(.primary)
    }

    private func sourceRow(
        _ source: ComposerSource,
        title: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                sourceIcon(systemImage)
                Text(title).font(.title3)
                Spacer()
            }
            .padding(.horizontal, 18)
            .frame(minHeight: 66)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityFocused($focusedSource, equals: source)
    }

    @ViewBuilder
    private func sourceIcon(_ systemImage: String) -> some View {
        if #available(iOS 26, macOS 26, *) {
            Image(systemName: systemImage)
                .font(.title3.weight(.medium))
                .frame(width: 44, height: 44)
                .glassEffect(.regular.interactive(), in: .circle)
        } else {
            Image(systemName: systemImage)
                .font(.title3.weight(.medium))
                .frame(width: 44, height: 44)
                .background(.primary.opacity(0.055), in: .circle)
        }
    }
}

private enum ComposerSource: Hashable {
    case camera
    case photos
    case files
}
