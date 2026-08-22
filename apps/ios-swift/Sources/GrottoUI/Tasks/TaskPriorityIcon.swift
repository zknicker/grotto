import GrottoModels
import SwiftUI

/// Linear-style priority glyph: signal bars for low/medium/high, an
/// exclamation tile for urgent, faint dots when unset.
///
/// Geometry is the desktop SVG's 16pt viewBox scaled by `size`. Everything but
/// urgent rides `tint` so call sites pick the hue (typically secondary); urgent
/// keeps its own orange tile, with the glyph cut out in `surface` so it stays
/// legible in dark mode.
struct TaskPriorityIcon: View {
    let priority: TaskPriority
    var size: CGFloat = 16
    var tint: Color = .secondary
    var surface: Color = GrottoPlatformColor.background

    var body: some View {
        ZStack {
            switch priority {
            case .urgent: urgentTile
            case .none: unsetDots
            case .high, .medium, .low: signalBars
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private var unit: CGFloat { size / 16 }

    private var filledBars: Int {
        switch priority {
        case .high: 3
        case .medium: 2
        case .low: 1
        case .none, .urgent: 0
        }
    }

    private var signalBars: some View {
        ZStack {
            // Bar heights climb left to right, tallest last.
            ForEach(Array(Self.bars.enumerated()), id: \.offset) { index, bar in
                RoundedRectangle(cornerRadius: 1 * unit, style: .continuous)
                    .fill(tint)
                    .frame(width: 3 * unit, height: bar.height * unit)
                    .opacity(index < filledBars ? 1 : 0.28)
                    .position(
                        x: (bar.x + 1.5) * unit,
                        y: (bar.y + bar.height / 2) * unit
                    )
            }
        }
    }

    private var unsetDots: some View {
        ZStack {
            ForEach([3.5, 8.0, 12.5], id: \.self) { centerX in
                Circle()
                    .fill(tint)
                    .opacity(0.45)
                    .frame(width: 2 * unit, height: 2 * unit)
                    .position(x: centerX * unit, y: 8 * unit)
            }
        }
    }

    private var urgentTile: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 3.5 * unit, style: .continuous)
                .fill(Color.orange)
                .frame(width: 13 * unit, height: 13 * unit)
            Capsule()
                .fill(surface)
                .frame(width: 1.6 * unit, height: 5.6 * unit)
                .position(x: 8 * unit, y: 6.5 * unit)
            Circle()
                .fill(surface)
                .frame(width: 1.8 * unit, height: 1.8 * unit)
                .position(x: 8 * unit, y: 11.2 * unit)
        }
    }

    private static let bars: [(height: CGFloat, x: CGFloat, y: CGFloat)] = [
        (height: 5, x: 2, y: 9),
        (height: 8, x: 6.5, y: 6),
        (height: 11, x: 11, y: 3),
    ]
}

#Preview("Priority icons") {
    HStack(spacing: 16) {
        ForEach([TaskPriority.none, .low, .medium, .high, .urgent], id: \.self) { priority in
            TaskPriorityIcon(priority: priority, size: 24)
        }
    }
    .padding(40)
}
