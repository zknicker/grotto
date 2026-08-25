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
            sourceRow(.camera, title: "Camera", icon: .camera, action: onCamera)
            sourceRow(.photos, title: "Photos", icon: .media, action: onPhotos)
            sourceRow(.files, title: "Files", icon: .attachment, action: onFiles)
        }
        .padding(.vertical, 6)
        .foregroundStyle(.primary)
    }

    private func sourceRow(
        _ source: ComposerSource,
        title: String,
        icon: GrottoIconName,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                sourceIcon(icon)
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
    private func sourceIcon(_ icon: GrottoIconName) -> some View {
        if #available(iOS 26, macOS 26, *) {
            GrottoIcon(icon, size: 22, weight: 1.8)
                .frame(width: 44, height: 44)
                .glassEffect(.regular.interactive(), in: .circle)
        } else {
            GrottoIcon(icon, size: 22, weight: 1.8)
                .frame(width: 44, height: 44)
                .background(.primary.opacity(0.055), in: .circle)
        }
    }
}
