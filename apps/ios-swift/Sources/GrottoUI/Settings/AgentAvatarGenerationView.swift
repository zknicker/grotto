import Foundation
import SwiftUI

enum AvatarGenerationConcept {
    static let maxLength = 280

    static func normalized(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func validationError(for value: String) -> String? {
        let concept = normalized(value)
        if concept.isEmpty {
            return "Enter a short concept before generating an avatar."
        }
        if concept.count > maxLength {
            return "Keep the concept to 280 characters or fewer."
        }
        return nil
    }
}

struct AgentAvatarGeneratorEntry: View {
    let onOpen: () -> Void

    var body: some View {
        SettingsSection("Avatar") {
            SettingsListGroup {
                Button {
                    onOpen()
                } label: {
                    SettingsRow(
                        title: "Generate avatar",
                        systemImage: "sparkles",
                        showsDivider: false
                    ) {
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("generate-agent-avatar")
            }
        }
    }
}

struct AgentAvatarGenerationView: View {
    let agentName: String
    let onGenerate: @Sendable (String) async throws -> AvatarImagePayload
    let onSave: @Sendable (AvatarImagePayload) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var concept = ""
    @State private var conceptError: String?
    @State private var errorMessage: String?
    @State private var isGenerating = false
    @State private var isSaving = false
    @State private var preview: AvatarImagePayload?

    init(
        agentName: String,
        onGenerate: @escaping @Sendable (String) async throws -> AvatarImagePayload,
        onSave: @escaping @Sendable (AvatarImagePayload) async throws -> Void,
        initialConcept: String = "",
        initialPreview: AvatarImagePayload? = nil,
        initiallyGenerating: Bool = false
    ) {
        self.agentName = agentName
        self.onGenerate = onGenerate
        self.onSave = onSave
        _concept = State(initialValue: initialConcept)
        _preview = State(initialValue: initialPreview)
        _isGenerating = State(initialValue: initiallyGenerating)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(
                        "e.g. a moonlit fox cartographer",
                        text: $concept,
                        axis: .vertical
                    )
                    .lineLimit(2 ... 4)
                    .submitLabel(.go)
                    .onSubmit { Task { await generate() } }
                    .onChange(of: concept) { _, value in
                        if value.count > AvatarGenerationConcept.maxLength {
                            concept = String(value.prefix(AvatarGenerationConcept.maxLength))
                        }
                        if conceptError != nil, !AvatarGenerationConcept.normalized(value).isEmpty {
                            conceptError = nil
                        }
                    }
                    .accessibilityLabel("Avatar concept")

                    Text("Describe one character concept. Agent name and description are not used.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    if let conceptError {
                        Text(conceptError)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("avatar-concept-error")
                    }
                } header: {
                    Text("Concept")
                } footer: {
                    Text("Up to 280 characters.")
                }

                Section("Preview") {
                    previewContent
                        .frame(maxWidth: .infinity)
                        .listRowBackground(Color.clear)
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .accessibilityIdentifier("avatar-generation-error")
                    }
                }

                Section {
                    Button {
                        Task { await generate() }
                    } label: {
                        if isGenerating {
                            HStack {
                                ProgressView()
                                Text("Generating preview…")
                            }
                            .frame(maxWidth: .infinity)
                        } else {
                            Label(
                                preview == nil ? "Generate preview" : "Generate another",
                                systemImage: "sparkles"
                            )
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isBusy)
                    .accessibilityIdentifier("generate-avatar-preview")
                }
            }
            .navigationTitle("Generate avatar")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .interactiveDismissDisabled(isBusy)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isBusy)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView()
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(preview == nil || isBusy)
                    .accessibilityLabel("Save avatar")
                }
            }
        }
    }

    @ViewBuilder
    private var previewContent: some View {
        if let preview {
            GeneratedAvatarPreview(payload: preview, name: agentName)
        } else {
            VStack(spacing: 10) {
                Image(systemName: "photo.badge.sparkles")
                    .font(.largeTitle)
                Text(isGenerating ? "Creating your preview…" : "Your preview will appear here.")
                    .font(.subheadline)
            }
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 180)
            .accessibilityIdentifier("avatar-preview-placeholder")
        }
    }

    private var isBusy: Bool {
        isGenerating || isSaving
    }

    private func generate() async {
        guard !isBusy else { return }
        if let validationError = AvatarGenerationConcept.validationError(for: concept) {
            conceptError = validationError
            return
        }

        isGenerating = true
        errorMessage = nil
        defer { isGenerating = false }
        do {
            preview = try await onGenerate(AvatarGenerationConcept.normalized(concept))
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        guard let preview, !isBusy else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        do {
            try await onSave(preview)
            dismiss()
        } catch is CancellationError {
            return
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct GeneratedAvatarPreview: View {
    let payload: AvatarImagePayload
    let name: String

    var body: some View {
        Group {
            #if os(iOS)
            if let image = UIImage(data: payload.data) {
                Image(uiImage: image)
                    .interpolation(.none)
                    .resizable()
            } else {
                Color.clear
            }
            #elseif os(macOS)
            if let image = NSImage(data: payload.data) {
                Image(nsImage: image)
                    .interpolation(.none)
                    .resizable()
            } else {
                Color.clear
            }
            #endif
        }
        .scaledToFit()
        .frame(width: 180, height: 180)
        .clipShape(.rect(cornerRadius: 20))
        .accessibilityLabel("\(name) generated avatar preview")
        .accessibilityIdentifier("generated-avatar-preview")
    }
}
