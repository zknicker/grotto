import Foundation

/// How one transcript snapshot becomes the next, classified so the list can
/// keep the scroll anchored without guessing.
///
/// A transcript only ever changes in three shapes: newer items arrive at the
/// tail (a send or a delivery), older items arrive at the head (a history
/// page), or items change in place (a pending send resolving, a thread count
/// moving). Anything else — a different Chat, a pruned page — is a reset.
/// Classifying by id sequence keeps the decision exact and testable, and the
/// inverted list translates each case into an insert that cannot move the
/// resting edge.
enum TranscriptListUpdate: Equatable {
    /// The id sequence is unchanged; content may have changed in place.
    case refresh
    /// `appended` newer items arrived at the chronological tail.
    case append(appended: Int)
    /// `prepended` older items arrived at the chronological head.
    case prepend(prepended: Int)
    /// The sequences do not extend one another; rebuild from scratch.
    case reset

    static func classify(old: [String], new: [String]) -> TranscriptListUpdate {
        guard old.count <= new.count else { return .reset }
        guard !old.isEmpty else { return old.count == new.count ? .refresh : .reset }
        if old.count == new.count {
            return old == new ? .refresh : .reset
        }
        if new.prefix(old.count).elementsEqual(old) {
            return .append(appended: new.count - old.count)
        }
        if new.suffix(old.count).elementsEqual(old) {
            return .prepend(prepended: new.count - old.count)
        }
        return .reset
    }
}
