import SwiftUI

public struct SettingsSection<Content: View>: View {
    private let title: String
    private let content: () -> Content

    public init(
        _ title: String,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 16)

            content()
        }
    }
}

public struct SettingsListGroup<Content: View>: View {
    private let content: () -> Content

    public init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    public var body: some View {
        VStack(spacing: 0) {
            content()
        }
        .background(GrottoPlatformColor.groupedSurface, in: RoundedRectangle(cornerRadius: 22))
        .clipShape(RoundedRectangle(cornerRadius: 22))
    }
}

public struct SettingsRow<Content: View>: View {
    private let title: String
    private let subtitle: String?
    private let systemImage: String?
    private let showsDivider: Bool
    private let content: () -> Content

    public init(
        title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        showsDivider: Bool = true,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.showsDivider = showsDivider
        self.content = content
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 19, weight: .medium))
                        .frame(width: 24)
                        .foregroundStyle(.primary)
                        .accessibilityHidden(true)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineLimit(1)

                    if let subtitle {
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 8)
                content()
            }
            .frame(height: 64)
            .padding(.horizontal, 16)
            .contentShape(Rectangle())

            if showsDivider {
                Divider()
                    .padding(.leading, systemImage == nil ? 16 : 54)
            }
        }
    }
}

public struct DisclosureRow: View {
    private let title: String
    private let subtitle: String?
    private let systemImage: String
    private let showsDivider: Bool
    private let action: () -> Void

    public init(
        _ title: String,
        subtitle: String? = nil,
        systemImage: String,
        showsDivider: Bool = true,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.showsDivider = showsDivider
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            SettingsRow(
                title: title,
                subtitle: subtitle,
                systemImage: systemImage,
                showsDivider: false
            ) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.tertiary)
                    .accessibilityHidden(true)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(subtitle.map { "\(title), \($0)" } ?? title)
        .overlay(alignment: .bottom) {
            if showsDivider {
                Divider()
                    .padding(.leading, systemImage.isEmpty ? 16 : 54)
            }
        }
    }
}

public struct ValueRow: View {
    private let title: String
    private let value: String
    private let systemImage: String
    private let showsDivider: Bool

    public init(
        _ title: String,
        value: String,
        systemImage: String,
        showsDivider: Bool = true
    ) {
        self.title = title
        self.value = value
        self.systemImage = systemImage
        self.showsDivider = showsDivider
    }

    public var body: some View {
        SettingsRow(
            title: title,
            systemImage: systemImage,
            showsDivider: showsDivider
        ) {
            Text(value)
                .font(.body)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .multilineTextAlignment(.trailing)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(value)")
    }
}

public struct PickerRow<Value: Hashable>: View {
    private let title: String
    private let value: Value
    private let systemImage: String
    private let options: [(Value, String)]
    private let onChange: (Value) -> Void

    public init(
        _ title: String,
        value: Value,
        systemImage: String,
        options: [(Value, String)],
        onChange: @escaping (Value) -> Void
    ) {
        self.title = title
        self.value = value
        self.systemImage = systemImage
        self.options = options
        self.onChange = onChange
    }

    public var body: some View {
        SettingsRow(title: title, systemImage: systemImage, showsDivider: false) {
            Menu {
                ForEach(Array(options.enumerated()), id: \.offset) { _, option in
                    Button {
                        onChange(option.0)
                    } label: {
                        HStack {
                            Text(option.1)
                            if option.0 == value {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack(spacing: 5) {
                    Text(options.first(where: { $0.0 == value })?.1 ?? "Select")
                        .foregroundStyle(.secondary)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .tint(.secondary)
            .accessibilityLabel("\(title), \(options.first(where: { $0.0 == value })?.1 ?? "Select")")
        }
        .overlay(alignment: .bottom) {
            Divider()
                .padding(.leading, 54)
        }
    }
}

public struct SettingsAvatar: View {
    private let initials: String
    private let size: CGFloat

    public init(initials: String, size: CGFloat = 40) {
        self.initials = initials
        self.size = size
    }

    public var body: some View {
        Text(initials)
            .font(.system(size: size * 0.35, weight: .medium))
            .foregroundStyle(.tint)
            .frame(width: size, height: size)
            .background(Color(.tertiarySystemFill), in: Circle())
            .accessibilityLabel("Avatar, \(initials)")
    }
}
