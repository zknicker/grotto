import SwiftUI

/// The one thing this screen is about: the avatar, at the size and shape the
/// product actually draws it. Grotto renders every avatar as a circle, so the
/// preview is a circle too — a rounded square would promise a crop the app
/// never shows. Empty, generating, and ready are the same circle in three
/// states, so nothing jumps when a drawing lands.
struct AvatarGenerationPreviewHero: View {
    let agentName: String
    let payload: AvatarImagePayload?
    let isGenerating: Bool

    private static let diameter: CGFloat = 176

    @State private var sweep = false

    var body: some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(GrottoPlatformColor.groupedSurface)
                    // An empty well says so. Without the dashed rim the blank
                    // circle reads as a finished avatar that failed to load.
                    .overlay {
                        if payload == nil, !isGenerating {
                            Circle()
                                .strokeBorder(
                                    style: StrokeStyle(lineWidth: 1.5, dash: [6, 8])
                                )
                                .foregroundStyle(.quaternary)
                        }
                    }

                if let image = previewImage {
                    image
                        .resizable()
                        // Generated avatars are 256px pixel art drawn well above
                        // that size here; smoothing would blur the stepped edges
                        // the prompt asks the model for.
                        .interpolation(.none)
                        .scaledToFill()
                        .frame(width: Self.diameter, height: Self.diameter)
                        .clipShape(.circle)
                        .transition(.scale(scale: 0.9).combined(with: .opacity))
                } else {
                    GrottoIcon(.magic, size: 38, weight: 1.7)
                        .foregroundStyle(.tertiary)
                        .opacity(isGenerating ? 0.3 : 1)
                }

                if isGenerating {
                    progressRing
                }
            }
            .frame(width: Self.diameter, height: Self.diameter)
            .shadow(color: .black.opacity(payload == nil ? 0 : 0.16), radius: 16, y: 8)
            .animation(.spring(response: 0.45, dampingFraction: 0.78), value: payload)

            // Only the wait needs words. The empty state repeated the field's
            // own help line, and the ready state narrated a Save button that is
            // already on screen.
            if isGenerating {
                Text("Imagining a new look for \(agentName)…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 16)
                    .transition(.opacity)
            }
        }
        .animation(.snappy(duration: 0.25), value: isGenerating)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityIdentifier(
            payload == nil ? "avatar-preview-placeholder" : "generated-avatar-preview"
        )
    }

    /// One accent sweep around the rim. An avatar takes the image provider tens
    /// of seconds, so the wait needs a mark of its own on the thing being made
    /// rather than a spinner parked in a row somewhere else.
    private var progressRing: some View {
        Circle()
            .strokeBorder(
                AngularGradient(
                    colors: [
                        .accentColor.opacity(0),
                        .accentColor.opacity(0.2),
                        .accentColor,
                    ],
                    center: .center
                ),
                lineWidth: 4
            )
            .rotationEffect(.degrees(sweep ? 360 : 0))
            .onAppear {
                withAnimation(.linear(duration: 1.15).repeatForever(autoreverses: false)) {
                    sweep = true
                }
            }
            .onDisappear { sweep = false }
    }

    private var accessibilityLabel: String {
        if isGenerating {
            return "Generating an avatar for \(agentName)"
        }
        if payload == nil {
            return "No avatar preview yet"
        }
        return "\(agentName) generated avatar preview"
    }

    private var previewImage: Image? {
        guard let payload else { return nil }
        #if os(iOS)
        return UIImage(data: payload.data).map(Image.init(uiImage:))
        #elseif os(macOS)
        return NSImage(data: payload.data).map(Image.init(nsImage:))
        #else
        return nil
        #endif
    }
}

/// Starting concepts for an empty field.
///
/// A blank text box is the hardest part of this flow: the prompt does the
/// styling, so the human only has to name a character, and one tap on a real
/// example teaches that faster than the help text above it. It lives inside the
/// concept card and bleeds to that card's edges, so a chip run reads as part of
/// the field rather than as a second control.
struct AvatarConceptSuggestions: View {
    let onSelect: (String) -> Void

    /// The card's own inset, which the scroller re-adds inside its content so
    /// chips start on the text's rail and still scroll off the card edge.
    private static let cardInset: CGFloat = 16

    static let concepts = [
        "a moonlit fox cartographer",
        "a brass-goggled octopus engineer",
        "a sleepy cactus astronaut",
        "a neon koi librarian",
        "a mossy stone gardener",
    ]

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(Self.concepts, id: \.self) { concept in
                    Button {
                        onSelect(concept)
                    } label: {
                        Text(concept)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 8)
                            .background(GrottoPlatformColor.inputSurface, in: .capsule)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Fills the concept field")
                }
            }
            .padding(.horizontal, Self.cardInset)
        }
        .scrollIndicators(.hidden)
        .padding(.horizontal, -Self.cardInset)
    }
}
