import SwiftUI

/// The transcript card for a prepared action — an Agent proposal today, a
/// background cloud run or a pull request next.
///
/// It is an object that arrived in the chat, so it reads like the other objects
/// that do: the attachment row and the Thread preview. One inset surface with
/// the message column's measure, a header of mark plus title/description — the
/// title carries a status capsule at its right end, when the kind has one — and
/// a bottom row of controls with the finished action's receipt at its right.
///
/// A part with nothing to say is left out rather than drawn empty, so the card
/// never spends a row on absence: no status while an action is still an ask, no
/// bottom row for a viewer who cannot act on it.
///
/// The card is a summary, so it is the way to the full record: a kind that has
/// one supplies `tap` and the card's whole reading band — mark, title,
/// description, and the space around them — becomes one button. The controls in
/// `actions` keep their own band and their own targets, so the two never
/// compete for a touch and both stay separate elements to VoiceOver. A kind
/// with nothing more to show leaves `tap` nil and the card is inert, as it was.
///
/// A pull request would compose the same parts without touching this file:
///
/// ```swift
/// ActionCardView(
///     title: "Restore avatar image generation",
///     description: "zknicker/grotto · codex/avatar-fix",
///     status: ActionCardStatus(label: "Open", tint: .green),
///     actions: [ActionCardAction(id: "view", title: "View PR") { open(pr) }],
///     receipt: "Opened by Blippy · 3:10 PM",
///     accessibilityIdentifier: "action-card-pull-request",
///     tap: ActionCardTap(
///         accessibilityIdentifier: "action-card-pull-request-details",
///         accessibilityLabel: "Pull request, open. Show details",
///         handler: { showDetails(pr) }
///     )
/// ) {
///     ActionCardGlyphMark(icon: .terminal)
/// }
/// ```
struct ActionCardView<Mark: View>: View {
    let title: String
    var description: String?
    var status: ActionCardStatus?
    var actions: [ActionCardAction] = []
    var receipt: String?
    var accessibilityIdentifier: String?
    var accessibilityLabel: String?
    var tap: ActionCardTap?
    @ViewBuilder let mark: () -> Mark

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            readingBand
            if hasBottomRow {
                bottomRow
                    .padding(.horizontal, ActionCardMetrics.padding)
                    .padding(.bottom, ActionCardMetrics.padding)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            GrottoPlatformColor.inputSurface,
            in: .rect(cornerRadius: ActionCardMetrics.cornerRadius)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(accessibilityIdentifier ?? "")
        .accessibilityLabel(accessibilityLabel ?? title)
    }

    /// Everything the card says, and the padding around it, as one target.
    ///
    /// The band is a real `Button`, not a layer behind the whole card: SwiftUI
    /// does not hit-test a `.background`, so a button drawn there is pressable
    /// only in theory — verified in Simulator, where the card swallowed every
    /// tap while its own controls answered normally. Wrapping the entire card
    /// in one button instead would fold the controls into its label, where they
    /// stop being separate elements to VoiceOver. The band takes the gap below
    /// it too, so the only part of the card that is not this target is the row
    /// of controls that has its own.
    @ViewBuilder
    private var readingBand: some View {
        if let tap {
            Button(action: tap.handler) { headerBand }
                .buttonStyle(.pressableRow(cornerRadius: ActionCardMetrics.cornerRadius))
                .accessibilityIdentifier(tap.accessibilityIdentifier)
                .accessibilityLabel(tap.accessibilityLabel)
        } else {
            headerBand
        }
    }

    private var headerBand: some View {
        header
            .padding(.horizontal, ActionCardMetrics.padding)
            .padding(.top, ActionCardMetrics.padding)
            .padding(
                .bottom,
                hasBottomRow ? ActionCardMetrics.bandSpacing : ActionCardMetrics.padding
            )
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
    }

    /// Mark, then a two-line stack. Top-aligned because the mark is taller than
    /// the lines beside it, so a two-line stack does not drag the mark down to
    /// its own midpoint.
    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            mark()
            VStack(alignment: .leading, spacing: 1) {
                titleLine
                if let description {
                    // The description is the part of a proposal worth reading,
                    // so it gets two lines and wraps into them; the tail
                    // ellipsis is the promise that the rest is one tap away.
                    Text(description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .truncationMode(.tail)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// A status is a fact about the object, so it reads with the name rather
    /// than pinned to the card's top corner: it sits at the right end of the
    /// name line, centered on that text, the card's own padding away from the
    /// edge.
    private var titleLine: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(.body.weight(.semibold))
                .lineLimit(1)
            if let status {
                Spacer(minLength: 8)
                ActionCardStatusCapsule(status: status)
            }
        }
    }

    /// Controls at the left, the finished action's receipt flush right. A phone
    /// column is narrower than the receipt and the buttons together more often
    /// than not, and a receipt that ends in an ellipsis has lost the half that
    /// matters — the time — so the row drops the receipt to its own line rather
    /// than truncating it.
    private var bottomRow: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 10) {
                buttons
                if receipt != nil {
                    Spacer(minLength: 12)
                    receiptText
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) { buttons }
                receiptText
            }
        }
    }

    private var buttons: some View {
        ForEach(actions) { action in
            ActionCardButton(action: action)
        }
    }

    @ViewBuilder
    private var receiptText: some View {
        if let receipt {
            Text(receipt)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var hasBottomRow: Bool {
        !actions.isEmpty || receipt != nil
    }
}

/// The card's shared geometry, so a second kind lands on the same rhythm.
enum ActionCardMetrics {
    static let padding: CGFloat = 12
    /// The gap between the header and the controls under it — doubled from the
    /// header's own line rhythm so the buttons read as their own band rather
    /// than a third text line.
    static let bandSpacing: CGFloat = 16
    static let cornerRadius: CGFloat = 13
    /// The identity box: an avatar, or a glyph mark standing in for a kind with
    /// no face of its own.
    static let markSize: CGFloat = 48
}

/// Opening the card itself. A summary card leads to the full record, and the
/// whole surface is how a human asks for it — the controls in the bottom row
/// stay separate targets doing separate work.
struct ActionCardTap {
    let accessibilityIdentifier: String
    let accessibilityLabel: String
    let handler: () -> Void
}

/// A finished-state fact about the object, drawn as a soft capsule. An action
/// still waiting on a human carries none — the ask is the card's existence.
struct ActionCardStatus: Equatable {
    let label: String
    let tint: Color

    static let created = ActionCardStatus(label: "Created", tint: .green)
}

/// One real control in the card's bottom row.
struct ActionCardAction: Identifiable {
    enum Prominence {
        /// Work the human owes: the filled button.
        case prominent
        /// A place to go: the bordered button.
        case bordered
    }

    let id: String
    let title: String
    var prominence: Prominence = .bordered
    var accessibilityIdentifier: String?
    let handler: () -> Void
}

/// A finished-state fact, drawn the same size wherever it appears — the card's
/// name line and the detail sheet's hero.
struct ActionCardStatusCapsule: View {
    let status: ActionCardStatus

    var body: some View {
        Text(status.label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(status.tint)
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(status.tint.opacity(0.14), in: .capsule)
            .fixedSize()
    }
}

private struct ActionCardButton: View {
    let action: ActionCardAction

    var body: some View {
        Group {
            switch action.prominence {
            case .prominent:
                Button(action.title, action: action.handler)
                    .buttonStyle(.borderedProminent)
            case .bordered:
                Button(action.title, action: action.handler)
                    .buttonStyle(.bordered)
            }
        }
        .controlSize(.small)
        .accessibilityIdentifier(action.accessibilityIdentifier ?? "")
    }
}

/// The leading mark for a kind with no face of its own. Same box and shape as
/// the avatar that stands there in another card, so the family keeps one left
/// edge.
struct ActionCardGlyphMark: View {
    let icon: GrottoIconName

    var body: some View {
        Circle()
            .fill(Color.secondary.opacity(0.12))
            .frame(width: ActionCardMetrics.markSize, height: ActionCardMetrics.markSize)
            .overlay {
                GrottoIcon(icon, size: 20)
                    .foregroundStyle(.secondary)
            }
    }
}
