import GrottoModels
import SwiftUI

/// The whole of one Agent proposal, opened from its transcript card.
///
/// The card is a summary — two lines of description and one control — so the
/// record it summarizes has to be reachable. It arrives as a sheet rather than
/// growing in place: a card that expands under the finger pushes the rest of
/// the transcript around it, and every other detail on this phone is a sheet
/// already.
///
/// It carries the same single action the card does, so a human who opened the
/// proposal to read it does not have to dismiss to act on it. Choosing
/// `Create Agent` hands the proposal back to the host, which dismisses this
/// sheet and presents the creation form from its dismissal — the two are
/// mutually exclusive presentations, exactly as Chat details and Settings are.
public struct PreparedActionDetailView: View {
    private let action: PreparedCreateAgentActionPresentation
    private let canManage: Bool
    private let onCreateAgent: (PreparedCreateAgentActionPresentation) -> Void
    private let onOpenAgent: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var detent = PresentationDetent.medium

    public init(
        action: PreparedCreateAgentActionPresentation,
        canManage: Bool,
        onCreateAgent: @escaping (PreparedCreateAgentActionPresentation) -> Void = { _ in },
        onOpenAgent: @escaping (String) -> Void = { _ in }
    ) {
        self.action = action
        self.canManage = canManage
        self.onCreateAgent = onCreateAgent
        self.onOpenAgent = onOpenAgent
    }

    public var body: some View {
        let detail = PreparedActionDetail.resolve(action, canManage: canManage)

        NavigationStack {
            List {
                Section {
                    hero(detail)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())

                if let description = detail.description {
                    Section("Description") {
                        Text(description)
                            .textSelection(.enabled)
                            .accessibilityIdentifier("prepared-action-detail-description")
                    }
                }

                if detail.runsOn != nil || detail.note != nil {
                    Section {
                        if let runsOn = detail.runsOn {
                            LabeledContent("Runs on", value: runsOn)
                        }
                        if let note = detail.note {
                            Text(note)
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                        }
                    }
                }

                if let receipt = detail.receipt {
                    Section {
                        Text(receipt)
                            .foregroundStyle(.secondary)
                    }
                }
            }
#if os(iOS)
            .listStyle(.insetGrouped)
#else
            .listStyle(.inset)
#endif
            .navigationTitle(PreparedActionDetail.title)
            .grottoInlineNavigationTitle()
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) { footer(detail) }
        }
        .presentationDetents([.medium, .large], selection: $detent)
        .presentationDragIndicator(.visible)
        .presentationBackground(GrottoPlatformColor.groupedBackground)
    }

    /// The proposed Agent at the size a profile shows one, so the face the
    /// human is deciding about is the first thing on the sheet.
    private func hero(_ detail: PreparedActionDetail) -> some View {
        VStack(spacing: 12) {
            AvatarView(name: detail.name, url: detail.avatarURL, size: 64)

            VStack(spacing: 6) {
                Text(detail.name)
                    .font(.title2.weight(.semibold))
                if let status = detail.status {
                    ActionCardStatusCapsule(status: status)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 12)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
    }

    /// The card's one control, kept on the sheet so reading the proposal and
    /// acting on it are the same visit. Like the app's composer over the
    /// timeline (`ComposerGlassSurface`, floated by `ChatScreenView`), it
    /// simply floats over the scrolling content at either detent — no
    /// hairline, no distinct background section, just the button and the
    /// list passing beneath it. The deployment target here is iOS 18, below
    /// the glass-effect minimum the composer itself only reaches behind an
    /// `#available(iOS 26, *)` check, so this control stays the plain
    /// fallback rather than reimplementing that split for one button.
    @ViewBuilder
    private func footer(_ detail: PreparedActionDetail) -> some View {
        switch detail.action {
        case .createAgent:
            footerButton {
                Button { onCreateAgent(action) } label: { footerLabel("Create Agent") }
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("prepared-action-detail-create-agent")
            }
        case let .openAgent(agentID):
            footerButton {
                Button {
                    dismiss()
                    onOpenAgent(agentID)
                } label: {
                    footerLabel("Open")
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("prepared-action-detail-open-agent")
            }
        case .none:
            EmptyView()
        }
    }

    private func footerLabel(_ title: String) -> some View {
        Text(title).frame(maxWidth: .infinity)
    }

    private func footerButton(@ViewBuilder content: () -> some View) -> some View {
        content()
            .controlSize(.large)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
    }
}

/// What the detail sheet shows, resolved once so the sheet and the card it
/// opened from cannot disagree about which single action a proposal offers.
struct PreparedActionDetail: Equatable {
    /// The card summarizes; the sheet is the record. Both offer the same one
    /// thing, and which one it is comes from the proposal's own state.
    enum Action: Equatable {
        case createAgent
        case openAgent(id: String)
        case none
    }

    static let title = "Agent proposal"

    let action: Action
    let avatarURL: URL?
    let description: String?
    let name: String
    let note: String?
    let receipt: String?
    let runsOn: String?
    let status: ActionCardStatus?

    /// A created Agent is a place to go, whoever is looking. A proposal still
    /// waiting is work only a human who can commit it is offered.
    static func resolve(
        _ action: PreparedCreateAgentActionPresentation,
        canManage: Bool
    ) -> PreparedActionDetail {
        PreparedActionDetail(
            action: resolveAction(action, canManage: canManage),
            avatarURL: action.avatarURL,
            description: action.description.nonEmpty,
            name: action.name,
            note: action.draftHint.nonEmpty,
            receipt: action.receipt,
            runsOn: action.computerDetail.nonEmpty,
            status: action.status == .executed ? .created : nil
        )
    }

    private static func resolveAction(
        _ action: PreparedCreateAgentActionPresentation,
        canManage: Bool
    ) -> Action {
        if let agentID = action.createdAgentID { return .openAgent(id: agentID) }
        guard action.status == .pending, canManage else { return .none }
        return .createAgent
    }
}

extension PreparedCreateAgentActionPresentation {
    /// Who committed the proposal and when. Only an executed action has one.
    var receipt: String? {
        guard let executedByDisplayName, let executedAt else { return nil }
        return "Created by \(executedByDisplayName) · \(executedAt.formatted(.dateTime.hour().minute()))"
    }
}

private extension Optional where Wrapped == String {
    /// An absent value and an empty one say the same nothing, so the sheet
    /// omits the row for both rather than drawing an empty one.
    var nonEmpty: String? {
        guard let value = self, !value.isEmpty else { return nil }
        return value
    }
}

#Preview("Pending proposal") {
    Color.clear.sheet(isPresented: .constant(true)) {
        PreparedActionDetailView(
            action: ChatFixtures.pendingAgentProposal,
            canManage: true
        )
    }
}

#Preview("Created Agent") {
    Color.clear.sheet(isPresented: .constant(true)) {
        PreparedActionDetailView(
            action: ChatFixtures.executedAgentProposal,
            canManage: true
        )
    }
}
