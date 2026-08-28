import SwiftUI

struct ComposerAttachmentPortal: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Bindable var interaction: ComposerInteraction
    let availableSize: CGSize
    /// A screen that owns a transition namespace is one whose composer reports a landing frame, so
    /// it is the flag for whether a committed photo flies down or simply appears.
    let transitionNamespace: Namespace.ID?

    @State private var presentedOverlay: ComposerOverlay?
    @State private var flight: ComposerAttachmentFlight?
    @State private var flightGeneration = 0
    @State private var flightProgress: CGFloat = 0
    @AccessibilityFocusState private var focusedSource: ComposerSource?

    /// One spring carries the card's collapse and the photo's travel. It starts once per flight and
    /// is never restarted, so its own completion is what ends the flight — no clock decides.
    private static let travelAnimation: Animation = .spring(response: 0.34, dampingFraction: 0.86)
    /// Reduce Motion has nothing to travel, so the card only dissolves.
    private static let dissolveAnimation: Animation = .easeOut(duration: 0.24)
    /// An abandoned flight leaves the photo already sitting in the strip, so the card springs back
    /// to rest rather than finishing a collapse into a tile that stopped meaning anything.
    private static let abandonAnimation: Animation = .spring(response: 0.28, dampingFraction: 0.9)
    /// The menu and the photo grid are one card, so the frame change carries the morph.
    private static let cardMorphAnimation: Animation = .smooth(duration: 0.3)
    private static let teardownAnimation: Animation = .easeOut(duration: 0.08)

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if interaction.overlay != nil {
                Color.black.opacity(0.001)
                    .ignoresSafeArea()
                    .onTapGesture { close() }
            }

            if interaction.overlay != nil || flight != nil {
                collapsingCard
                    // The collapse measures from this inset, so both come from the same number.
                    .padding(.leading, ComposerPortalGeometry.leadingInset)
                    .padding(.bottom, geometry.bottomPadding)
                    .transition(reduceMotion ? .opacity : activePortalTransition)
            }

            if let photo = flight?.photo {
                flyingPhoto(photo)
            }
        }
        .animation(Self.cardMorphAnimation, value: geometry.bottomPadding)
        .onChange(of: interaction.overlay, handleOverlayChange)
        .onChange(of: interaction.morphDestinationFrame) { _, landing in
            guard landing != nil else { return }
            launchFlight()
        }
        .onChange(of: interaction.attachments.map(\.id)) { _, attachmentIDs in
            guard let flight, !flight.targetExists(in: attachmentIDs) else { return }
            abandonFlight()
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

    private var collapsingCard: some View {
        let box = geometry
        return ComposerPortalCard(
            overlay: displayedOverlay,
            cornerRadius: box.cornerRadius,
            remainingCapacity: interaction.remainingCapacity,
            focusedSource: $focusedSource,
            onShow: show,
            onFiles: openFileImporter,
            onAddPhotos: commitPhotos,
            onCapture: commitCapture,
            onEscape: close
        )
        .frame(width: box.width, height: box.height)
        .modifier(
            ComposerPortalCollapseModifier(
                scale: box.collapseScale(landing: interaction.morphDestinationFrame),
                offset: box.collapseOffset(landing: interaction.morphDestinationFrame),
                travels: !reduceMotion,
                progress: flightProgress
            )
        )
        // A card that has committed a photo is on its way out and takes no more taps. It covers
        // the composer, so this is what keeps the composer live for the whole flight — nothing
        // else on the screen is gated, and the card is back the instant a new portal opens.
        .allowsHitTesting(flight == nil)
    }

    private func flyingPhoto(_ photo: ComposerAttachmentFlight.Photo) -> some View {
        MorphingAttachmentImage(
            url: photo.url,
            sourceFrame: photo.frame,
            destinationFrame: interaction.morphDestinationFrame ?? photo.frame,
            sourceCornerRadius: photo.cornerRadius,
            progress: flightProgress
        )
        .zIndex(30)
    }

    private var geometry: ComposerPortalGeometry {
        ComposerPortalGeometry(
            overlay: displayedOverlay,
            availableSize: availableSize,
            composerTop: interaction.composerSurfaceFrame?.minY
        )
    }

    private var displayedOverlay: ComposerOverlay? {
        presentedOverlay ?? interaction.overlay
    }

    private func handleOverlayChange(_: ComposerOverlay?, _ overlay: ComposerOverlay?) {
        if let overlay {
            // A portal opening mid-flight takes the card back before the collapse finishes.
            abandonFlight()
            presentedOverlay = overlay
        } else if flight == nil {
            presentedOverlay = nil
        }
        Task { @MainActor in
            await Task.yield()
            focusedSource = overlay == .sources ? .camera : nil
        }
    }

    private func close() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            presentedOverlay = nil
            interaction.overlay = nil
        }
    }

    private func show(_ overlay: ComposerOverlay) {
        withAnimation(Self.cardMorphAnimation) {
            presentedOverlay = overlay
            interaction.overlay = overlay
        }
    }

    private func openFileImporter() {
        presentedOverlay = nil
        interaction.overlay = nil
        interaction.isFileImporterPresented = true
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

    private func commit(_ prepared: [ComposerAttachment], sourceFrame: CGRect?) {
        guard let first = prepared.first else { return }
        guard transitionNamespace != nil else {
            // Nothing reports a landing frame on this screen, so there is nowhere to fly to: the
            // card closes and the attachment simply appears.
            interaction.overlay = nil
            interaction.appendPrepared(prepared)
            return
        }

        flightGeneration += 1
        withTransaction(Transaction(animation: nil)) { flightProgress = 0 }
        flight = ComposerAttachmentFlight(
            generation: flightGeneration,
            attachmentID: first.id,
            photo: flightPhoto(for: first, sourceFrame: sourceFrame)
        )
        interaction.morphDestinationFrame = nil
        interaction.morphingAttachmentID = first.id
        // Hand the keyboard back as the flight starts, not once the card has finished leaving.
        interaction.overlay = nil
        interaction.appendPrepared(prepared)
    }

    private func flightPhoto(
        for attachment: ComposerAttachment,
        sourceFrame: CGRect?
    ) -> ComposerAttachmentFlight.Photo? {
        guard !reduceMotion else { return nil }
        let box = geometry
        // A capture has no source cell, so the whole card is what shrinks into the tile.
        let takeOff = sourceFrame ?? CGRect(origin: .zero, size: box.size)
        return ComposerAttachmentFlight.Photo(
            url: attachment.localURL,
            frame: takeOff.offsetBy(dx: box.origin.x, dy: box.origin.y),
            cornerRadius: sourceFrame == nil ? box.cornerRadius : 1
        )
    }

    private func launchFlight() {
        guard var flight, flight.launch() else { return }
        self.flight = flight
        let generation = flight.generation
        withAnimation(
            reduceMotion ? Self.dissolveAnimation : Self.travelAnimation,
            completionCriteria: .logicallyComplete
        ) {
            flightProgress = 1
        } completion: {
            endFlight(generation: generation)
        }
    }

    /// Ends the flight whose photo the composer's tile now owns. A superseded flight's completion
    /// still arrives, so the generation check keeps it from tearing down its successor.
    ///
    /// The landing frame outlives the flight on purpose: `commit` is the only thing that clears it,
    /// so the collapse geometry stays put while the card finishes leaving instead of springing back
    /// to full size the moment its target disappears.
    private func endFlight(generation: Int) {
        guard flight?.generation == generation else { return }
        withAnimation(Self.teardownAnimation) {
            flight = nil
            presentedOverlay = interaction.overlay
        }
        interaction.morphingAttachmentID = nil
    }

    /// Drops a flight whose landing tile is gone, or whose screen a new portal has taken back. The
    /// photo is already staged either way, so revealing the tile is the whole cleanup — and the
    /// card unwinds along the collapse it was already on rather than cutting back to rest.
    private func abandonFlight() {
        guard flight != nil else { return }
        withAnimation(Self.teardownAnimation) { flight = nil }
        withAnimation(Self.abandonAnimation) { flightProgress = 0 }
        interaction.morphingAttachmentID = nil
    }
}
