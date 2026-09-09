import SwiftUI
import GrottoModels

struct CloudAgentCard: View {
    let agent: CloudAgentPresentation
    var onCancel: ((String) async throws -> Void)?
    @State private var confirmingCancel = false
    @State private var cancelling = false
    @State private var cancelError: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                CloudAgentMark()
                VStack(alignment: .leading, spacing: 3) {
                    Text(agent.work.title).font(.subheadline.weight(.semibold))
                    Text(agent.work.repository).font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                TimelineView(.animation(minimumInterval: 1, paused: !agent.work.status.isActive)) { context in
                    CloudAgentCardStatusCapsule(status: CloudAgentCardStatus(
                        label: agent.statusText(at: context.date), tint: statusColor
                    ))
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                if agent.branches.isEmpty, let ref = agent.work.startingRef {
                    Label("from \(ref)", systemImage: "arrow.triangle.branch")
                }
                ForEach(Array(agent.branches.enumerated()), id: \.offset) { _, branch in
                    branchDetails(branch)
                }
                if agent.work.status.isActive, let activity = agent.work.activity {
                    Text(activity.summary)
                }
                TimelineView(.animation(minimumInterval: 60, paused: !agent.work.status.isActive)) { context in
                    if agent.isStale(at: context.date) {
                        Text("Last update \(agent.work.updatedAt.formatted(.relative(presentation: .named)))")
                    }
                }
                if agent.work.status == .failed, let summary = agent.work.runs.first?.summary {
                    Text(summary).foregroundStyle(.red)
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .bottom) {
                    actions
                    Spacer(minLength: 10)
                    receipt
                }
                VStack(alignment: .leading, spacing: 8) {
                    actions
                    receipt
                }
            }
        }
        .padding(CloudAgentCardMetrics.padding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(GrottoPlatformColor.inputSurface, in: .rect(cornerRadius: CloudAgentCardMetrics.cornerRadius))
        .overlay {
            RoundedRectangle(cornerRadius: CloudAgentCardMetrics.cornerRadius)
                .strokeBorder(.secondary.opacity(0.18), lineWidth: 0.5)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("cloud-agent-card-\(agent.id)")
        .confirmationDialog("Cancel this cloud agent run?", isPresented: $confirmingCancel) {
            Button("Cancel run", role: .destructive) {
                Task {
                    cancelling = true
                    defer { cancelling = false }
                    do { try await onCancel?(agent.id) }
                    catch { cancelError = "Could not cancel this run. Try again." }
                }
            }
        }
        .alert("Cloud agent", isPresented: Binding(
            get: { cancelError != nil }, set: { if !$0 { cancelError = nil } }
        )) {
            Button("OK", role: .cancel) { cancelError = nil }
        } message: { Text(cancelError ?? "") }
    }

    private var statusColor: Color {
        switch agent.work.status {
        case .completed: .green
        case .failed, .expired: .red
        case .queued, .running: .blue
        case .cancelled: .secondary
        }
    }

    @ViewBuilder
    private func branchDetails(_ branch: CloudAgentBranch) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            Image(systemName: "arrow.triangle.branch")
            Text(branch.branch).lineLimit(1).truncationMode(.middle)
            if let pr = branch.pullRequest, let url = CloudAgentPresentation.externalURL(branch.pullRequestUrl) {
                Link("PR #\(pr.number)", destination: url).buttonStyle(.borderless)
            }
        }
        if let pr = branch.pullRequest {
            HStack(spacing: 4) {
                Text("\(pr.changedFiles) \(pr.changedFiles == 1 ? "file" : "files") changed")
                Text("+\(pr.additions)").foregroundStyle(.green)
                Text("−\(pr.deletions)").foregroundStyle(.red)
            }
        }
    }

    @ViewBuilder private var actions: some View {
        HStack(spacing: 6) {
            if let pr = agent.branches.first(where: { CloudAgentPresentation.externalURL($0.pullRequestUrl) != nil }),
               let url = CloudAgentPresentation.externalURL(pr.pullRequestUrl) {
                Link("View PR", destination: url).buttonStyle(.bordered)
            }
            if agent.branches.allSatisfy({ CloudAgentPresentation.externalURL($0.pullRequestUrl) == nil }),
               let url = CloudAgentPresentation.externalURL(agent.work.providerUrl) {
                Link("Open in \(agent.providerName)", destination: url).buttonStyle(.bordered)
            }
            if CloudAgentPresentation.externalURL(agent.work.providerUrl) != nil || canCancel {
                Menu {
                    if let url = CloudAgentPresentation.externalURL(agent.work.providerUrl) {
                        Link("Open in \(agent.providerName)", destination: url)
                    }
                    if canCancel {
                        Button("Cancel run", role: .destructive) { confirmingCancel = true }
                            .disabled(cancelling)
                    }
                } label: {
                    Image(systemName: "chevron.down")
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Cloud agent actions")
            }
        }
        .font(.caption.weight(.medium))
    }

    private var receipt: some View {
        Text("Delegated by \(agent.delegatedBy) · \(agent.work.createdAt.formatted(date: .omitted, time: .shortened))")
            .font(.caption2)
            .foregroundStyle(.secondary)
    }

    private var canCancel: Bool {
        onCancel != nil && agent.work.status.isActive && agent.work.cancelRequestedAt == nil
    }
}

/// The card's box: the inset its contents sit in and the corner that inset is
/// cut with, kept together so the two stay in step when either moves.
enum CloudAgentCardMetrics {
    static let padding: CGFloat = 12
    static let cornerRadius: CGFloat = 13
}

/// A finished-state fact about the run, drawn as a soft capsule. Work still
/// running carries a live one; work still waiting on a human carries none.
struct CloudAgentCardStatus: Equatable {
    let label: String
    let tint: Color
}

/// A finished-state fact, drawn the same size wherever it appears.
struct CloudAgentCardStatusCapsule: View {
    let status: CloudAgentCardStatus

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
