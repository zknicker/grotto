import Foundation
import GrottoModels

/// One Agent-creation proposal as the transcript draws it.
///
/// Identity is the created Agent's once it exists and the proposal's until then,
/// resolved by the adapter that reads the Server record — the card renders what
/// it is handed rather than deciding which of the two to believe.
public struct PreparedCreateAgentActionPresentation: Identifiable, Hashable, Sendable {
    public let avatarURL: URL?
    public let chatID: String
    public let computerDetail: String?
    /// The Agent this proposal created, and the profile its `Open` button
    /// reaches. Absent until the action is executed.
    public let createdAgentID: String?
    public let createdAt: Date
    public let description: String?
    public let draftHint: String?
    public let executedAt: Date?
    public let executedByDisplayName: String?
    public let id: String
    public let name: String
    public let proposedComputerID: String?
    public let requiredComputerID: String?
    public let status: PreparedActionStatus

    public init(
        avatarURL: URL?,
        chatID: String,
        computerDetail: String?,
        createdAgentID: String? = nil,
        createdAt: Date,
        description: String?,
        draftHint: String?,
        executedAt: Date? = nil,
        executedByDisplayName: String?,
        id: String,
        name: String,
        proposedComputerID: String?,
        requiredComputerID: String?,
        status: PreparedActionStatus
    ) {
        self.avatarURL = avatarURL
        self.chatID = chatID
        self.computerDetail = computerDetail
        self.createdAgentID = createdAgentID
        self.createdAt = createdAt
        self.description = description
        self.draftHint = draftHint
        self.executedAt = executedAt
        self.executedByDisplayName = executedByDisplayName
        self.id = id
        self.name = name
        self.proposedComputerID = proposedComputerID
        self.requiredComputerID = requiredComputerID
        self.status = status
    }
}

public struct UnsupportedPreparedActionPresentation: Identifiable, Hashable, Sendable {
    public let createdAt: Date
    public let id: String
    public let kind: String
    public let status: PreparedActionStatus

    public init(createdAt: Date, id: String, kind: String, status: PreparedActionStatus) {
        self.createdAt = createdAt
        self.id = id
        self.kind = kind
        self.status = status
    }
}

public enum PreparedActionPresentation: Identifiable, Hashable, Sendable {
    case createAgent(PreparedCreateAgentActionPresentation)
    case unsupported(UnsupportedPreparedActionPresentation)

    public var id: String {
        switch self {
        case let .createAgent(action): action.id
        case let .unsupported(action): action.id
        }
    }

    public var status: PreparedActionStatus {
        switch self {
        case let .createAgent(action): action.status
        case let .unsupported(action): action.status
        }
    }

    /// Whether a superseded action leaves the transcript.
    ///
    /// Only an `agent.create` proposal is replaced by a newer one, and its row
    /// keeps the proposal's note, so the card can collapse out and leave text
    /// behind. An unsupported kind has no successor and its row says nothing
    /// else, so it stays drawn at any status rather than collapsing to nothing.
    public var leavesWhenSuperseded: Bool {
        switch self {
        case .createAgent: true
        case .unsupported: false
        }
    }

    /// What the anchor message actually said.
    ///
    /// The Server stores an empty body for a prepared-action anchor, so the
    /// proposal's note to the human is the message text. A superseded proposal
    /// leaves no card behind, so its row falls back to a short note rather than
    /// going bodiless.
    public var messageText: String {
        guard case let .createAgent(action) = self else { return "" }
        if let draftHint = action.draftHint, !draftHint.isEmpty { return draftHint }
        return action.status == .superseded ? "Earlier proposal, replaced." : ""
    }
}

public struct PreparedAgentComputer: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String
    public let runtimes: [PreparedAgentRuntime]

    public init(id: String, label: String, runtimes: [PreparedAgentRuntime]) {
        self.id = id
        self.label = label
        self.runtimes = runtimes
    }
}

public struct PreparedAgentRuntime: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String
    public let models: [PreparedAgentModel]

    public init(id: String, label: String, models: [PreparedAgentModel]) {
        self.id = id
        self.label = label
        self.models = models
    }
}

public struct PreparedAgentModel: Identifiable, Hashable, Sendable {
    public let id: String
    public let label: String

    public init(id: String, label: String) {
        self.id = id
        self.label = label
    }
}

public struct PreparedAgentDefaults: Equatable, Sendable {
    public let computerID: String
    public let modelID: String
    public let reasoningEffort: AgentReasoningEffort
    public let runtimeID: String

    public init(
        computerID: String,
        modelID: String,
        reasoningEffort: AgentReasoningEffort,
        runtimeID: String
    ) {
        self.computerID = computerID
        self.modelID = modelID
        self.reasoningEffort = reasoningEffort
        self.runtimeID = runtimeID
    }
}

public struct PreparedAgentCreationConfiguration {
    public let canManage: Bool
    public let computers: [PreparedAgentComputer]
    public let coveDefaults: PreparedAgentDefaults?
    public let existingHandles: [String]
    public let onCommit: @MainActor (PreparedCreateAgentActionPresentation, PreparedAgentCreateDraft) async throws -> Void

    public init(
        canManage: Bool,
        computers: [PreparedAgentComputer],
        coveDefaults: PreparedAgentDefaults?,
        existingHandles: [String],
        onCommit: @escaping @MainActor (PreparedCreateAgentActionPresentation, PreparedAgentCreateDraft) async throws -> Void
    ) {
        self.canManage = canManage
        self.computers = computers
        self.coveDefaults = coveDefaults
        self.existingHandles = existingHandles
        self.onCommit = onCommit
    }
}

public struct PreparedAgentCreateDraft: Sendable {
    public let avatar: AvatarImagePayload?
    public let computerID: String
    public let description: String?
    public let displayName: String
    public let handle: String
    public let modelID: String
    public let reasoningEffort: AgentReasoningEffort
    public let runtimeID: String

    public init(
        avatar: AvatarImagePayload?,
        computerID: String,
        description: String?,
        displayName: String,
        handle: String,
        modelID: String,
        reasoningEffort: AgentReasoningEffort,
        runtimeID: String
    ) {
        self.avatar = avatar
        self.computerID = computerID
        self.description = description
        self.displayName = displayName
        self.handle = handle
        self.modelID = modelID
        self.reasoningEffort = reasoningEffort
        self.runtimeID = runtimeID
    }
}

public enum PreparedAgentCreationDefaults {
    public static func resolve(
        proposedComputerID: String?,
        requiredComputerID: String? = nil,
        computers: [PreparedAgentComputer],
        cove: PreparedAgentDefaults?
    ) -> PreparedAgentDefaults? {
        let preferredComputerID = proposedComputerID ?? cove?.computerID
        let computer = requiredComputerID.flatMap { requiredID in
            computers.first { $0.id == requiredID }
        } ?? (requiredComputerID == nil
            ? computers.first(where: { $0.id == preferredComputerID }) ?? computers.first
            : nil)
        guard let computer,
              let runtime = computer.runtimes.first(where: { $0.id == cove?.runtimeID }) ?? computer.runtimes.first,
              let model = runtime.models.first(where: { $0.id == cove?.modelID }) ?? runtime.models.first
        else { return nil }

        return PreparedAgentDefaults(
            computerID: computer.id,
            modelID: model.id,
            reasoningEffort: cove?.reasoningEffort ?? .medium,
            runtimeID: runtime.id
        )
    }
}

public enum PreparedAgentHandle {
    public static func create(name: String, existingHandles: [String]) -> String {
        let folded = name.folding(options: [.diacriticInsensitive, .widthInsensitive], locale: .current)
        let normalized = folded.lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let clipped = String(normalized.prefix(31))
        let base = clipped.isEmpty ? "agent" : clipped.count == 1 ? "\(clipped)-agent" : clipped
        let taken = Set(existingHandles + ["cove"])
        guard taken.contains(base) else { return base }

        for suffix in 2..<10_000 {
            let suffixText = "-\(suffix)"
            let candidate = String(base.prefix(31 - suffixText.count)) + suffixText
            if !taken.contains(candidate) { return candidate }
        }
        return "agent-\(existingHandles.count + 1)"
    }
}
