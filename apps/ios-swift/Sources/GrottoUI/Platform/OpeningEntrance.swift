import SwiftUI

/// The app-opening entrance: the launch screen stays a bare surface, and when
/// the first loaded screen mounts, its sections settle into place one after
/// another — header, transcript, composer — instead of the whole screen
/// popping in at once.
///
/// The environment flag is on only for the screen mounted by the initial
/// load; later screens (chat switches, pushes) mount plainly. Each section
/// keeps its own entered state, so the flag turning off after the entrance
/// never disturbs a section that already settled.
public enum OpeningEntranceSection {
    case header
    case timeline
    case composer

    /// Stagger reads top-to-bottom, with the composer landing last. The gaps
    /// are wide enough to read as separate beats at a glance; tighter spacing
    /// collapsed the header and transcript into one.
    var delay: TimeInterval {
        switch self {
        case .header: 0.0
        case .timeline: 0.14
        case .composer: 0.28
        }
    }

    /// Each section arrives from just off its resting place: the header drops
    /// in, the transcript and composer rise.
    var restingOffset: CGFloat {
        switch self {
        case .header: -12
        case .timeline: 12
        case .composer: 18
        }
    }
}

extension EnvironmentValues {
    /// Whether the screen being built is the one the app opens into, and
    /// should play the sectioned entrance when it appears.
    @Entry public var opensWithEntrance = false
}

extension View {
    public func openingEntrance(_ section: OpeningEntranceSection) -> some View {
        modifier(OpeningEntranceModifier(section: section))
    }
}

private struct OpeningEntranceModifier: ViewModifier {
    @Environment(\.opensWithEntrance) private var opensWithEntrance
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let section: OpeningEntranceSection
    @State private var entered = false

    func body(content: Content) -> some View {
        let awaitingEntrance = opensWithEntrance && !entered && !reduceMotion
        content
            .opacity(awaitingEntrance ? 0 : 1)
            .offset(y: awaitingEntrance ? section.restingOffset : 0)
            .onAppear {
                guard opensWithEntrance, !entered else { return }
                guard !reduceMotion else {
                    entered = true
                    return
                }
                withAnimation(.spring(response: 0.5, dampingFraction: 0.86).delay(section.delay)) {
                    entered = true
                }
            }
    }
}
