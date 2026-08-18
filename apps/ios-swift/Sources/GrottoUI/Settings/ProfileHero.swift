import SwiftUI

struct ProfileHero: View {
    let initials: String
    let avatarURL: URL?
    var presence: AgentPresence? = nil
    let displayName: String
    let handle: String?
    let onSaveAvatar: @Sendable (AvatarImagePayload) async throws -> Void

    var body: some View {
        VStack(spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                AvatarView(name: displayName, url: avatarURL, presence: presence, size: 84)
                AvatarPhotoPicker(onImagePicked: onSaveAvatar)
                    .offset(x: 4, y: 4)
            }
            Text(displayName)
                .font(.title2.weight(.semibold))
                .foregroundStyle(.primary)
                .multilineTextAlignment(.center)
            if let handle {
                Text(handle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .accessibilityElement(children: .combine)
    }
}
