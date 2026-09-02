import GrottoModels
import SwiftUI

/// One prepared action under the Agent's note, drawn as its own block.
///
/// The Agent's note is the message body above this card, so the card never
/// repeats it: it carries the proposed Agent's face and name, the first two
/// lines of what that Agent would be, and the one thing the human can do about
/// it. A pending proposal is the ask, so it shows no status and no receipt; an
/// executed one names the created Agent and who committed it. A superseded
/// `agent.create` proposal leaves no card at all; an unsupported kind keeps its
/// card whatever its status, because the row has nothing else to say.
///
/// The card is a summary and the rest is one tap away: pressing it anywhere
/// outside the controls opens the proposal's detail sheet.
struct PreparedActionCardView: View {
    let action: PreparedActionPresentation
    let canManage: Bool
    let onReviewCreateAgent: (PreparedCreateAgentActionPresentation) -> Void
    /// Opens the whole proposal on its own sheet. A host that presents no
    /// detail surface leaves the card inert, as it was before it had one.
    var onShowDetails: (PreparedCreateAgentActionPresentation) -> Void = { _ in }
    /// Opens the created Agent's Chat, which is where the phone shows an Agent
    /// profile. A host with no Agent route leaves the default in place.
    var onOpenAgent: (String) -> Void = { _ in }

    /// The last shape this action had while it was still live, so the collapse
    /// takes real content out rather than the empty superseded render. Its
    /// presence is also the memory of ever having been on screen: a proposal
    /// that arrives already superseded never captures one, and so never
    /// animates.
    @State private var lastLive: PreparedActionPresentation?
    @State private var hidden = false

    var body: some View {
        Group {
            switch visibility {
            case .hidden:
                EmptyView()
            case .live:
                card(action)
            case .exiting:
                ActionCardExitView(onExited: { hidden = true }) {
                    card(lastLive ?? action)
                }
            }
        }
        .onAppear { captureLive() }
        .onChange(of: action) { _, _ in captureLive() }
    }

    private var visibility: ActionCardVisibility {
        ActionCardVisibility.resolve(
            hidden: hidden,
            superseded: action.status == .superseded && action.leavesWhenSuperseded,
            wasVisible: lastLive != nil
        )
    }

    private func captureLive() {
        guard action.status != .superseded || !action.leavesWhenSuperseded else { return }
        lastLive = action
    }

    @ViewBuilder
    private func card(_ action: PreparedActionPresentation) -> some View {
        switch action {
        case let .createAgent(action):
            createAgentCard(action)
        case let .unsupported(action):
            unsupportedCard(action)
        }
    }

    private func createAgentCard(_ action: PreparedCreateAgentActionPresentation) -> some View {
        ActionCardView(
            title: action.name,
            description: action.description,
            status: action.status == .executed ? .created : nil,
            actions: createAgentActions(action),
            receipt: action.receipt,
            accessibilityIdentifier: cardIdentifier(action.status),
            accessibilityLabel: action.accessibilityLabel,
            tap: ActionCardTap(
                accessibilityIdentifier: "prepared-action-card-details",
                accessibilityLabel: action.detailsAccessibilityLabel,
                handler: { onShowDetails(action) }
            )
        ) {
            AvatarView(
                name: action.name,
                url: action.avatarURL,
                size: ActionCardMetrics.markSize
            )
        }
    }

    /// A pending proposal is work the human owes; a created Agent is a place to
    /// go. A viewer who cannot commit, or a proposal with neither, gets no
    /// bottom row at all. The detail sheet resolves the same one action, so the
    /// card and the sheet it opens never offer different things.
    private func createAgentActions(
        _ action: PreparedCreateAgentActionPresentation
    ) -> [ActionCardAction] {
        switch PreparedActionDetail.resolve(action, canManage: canManage).action {
        case let .openAgent(agentID):
            return [
                ActionCardAction(
                    id: "open",
                    title: "Open",
                    accessibilityIdentifier: "prepared-action-open-agent"
                ) {
                    onOpenAgent(agentID)
                }
            ]
        case .createAgent:
            return [
                ActionCardAction(
                    id: "create-agent",
                    title: "Create Agent",
                    prominence: .prominent,
                    accessibilityIdentifier: "prepared-action-create-agent"
                ) {
                    onReviewCreateAgent(action)
                }
            ]
        case .none:
            return []
        }
    }

    private func unsupportedCard(
        _ action: UnsupportedPreparedActionPresentation
    ) -> some View {
        ActionCardView(
            title: action.kind,
            description: "Unsupported action · Not available in this version of Grotto",
            accessibilityIdentifier: cardIdentifier(action.status),
            accessibilityLabel: "Unsupported action \(action.kind)"
        ) {
            ActionCardGlyphMark(icon: .alert)
        }
    }

    private func cardIdentifier(_ status: PreparedActionStatus) -> String {
        "prepared-action-card-\(status.rawValue)"
    }
}

private extension PreparedCreateAgentActionPresentation {
    var accessibilityLabel: String {
        status == .executed
            ? "Agent proposal for \(name) · Created"
            : "Agent proposal for \(name)"
    }

    /// What pressing the card itself does, named as the destination rather than
    /// the surface: the card is a summary and this is the way to the rest.
    var detailsAccessibilityLabel: String {
        "Agent proposal for \(name), \(status.rawValue). Show details"
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 16) {
        PreparedActionCardView(
            action: .createAgent(ChatFixtures.pendingAgentProposal),
            canManage: true,
            onReviewCreateAgent: { _ in }
        )
        PreparedActionCardView(
            action: .createAgent(ChatFixtures.executedAgentProposal),
            canManage: true,
            onReviewCreateAgent: { _ in }
        )
    }
    .padding(20)
}
