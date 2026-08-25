import SwiftUI

#if os(iOS)
import QuickLook
#endif

public struct MessageAttachmentGroup: View {
    private let attachments: [MessageAttachmentPresentation]
    private let isPending: Bool
    private let onOpen: (MessageAttachmentPresentation) async throws -> URL

    @State private var previewURL: URL?
    @State private var downloadedPreviewURL: URL?
    @State private var loadingAttachmentID: String?
    @State private var errorMessage: String?
    @State private var imageTileFailedIDs: Set<String> = []

    public init(
        attachments: [MessageAttachmentPresentation],
        isPending: Bool = false,
        onOpen: @escaping (MessageAttachmentPresentation) async throws -> URL
    ) {
        self.attachments = attachments
        self.isPending = isPending
        self.onOpen = onOpen
    }

    public var body: some View {
        attachmentRows
        #if os(iOS)
            .quickLookPreview($previewURL)
        #endif
            .alert("Couldn’t open attachment", isPresented: errorPresented) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "Try again.")
            }
            .onChange(of: previewURL) { _, currentURL in
                guard currentURL == nil, let downloadedPreviewURL else { return }
                try? FileManager.default.removeItem(
                    at: downloadedPreviewURL.deletingLastPathComponent()
                )
                self.downloadedPreviewURL = nil
            }
            .onDisappear {
                guard let downloadedPreviewURL else { return }
                try? FileManager.default.removeItem(
                    at: downloadedPreviewURL.deletingLastPathComponent()
                )
                self.downloadedPreviewURL = nil
            }
    }

    private var attachmentRows: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(attachments) { attachment in
                if showsImageTile(attachment) {
                    Button {
                        open(attachment)
                    } label: {
                        imageTile(attachment)
                    }
                    .buttonStyle(.plain)
                    .disabled(loadingAttachmentID != nil)
                    .accessibilityLabel("Preview \(attachment.filename)")
                } else {
                    Button {
                        open(attachment)
                    } label: {
                        attachmentRow(attachment)
                    }
                    .buttonStyle(.plain)
                    .disabled(isPending || loadingAttachmentID != nil)
                    .accessibilityLabel(
                        isPending ? "Uploading \(attachment.filename)" : "Preview \(attachment.filename)"
                    )
                }
            }
        }
    }

    /// Sent (non-pending) image attachments render as inline media tiles;
    /// pending uploads and everything else keep the file row.
    private func showsImageTile(_ attachment: MessageAttachmentPresentation) -> Bool {
        attachment.isImage && !isPending && !imageTileFailedIDs.contains(attachment.id)
    }

    private func imageTile(_ attachment: MessageAttachmentPresentation) -> some View {
        AttachmentImageTile(
            attachment: attachment,
            onOpen: onOpen,
            onFailure: { imageTileFailedIDs.insert(attachment.id) }
        )
        .overlay(alignment: .bottomTrailing) {
            if loadingAttachmentID == attachment.id {
                ProgressView()
                    .controlSize(.small)
                    .padding(6)
                    .background(.thinMaterial, in: .circle)
                    .padding(6)
            }
        }
    }

    private func attachmentRow(_ attachment: MessageAttachmentPresentation) -> some View {
        HStack(spacing: 10) {
            attachmentMedia(attachment)
                .frame(width: 42, height: 42)
                .background(.quaternary, in: .rect(cornerRadius: 9))
                .clipShape(.rect(cornerRadius: 9))

            VStack(alignment: .leading, spacing: 2) {
                Text(attachment.filename)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(1)
                Text(attachmentDetail(attachment))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            if isPending || loadingAttachmentID == attachment.id {
                ProgressView().controlSize(.small)
            } else {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(8)
        .frame(maxWidth: 320, alignment: .leading)
        .background(GrottoPlatformColor.inputSurface, in: .rect(cornerRadius: 13))
    }

    @ViewBuilder
    private func attachmentMedia(_ attachment: MessageAttachmentPresentation) -> some View {
        if attachment.isImage, let localURL = attachment.localURL {
            LocalAttachmentImage(url: localURL)
        } else {
            GrottoIcon(attachmentIcon(attachment), size: 19, weight: 1.6)
                .foregroundStyle(.secondary)
        }
    }

    private func open(_ attachment: MessageAttachmentPresentation) {
        loadingAttachmentID = attachment.id
        Task {
            do {
                let url = try await onOpen(attachment)
                if attachment.localURL == nil { downloadedPreviewURL = url }
                previewURL = url
            } catch is CancellationError {
                // A dismissed preview or canceled transfer needs no error UI.
            } catch {
                errorMessage = error.localizedDescription
            }
            loadingAttachmentID = nil
        }
    }

    private func attachmentDetail(_ attachment: MessageAttachmentPresentation) -> String {
        let size = ByteCountFormatter.string(
            fromByteCount: Int64(attachment.sizeBytes),
            countStyle: .file
        )
        let kind = attachment.mediaType.split(separator: "/").last.map(String.init) ?? "file"
        return "\(kind.uppercased()) · \(size)"
    }

    private func attachmentIcon(_ attachment: MessageAttachmentPresentation) -> GrottoIconName {
        if attachment.mediaType == "application/pdf" { return .pdf }
        if attachment.mediaType.hasPrefix("video/") { return .video }
        if attachment.mediaType.hasPrefix("audio/") { return .voice }
        if attachment.isImage { return .image }
        return .document
    }

    private var errorPresented: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }
}
