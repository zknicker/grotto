import Foundation
import SwiftUI

/// One staged photo's trip from the picker into the composer's attachment tile.
///
/// A flight launches when the landing tile reports its frame — the tile only exists once the
/// attachment has been appended and laid out, so that report is the earliest honest target — and it
/// ends when the travel animation completes. Nothing here is timed: `generation` is what lets a
/// superseded flight's completion land harmlessly instead of tearing down its successor.
struct ComposerAttachmentFlight: Equatable {
    /// The photo the picker hands over and where it takes off from, in the portal's coordinate
    /// space. Absent under Reduce Motion, where nothing travels and the card dissolves in place.
    struct Photo: Equatable {
        let url: URL
        let frame: CGRect
        let cornerRadius: CGFloat
    }

    let generation: Int
    let attachmentID: String
    let photo: Photo?
    private(set) var isLaunched = false

    /// True the first time only. The landing tile keeps reporting while the composer grows its
    /// attachment strip, and those later reports retarget a flight already under way rather than
    /// starting a second one.
    mutating func launch() -> Bool {
        guard !isLaunched else { return false }
        isLaunched = true
        return true
    }

    /// A flight whose attachment has left the composer — sent, or removed from the strip — has
    /// nothing left to land on.
    func targetExists(in attachmentIDs: [String]) -> Bool {
        attachmentIDs.contains(attachmentID)
    }
}

/// Collapses the portal card into the landing tile.
///
/// `progress` is the animated value, not the scale and the offset themselves: the landing tile is
/// still settling into a composer that is growing an attachment strip, so a target that keeps
/// moving has to change where the card is going without restarting how it gets there.
struct ComposerPortalCollapseModifier: ViewModifier, @preconcurrency Animatable {
    let scale: CGSize
    let offset: CGSize
    /// Reduce Motion keeps the dissolve and drops the travel and the blur.
    let travels: Bool
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    /// The card is gone well before the travel ends, so the only thing left to follow the rest of
    /// the way down is the photo.
    static let fadeEnd: CGFloat = 0.45

    static func fade(for progress: CGFloat) -> CGFloat {
        min(1, max(0, progress / fadeEnd))
    }

    func body(content: Content) -> some View {
        let travel = travels ? progress : 0
        let fade = Self.fade(for: progress)

        content
            .scaleEffect(
                x: 1 + ((scale.width - 1) * travel),
                y: 1 + ((scale.height - 1) * travel),
                anchor: .topLeading
            )
            .offset(x: offset.width * travel, y: offset.height * travel)
            .opacity(1 - fade)
            .blur(radius: travels ? 6 * fade : 0)
    }
}
