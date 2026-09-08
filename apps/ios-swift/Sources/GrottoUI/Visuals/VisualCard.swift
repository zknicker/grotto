import SwiftUI

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// One ```visual fence, rendered inline under the message that wrote it.
///
/// The shell is the transcript's own card idiom — the action card's radius, a
/// hairline border, a system surface — and everything inside it is the web
/// card's: no title bar (the title is accessibility only), no padding of its
/// own (the frame body carries 16px), and the same fallback / clamp /
/// collapse-past-420 behaviour. Height is not the card's to keep; see
/// `VisualHeightRegistry` for why the screen holds it.
struct VisualCard: View {
    let visual: VisualSegment
    let key: VisualKey
    let heights: VisualHeightRegistry

    @Environment(\.colorScheme) private var colorScheme
    /// The card's text tracks the transcript's: a Dynamic Type change rebuilds
    /// the document, and the frame reloads at the new size.
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    /// A card animates height changes but not its first measurement: the open
    /// from the reserved 240 is a layout fact, not a transition.
    @State private var hasSettled = false

    var body: some View {
        let measured = heights.height(key) ?? VisualHeights.fallback
        let collapsible = measured > VisualHeights.collapsed
        let isExpanded = heights.isExpanded(key)
        let height = VisualHeights.clamp(
            collapsible && !isExpanded ? VisualHeights.collapsed : measured
        )

        VStack(spacing: 0) {
            frame(height: height, isFaded: collapsible && !isExpanded)
            if collapsible {
                footer(isExpanded: isExpanded)
            }
        }
        .frame(maxWidth: VisualCardMetrics.maxWidth, alignment: .leading)
        .background(VisualCardMetrics.surface, in: VisualCardMetrics.shape)
        .overlay {
            VisualCardMetrics.shape.strokeBorder(.secondary.opacity(0.18), lineWidth: 0.5)
        }
        .clipShape(VisualCardMetrics.shape)
        .onChange(of: measured) { hasSettled = true }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(VisualFence.fallbackText(html: visual.html, title: visual.title))
    }

    @ViewBuilder
    private func frame(height: CGFloat, isFaded: Bool) -> some View {
        ZStack(alignment: .bottom) {
            content
                .frame(height: height)
                .animation(hasSettled ? .easeOut(duration: 0.2) : nil, value: height)
            if isFaded {
                LinearGradient(
                    colors: [VisualCardMetrics.surface.opacity(0), VisualCardMetrics.surface],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: VisualCardMetrics.fadeHeight)
                .allowsHitTesting(false)
            }
        }
        .frame(height: height)
        .clipped()
    }

    @ViewBuilder
    private var content: some View {
        #if canImport(UIKit)
        VisualWebView(
            document: VisualSandboxDocument.make(
                html: visual.html,
                scheme: tokenScheme,
                typography: VisualTypography.resolved(for: dynamicTypeSize)
            )
        ) { reported in
            heights.report(reported, for: key)
        }
        #else
        // macOS exists in this package only so the pure logic can run under
        // `swift test`; the app targets iOS.
        Color.clear
        #endif
    }

    private func footer(isExpanded: Bool) -> some View {
        Button {
            heights.toggleExpanded(key)
        } label: {
            Text(isExpanded ? "Show less" : "Show all")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(.secondary.opacity(0.18))
                .frame(height: 0.5)
        }
    }

    private var tokenScheme: AgentHtmlColorScheme {
        colorScheme == .light ? .light : .dark
    }
}

enum VisualCardMetrics {
    /// The web card's content ceiling (46rem), so a wide layout reads the same.
    static let maxWidth: CGFloat = 736
    static let fadeHeight: CGFloat = 64

    static var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ActionCardMetrics.cornerRadius, style: .continuous)
    }

    /// Opaque on purpose: the collapse fade has to land on a real color, and a
    /// translucent fill would leave the gradient reading against the transcript
    /// instead of against the card.
    static var surface: Color {
        #if canImport(UIKit)
        Color(uiColor: .secondarySystemBackground)
        #else
        Color(nsColor: .controlBackgroundColor)
        #endif
    }
}
