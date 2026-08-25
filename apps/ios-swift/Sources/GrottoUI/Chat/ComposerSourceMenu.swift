import SwiftUI

enum ComposerSource: Hashable {
    case camera
    case photos
    case files
}

struct ComposerSourceMenu: View {
    @AccessibilityFocusState.Binding var focusedSource: ComposerSource?
    let onCamera: () -> Void
    let onPhotos: () -> Void
    let onFiles: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            sourceRow(.camera, title: "Camera", systemImage: "camera", action: onCamera)
            sourceRow(.photos, title: "Photos", systemImage: "photo.on.rectangle", action: onPhotos)
            sourceRow(.files, title: "Files", systemImage: "paperclip", action: onFiles)
        }
        .padding(.vertical, 6)
        .foregroundStyle(.primary)
    }

    private func sourceRow(
        _ source: ComposerSource,
        title: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                sourceIcon(systemImage)
                Text(title).font(.title3)
                Spacer()
            }
            .padding(.horizontal, 18)
            .frame(minHeight: 66)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityFocused($focusedSource, equals: source)
    }

    @ViewBuilder
    private func sourceIcon(_ systemImage: String) -> some View {
        if #available(iOS 26, macOS 26, *) {
            Image(systemName: systemImage)
                .font(.title3.weight(.medium))
                .frame(width: 44, height: 44)
                .glassEffect(.regular.interactive(), in: .circle)
        } else {
            Image(systemName: systemImage)
                .font(.title3.weight(.medium))
                .frame(width: 44, height: 44)
                .background(.primary.opacity(0.055), in: .circle)
        }
    }
}
