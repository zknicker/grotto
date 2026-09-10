#if os(iOS)
import SwiftUI

/// The image attachment viewer: one card of pages over the transcript.
///
/// The card's whole life — growing out of the tapped tile, following a finger
/// anywhere on screen, springing back or falling into the tile it came from,
/// and being caught and reversed mid-flight — belongs to UIKit's zoom
/// transition, which `AttachmentImageViewerPresenter` installs. Nothing here
/// re-implements any of it; this view is only what the card contains.
struct AttachmentImageViewer: View {
    @Bindable var session: AttachmentImageViewerSession
    let onClose: () -> Void
    let onShare: (MessageAttachmentPresentation) -> Void

    var body: some View {
        TabView(selection: $session.currentIndex) {
            ForEach(Array(session.pages.enumerated()), id: \.offset) { index, attachment in
                AttachmentImageViewerPage(attachment: attachment, session: session)
                    .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .ignoresSafeArea()
        .overlay(alignment: .top) { chrome }
        // The viewer is its own dark room whatever the app's appearance, so the
        // chrome's glass and glyphs resolve against the image rather than
        // against the Chat that is still behind it.
        .environment(\.colorScheme, .dark)
        .onChange(of: session.currentIndex, initial: true) { _, _ in
            session.prefetchNeighbours()
        }
    }

    private var chrome: some View {
        HStack {
            GlassChromeButton(.icon(.close), label: "Close image", action: onClose)
            Spacer(minLength: 12)
            if let current = session.current {
                GlassChromeButton(.system("square.and.arrow.up"), label: "Share image") {
                    onShare(current)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 6)
        .frame(maxWidth: .infinity)
        // Chrome over an arbitrary photograph needs its own ground; the scrim
        // is the least of it that still guarantees the two circles read.
        .background(alignment: .top) {
            LinearGradient(
                colors: [.black.opacity(0.38), .clear],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 132)
            .allowsHitTesting(false)
            .ignoresSafeArea()
        }
    }
}
#endif
