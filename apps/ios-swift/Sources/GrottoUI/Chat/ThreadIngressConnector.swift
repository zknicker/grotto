import SwiftUI

struct ThreadIngressAnchor: PreferenceKey {
    static let defaultValue: Anchor<CGRect>? = nil
    static func reduce(value: inout Anchor<CGRect>?, nextValue: () -> Anchor<CGRect>?) {
        value = nextValue() ?? value
    }
}

struct ThreadIngressConnector: View {
    let anchor: Anchor<CGRect>?
    let isContinuation: Bool

    var body: some View {
        GeometryReader { geometry in
            if let anchor {
                let target = geometry[anchor]
                let endY = target.minY + 21
                Path { path in
                    path.move(to: CGPoint(x: 19, y: min(isContinuation ? 0 : 44, endY - 8)))
                    path.addLine(to: CGPoint(x: 19, y: endY - 8))
                    path.addQuadCurve(to: CGPoint(x: 27, y: endY), control: CGPoint(x: 19, y: endY))
                    path.addLine(to: CGPoint(x: target.minX - 6, y: endY))
                }
                .stroke(.tertiary, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
