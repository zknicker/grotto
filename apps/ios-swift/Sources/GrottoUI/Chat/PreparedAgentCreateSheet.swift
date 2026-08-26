import GrottoModels
import SwiftUI
#if os(iOS)
import UIKit
#endif

public struct PreparedAgentCreateSheet: View {
    private let action: PreparedCreateAgentActionPresentation
    private let configuration: PreparedAgentCreationConfiguration

    @Environment(\.dismiss) private var dismiss
    @State private var avatar: AvatarImagePayload?
    @State private var computerID: String
    @State private var description: String
    @State private var displayName: String
    @State private var modelID: String
    @State private var reasoningEffort: AgentReasoningEffort
    @State private var runtimeID: String
    @State private var errorMessage: String?
    @State private var isSubmitting = false

    public init(
        action: PreparedCreateAgentActionPresentation,
        configuration: PreparedAgentCreationConfiguration,
        proposedComputerID: String? = nil
    ) {
        self.action = action
        self.configuration = configuration
        let defaults = PreparedAgentCreationDefaults.resolve(
            proposedComputerID: proposedComputerID ?? action.proposedComputerID,
            requiredComputerID: action.requiredComputerID,
            computers: configuration.computers,
            cove: configuration.coveDefaults
        )
        _computerID = State(initialValue: defaults?.computerID ?? "")
        _runtimeID = State(initialValue: defaults?.runtimeID ?? "")
        _modelID = State(initialValue: defaults?.modelID ?? "")
        _reasoningEffort = State(initialValue: defaults?.reasoningEffort ?? .medium)
        _displayName = State(initialValue: action.name)
        _description = State(initialValue: action.description ?? "")
    }

    public var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        avatarPreview
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Agent avatar").font(.headline)
                            Text(avatar == nil ? "Prepared image" : "Replacement selected")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        AvatarPhotoPicker(label: "Replace avatar") { payload in
                            await MainActor.run { avatar = payload }
                        }
                    }
                }

                Section("Identity") {
                    TextField("Name", text: $displayName)
                        .accessibilityIdentifier("prepared-agent-name")
                    TextField("Description", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                        .accessibilityIdentifier("prepared-agent-description")
                }

                Section("Execution") {
                    if requiredComputerUnavailable {
                        ContentUnavailableView(
                            "Required Computer unavailable",
                            systemImage: "desktopcomputer.trianglebadge.exclamationmark",
                            description: Text("Connect the Computer required by this proposal before creating the Agent.")
                        )
                    } else if configuration.computers.isEmpty {
                        ContentUnavailableView(
                            "No Computer available",
                            systemImage: "desktopcomputer.trianglebadge.exclamationmark",
                            description: Text("Connect a Computer with a reported runtime before creating this Agent.")
                        )
                    } else {
                        if action.requiredComputerID == nil {
                            Picker("Computer", selection: $computerID) {
                                ForEach(configuration.computers) { Text($0.label).tag($0.id) }
                            }
                        } else if let selectedComputer {
                            LabeledContent("Computer", value: selectedComputer.label)
                        }
                        Picker("Runtime", selection: $runtimeID) {
                            ForEach(selectedComputer?.runtimes ?? []) { Text($0.label).tag($0.id) }
                        }
                        Picker("Model", selection: $modelID) {
                            ForEach(selectedRuntime?.models ?? []) { Text($0.label).tag($0.id) }
                        }
                        Picker("Reasoning", selection: $reasoningEffort) {
                            ForEach(AgentReasoningEffort.allCases, id: \.self) {
                                Text($0.displayName).tag($0)
                            }
                        }
                    }
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("prepared-agent-error")
                    }
                }
            }
            .navigationTitle("Create Agent")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.disabled(isSubmitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await submit() } }
                        .disabled(!canSubmit)
                        .accessibilityIdentifier("prepared-agent-commit")
                }
            }
            .overlay {
                if isSubmitting {
                    ProgressView().controlSize(.large)
                        .padding(24)
                        .background(.regularMaterial, in: .rect(cornerRadius: 16))
                }
            }
            .onChange(of: computerID) { _, _ in resetRuntimeSelection() }
            .onChange(of: runtimeID) { _, _ in resetModelSelection() }
            .interactiveDismissDisabled(isSubmitting)
        }
        .presentationDetents([.large])
    }

    @ViewBuilder
    private var avatarPreview: some View {
        if let avatar {
            selectedAvatar(data: avatar.data)
        } else {
            AvatarView(name: displayName, url: action.avatarURL, size: 72)
        }
    }

    @ViewBuilder
    private func selectedAvatar(data: Data) -> some View {
        #if os(iOS)
        if let image = UIImage(data: data) {
            Image(uiImage: image).resizable().scaledToFill()
                .frame(width: 72, height: 72).clipShape(.circle)
        } else {
            AvatarView(name: displayName, url: action.avatarURL, size: 72)
        }
        #else
        AvatarView(name: displayName, url: action.avatarURL, size: 72)
        #endif
    }

    private var selectedComputer: PreparedAgentComputer? {
        configuration.computers.first { $0.id == computerID }
    }

    private var requiredComputerUnavailable: Bool {
        guard let requiredComputerID = action.requiredComputerID else { return false }
        return !configuration.computers.contains { $0.id == requiredComputerID }
    }

    private var selectedRuntime: PreparedAgentRuntime? {
        selectedComputer?.runtimes.first { $0.id == runtimeID }
    }

    private var canSubmit: Bool {
        !isSubmitting && !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && selectedComputer != nil && selectedRuntime != nil
            && selectedRuntime?.models.contains(where: { $0.id == modelID }) == true
    }

    private func resetRuntimeSelection() {
        guard let computer = selectedComputer else {
            runtimeID = ""
            modelID = ""
            return
        }
        if !computer.runtimes.contains(where: { $0.id == runtimeID }) {
            runtimeID = computer.runtimes.first?.id ?? ""
        }
        resetModelSelection()
    }

    private func resetModelSelection() {
        guard let runtime = selectedRuntime else {
            modelID = ""
            return
        }
        if !runtime.models.contains(where: { $0.id == modelID }) {
            modelID = runtime.models.first?.id ?? ""
        }
    }

    private func submit() async {
        guard canSubmit else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await configuration.onCommit(
                action,
                PreparedAgentCreateDraft(
                    avatar: avatar,
                    computerID: computerID,
                    description: description.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                    displayName: name,
                    handle: PreparedAgentHandle.create(
                        name: name,
                        existingHandles: configuration.existingHandles
                    ),
                    modelID: modelID,
                    reasoningEffort: reasoningEffort,
                    runtimeID: runtimeID
                )
            )
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

private extension AgentReasoningEffort {
    var displayName: String { rawValue.capitalized }
}
