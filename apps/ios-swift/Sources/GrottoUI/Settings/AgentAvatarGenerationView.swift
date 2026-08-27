import SwiftUI

/// The entry point on an Agent's profile, directly under its avatar so the
/// action sits on the thing it changes. Only an ordinary Agent shows it: the
/// Server keeps Grotto's own factory Agents on their product-owned artwork.
struct AgentAvatarGeneratorEntry: View {
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 7) {
                GrottoIcon(.magic, size: 17, weight: 1.9)
                Text("Generate avatar")
                    .font(.subheadline.weight(.medium))
            }
            .foregroundStyle(.tint)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(GrottoPlatformColor.groupedSurface, in: .capsule)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("generate-agent-avatar")
    }
}

/// Concept in, one preview out, saved only on purpose.
///
/// The preview leads and the controls follow it: the avatar is the subject of
/// the screen, and the primary action lives at the thumb rather than in the
/// navigation bar because generating is the thing a human repeats here.
struct AgentAvatarGenerationView: View {
    let agentName: String
    let onGenerate: @Sendable (String) async throws -> AvatarImagePayload
    let onSave: @Sendable (AvatarImagePayload) async throws -> Void

    @Environment(\.dismiss) private var dismiss
    @FocusState private var conceptFocused: Bool
    @State private var concept = ""
    @State private var conceptError: String?
    @State private var errorMessage: String?
    @State private var isGenerating = false
    @State private var isSaving = false
    @State private var preview: AvatarImagePayload?
    /// Increments on each landed preview so the haptic fires once per drawing.
    @State private var previewCount = 0

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
            ScrollView {
                VStack(spacing: 22) {
                    AvatarGenerationPreviewHero(
                        agentName: agentName,
                        payload: preview,
                        isGenerating: isGenerating
                    )
                    .padding(.top, 8)

                    conceptCard

                    generateButton

                    if let errorMessage {
                        failureCard(errorMessage)
                    }
                }
                .padding(.vertical, 8)
                .padding(.bottom, 16)
                .animation(.snappy(duration: 0.28), value: showsSuggestions)
                .animation(.snappy(duration: 0.28), value: errorMessage)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(GrottoPlatformColor.groupedBackground)
            .navigationTitle("Generate avatar")
            .grottoInlineNavigationTitle()
            // A drawing takes tens of seconds, so leaving is allowed the whole
            // time — only the save itself, which writes the Agent's avatar, is
            // held open until it finishes.
            .interactiveDismissDisabled(isSaving)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
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
                    .accessibilityIdentifier("save-generated-avatar")
                }
                // A vertical-axis field spends Return on a newline, so the
                // keyboard needs its own way out.
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { conceptFocused = false }
                }
            }
            .sensoryFeedback(.success, trigger: previewCount)
        }
    }

    private var conceptCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Concept")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)

            VStack(alignment: .leading, spacing: 12) {
                TextField(
                    "e.g. a moonlit fox cartographer",
                    text: $concept,
                    axis: .vertical
                )
                .font(.body)
                .lineLimit(2 ... 5)
                .focused($conceptFocused)
                .onChange(of: concept) { _, value in
                    if value.count > AvatarGenerationConcept.maxLength {
                        concept = String(value.prefix(AvatarGenerationConcept.maxLength))
                    }
                    if conceptError != nil, !AvatarGenerationConcept.normalized(value).isEmpty {
                        conceptError = nil
                    }
                }
                .accessibilityLabel("Avatar concept")

                if showsSuggestions {
                    Divider()
                    AvatarConceptSuggestions { suggestion in
                        concept = suggestion
                        conceptError = nil
                    }
                    .transition(.opacity)
                }
            }
            .padding(16)
            .background(GrottoPlatformColor.groupedSurface, in: RoundedRectangle(cornerRadius: 22))
            .padding(.horizontal, 16)

            conceptFooter
        }
    }

    /// The help line reads as a grouped-list footer: outside the card, on the
    /// section's rail, at the same size as the rest of the screen's prose.
    private var conceptFooter: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(conceptError ?? "Describe one character. This Agent's name and description aren't used.")
                .font(.subheadline)
                .foregroundStyle(conceptError == nil ? .secondary : Color.red)
                .accessibilityIdentifier(
                    conceptError == nil ? "avatar-concept-help" : "avatar-concept-error"
                )

            Spacer(minLength: 0)

            if concept.count >= AvatarGenerationConcept.counterThreshold {
                Text("\(concept.count)/\(AvatarGenerationConcept.maxLength)")
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 16)
    }

    private func failureCard(_ message: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            GrottoIcon(.alert, size: 19, weight: 1.9)
                .foregroundStyle(.red)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(Color.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 18))
        .padding(.horizontal, 16)
        .accessibilityIdentifier("avatar-generation-error")
    }

    /// The only action the content owns. Save belongs in the navigation bar,
    /// where a sheet's confirming action lives, which also keeps both controls
    /// clear of the keyboard the concept field raises.
    private var generateButton: some View {
        Button {
            Task { await generate() }
        } label: {
            HStack(spacing: 8) {
                if isGenerating {
                    // A prominent pill paints its own label white; a
                    // ProgressView keeps the system grey unless told.
                    ProgressView()
                        .controlSize(.small)
                        .tint(.white)
                } else {
                    GrottoIcon(.magic, size: 19, weight: 1.9)
                }
                Text(generateTitle)
                    .font(.body.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .controlSize(.large)
        // An empty concept is guidance rather than a dead end: the tap lands and
        // the field says what it needs. Only work in flight blocks it, and the
        // label already says so.
        .allowsHitTesting(!isBusy)
        .padding(.horizontal, 16)
        .accessibilityIdentifier("generate-avatar-preview")
    }

    private var generateTitle: String {
        if isGenerating {
            return "Generating…"
        }
        return preview == nil ? "Generate preview" : "Generate another"
    }

    private var showsSuggestions: Bool {
        preview == nil && !isGenerating && concept.isEmpty
    }

    private var isBusy: Bool {
        isGenerating || isSaving
    }

    private func generate() async {
        guard !isBusy else { return }
        if let validationError = AvatarGenerationConcept.validationError(for: concept) {
            conceptError = validationError
            conceptFocused = true
            return
        }

        conceptFocused = false
        isGenerating = true
        errorMessage = nil
        defer { isGenerating = false }
        do {
            preview = try await onGenerate(AvatarGenerationConcept.normalized(concept))
            previewCount += 1
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
