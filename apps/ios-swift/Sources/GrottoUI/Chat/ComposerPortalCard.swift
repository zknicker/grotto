import SwiftUI

/// The portal's one card. The source menu and the media pickers share it, so moving between them
/// changes the card's frame, corner radius, and contents instead of swapping two surfaces.
struct ComposerPortalCard: View {
    let overlay: ComposerOverlay?
    let cornerRadius: CGFloat
    let remainingCapacity: Int
    @AccessibilityFocusState.Binding var focusedSource: ComposerSource?
    let onShow: (ComposerOverlay) -> Void
    let onFiles: () -> Void
    let onAddPhotos: ([URL], CGRect?) -> Void
    let onCapture: @MainActor @Sendable (Data) -> Void
    let onEscape: () -> Void

    /// Whether the card is the floating glass menu (true) or an opaque media surface.
    private var isSourceMenu: Bool { overlay == .sources }

    var body: some View {
        // One card, one identity, every overlay. `if #available` never flips at runtime, but a
        // branch on the overlay would: the menu-to-media switch then removes one card and inserts
        // another, and the morph the frame change should carry degrades to a crossfade. So the
        // card stays neutral — clip, an opaque fill that swaps in for media, a stroke — and the
        // glass belongs to the menu *content*, which already swaps under the morphing frame.
        // Content inside a glass effect is what the container composites in its glass layer;
        // glass as a sibling background instead draws that layer over the card's plain content
        // and frosts the row labels out of existence.
        if #available(iOS 26, macOS 26, *) {
            GlassEffectContainer(spacing: 12) {
                contents
                    .clipShape(cardShape)
                    .background {
                        if !isSourceMenu {
                            cardShape
                                .fill(.black)
                                .shadow(color: .black.opacity(0.28), radius: 24, y: 10)
                        }
                    }
                    .overlay {
                        cardShape
                            .stroke(.white.opacity(0.12), lineWidth: 0.5)
                            .opacity(isSourceMenu ? 0 : 1)
                    }
            }
            .accessibilityAddTraits(.isModal)
        } else {
            contents
                .background(fallbackBackground)
                .clipShape(cardShape)
                .overlay {
                    cardShape.stroke(.white.opacity(0.12), lineWidth: 0.5)
                }
                .shadow(color: .black.opacity(0.28), radius: 24, y: 10)
                .accessibilityAddTraits(.isModal)
        }
    }

    /// The card's one shape — clip, fill, and stroke all take it, so they cannot drift apart.
    ///
    /// The media card is inset a uniform 12pt from the display, so from iOS 26 it asks the system
    /// for corners concentric with the display's own rather than naming a radius: the number is the
    /// bezel's minus the inset, and it differs on every iPhone. `isUniform` is what makes that one
    /// radius rather than four — the card's top corners are nowhere near the display's, and a
    /// non-uniform resolution squares them off.
    ///
    /// The source menu floats mid-screen with no bezel relationship and keeps its own radius, so
    /// the shape does change type across the menu-to-media morph and the corner arrives rather than
    /// travels. `AnyShape` is what keeps that a value change instead of an identity change: one card
    /// whose corner steps while its frame morphs, not two cards cross-fading. Two `Shape` types
    /// never interpolate — erasing them does not fix that, it only stops it costing the morph.
    private var cardShape: AnyShape {
        if !isSourceMenu, #available(iOS 26, macOS 26, *) {
            return AnyShape(.rect(corners: .concentric, isUniform: true))
        }
        return AnyShape(.rect(cornerRadius: cornerRadius))
    }

    private var contents: some View {
        ZStack {
            if overlay == .sources {
                sourceMenu
                    .transition(contentTransition)
            }
            if overlay == .photos {
                #if os(iOS)
                ComposerPhotoPickerView(
                    maximumSelectionCount: remainingCapacity,
                    onCancel: { onShow(.sources) },
                    onAdd: onAddPhotos
                )
                .transition(contentTransition)
                #endif
            }
            if overlay == .camera {
                #if os(iOS)
                CameraCaptureView(onCancel: { onShow(.sources) }, onCapture: onCapture)
                    .transition(contentTransition)
                #else
                ContentUnavailableView("Camera unavailable", systemImage: "camera")
                #endif
            }
        }
        .animation(.smooth(duration: 0.22), value: overlay)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityAction(.escape, onEscape)
    }

    /// The menu wears the card-sized glass itself, so its rows render inside the effect's
    /// vibrancy context and leave with the content fade while the card's frame morphs on. The
    /// interactive glass belongs here, at the one shape a finger actually touches: glass cannot
    /// sample glass, so a second interactive layer inside the rows only muddies them.
    @ViewBuilder
    private var sourceMenu: some View {
        let menu = ComposerSourceMenu(
            focusedSource: $focusedSource,
            onCamera: { onShow(.camera) },
            onPhotos: { onShow(.photos) },
            onFiles: onFiles
        )
        if #available(iOS 26, macOS 26, *) {
            menu
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .glassEffect(.regular.interactive(), in: .rect(cornerRadius: cornerRadius))
        } else {
            menu
        }
    }

    @ViewBuilder
    private var fallbackBackground: some View {
        if overlay == .sources {
            Rectangle().fill(.regularMaterial)
        } else {
            Color.black
        }
    }

    private var contentTransition: AnyTransition {
        .modifier(
            active: PortalContentTransitionModifier(opacity: 0, blur: 2),
            identity: PortalContentTransitionModifier(opacity: 1, blur: 0)
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
