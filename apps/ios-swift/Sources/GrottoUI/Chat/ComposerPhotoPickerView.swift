#if os(iOS)
@preconcurrency import Photos
import SwiftUI
import UIKit

struct ComposerPhotoPickerView: View {
    let maximumSelectionCount: Int
    let onCancel: () -> Void
    let onAdd: ([URL], CGRect?) -> Void

    @State private var assets: [PHAsset] = []
    @State private var selectedIDs: [String] = []
    @State private var authorizationDenied = false
    @State private var isExporting = false
    @State private var assetFrames: [String: CGRect] = [:]
    @State private var selectionFeedback = 0

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 2), count: 3)

    var body: some View {
        VStack(spacing: 0) {
            Group {
                if authorizationDenied {
                    ContentUnavailableView(
                        "Photos access is off",
                        systemImage: "photo.badge.exclamationmark",
                        description: Text("Allow photo access in Settings to attach a photo.")
                    )
                } else {
                    photoGrid
                }
            }
            pickerFooter
        }
        .background(.black)
        .coordinateSpace(name: "composer-photo-picker")
        .onPreferenceChange(PhotoAssetFramePreferenceKey.self) { assetFrames = $0 }
        .task { await loadAssets() }
        .sensoryFeedback(.selection, trigger: selectionFeedback)
    }

    private var photoGrid: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 2) {
                ForEach(assets, id: \.localIdentifier) { asset in
                    Button { toggle(asset) } label: {
                        PhotoAssetThumbnail(asset: asset)
                            .aspectRatio(1, contentMode: .fill)
                            .clipped()
                            .background {
                                GeometryReader { geometry in
                                    Color.clear.preference(
                                        key: PhotoAssetFramePreferenceKey.self,
                                        value: [
                                            asset.localIdentifier: geometry.frame(
                                                in: .named("composer-photo-picker")
                                            )
                                        ]
                                    )
                                }
                            }
                            .overlay(alignment: .topTrailing) {
                                if let index = selectedIDs.firstIndex(of: asset.localIdentifier) {
                                    Text("\(index + 1)")
                                        .font(.caption2.bold())
                                        .foregroundStyle(.white)
                                        .frame(width: 22, height: 22)
                                        .background(.blue, in: .circle)
                                        .padding(5)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Photo")
                    .accessibilityValue(selectionValue(for: asset))
                }
            }
        }
        .scrollIndicators(.hidden)
    }

    private var pickerFooter: some View {
        HStack {
            Button(action: onCancel) {
                Image(systemName: "chevron.left")
                    .font(.headline.weight(.semibold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.circle)
            .tint(.black.opacity(0.72))
            .accessibilityLabel("Back to attachments")

            Spacer()

            if selectedIDs.isEmpty {
                Text("All Photos")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 18)
                    .frame(minHeight: 44)
                    .foregroundStyle(.white)
                    .background(.black.opacity(0.72), in: .capsule)
            } else {
                Button(action: exportSelection) {
                    if isExporting {
                        ProgressView().tint(.white).frame(minWidth: 118, minHeight: 44)
                    } else {
                        Text("Add \(selectedIDs.count) photo\(selectedIDs.count == 1 ? "" : "s")")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 18)
                            .frame(minHeight: 44)
                    }
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .disabled(isExporting)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.black)
        .animation(.smooth(duration: 0.22), value: selectedIDs.count)
    }

    private func loadAssets() async {
        let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        guard status == .authorized || status == .limited else {
            authorizationDenied = true
            return
        }
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        let result = PHAsset.fetchAssets(with: .image, options: options)
        var fetched: [PHAsset] = []
        result.enumerateObjects { asset, _, _ in fetched.append(asset) }
        assets = fetched
    }

    private func toggle(_ asset: PHAsset) {
        let id = asset.localIdentifier
        if let index = selectedIDs.firstIndex(of: id) {
            selectedIDs.remove(at: index)
            UIAccessibility.post(notification: .announcement, argument: "Photo deselected")
        } else if selectedIDs.count < maximumSelectionCount {
            selectedIDs.append(id)
            UIAccessibility.post(notification: .announcement, argument: "Photo selected")
        }
        selectionFeedback += 1
    }

    private func selectionValue(for asset: PHAsset) -> String {
        guard let index = selectedIDs.firstIndex(of: asset.localIdentifier) else { return "Not selected" }
        return "Selected \(index + 1)"
    }

    private func exportSelection() {
        let selected = selectedIDs.compactMap { id in assets.first { $0.localIdentifier == id } }
        isExporting = true
        Task {
            do {
                var urls: [URL] = []
                for asset in selected { urls.append(try await PhotoAssetExporter.export(asset)) }
                onAdd(
                    urls,
                    selectedIDs.first.flatMap { assetFrames[$0] }
                )
            } catch {
                isExporting = false
            }
        }
    }
}

private struct PhotoAssetFramePreferenceKey: PreferenceKey {
    static let defaultValue: [String: CGRect] = [:]

    static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
        value.merge(nextValue(), uniquingKeysWith: { _, latest in latest })
    }
}

private struct PhotoAssetThumbnail: View {
    let asset: PHAsset
    @State private var image: UIImage?

    var body: some View {
        GeometryReader { geometry in
            Group {
                if let renderedImage = image ?? PhotoThumbnailCache.image(for: asset.localIdentifier) {
                    Image(uiImage: renderedImage).resizable().scaledToFill()
                }
                else { Color.white.opacity(0.08) }
            }
            .task(id: Int(geometry.size.width)) {
                guard image == nil else { return }
                let scale = UIScreen.main.scale
                image = await PhotoThumbnailLoader.image(
                    for: asset,
                    size: CGSize(width: geometry.size.width * scale, height: geometry.size.width * scale)
                )
            }
        }
    }
}

@MainActor
private enum PhotoThumbnailLoader {
    static func image(for asset: PHAsset, size: CGSize) async -> UIImage? {
        if let cached = PhotoThumbnailCache.image(for: asset.localIdentifier) {
            return cached
        }
        return await withCheckedContinuation { continuation in
            let options = PHImageRequestOptions()
            options.deliveryMode = .opportunistic
            options.resizeMode = .fast
            var resumed = false
            PHCachingImageManager.default().requestImage(
                for: asset,
                targetSize: size,
                contentMode: .aspectFill,
                options: options
            ) { image, info in
                let degraded = (info?[PHImageResultIsDegradedKey] as? Bool) == true
                guard !degraded, !resumed else { return }
                resumed = true
                if let image {
                    PhotoThumbnailCache.store(image, for: asset.localIdentifier)
                }
                continuation.resume(returning: image)
            }
        }
    }
}

@MainActor
private enum PhotoThumbnailCache {
    private static let cache = NSCache<NSString, UIImage>()

    static func image(for identifier: String) -> UIImage? {
        cache.object(forKey: identifier as NSString)
    }

    static func store(_ image: UIImage, for identifier: String) {
        cache.setObject(image, forKey: identifier as NSString)
    }
}

private enum PhotoAssetExporter {
    static func export(_ asset: PHAsset) async throws -> URL {
        guard let resource = PHAssetResource.assetResources(for: asset).first else {
            throw ComposerAttachmentPreparationError.unreadable
        }
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("GrottoPhotoImports", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let filename = ComposerAttachmentStager.sanitizedFilename(resource.originalFilename)
        let destination = directory.appendingPathComponent(filename)
        return try await withCheckedThrowingContinuation { continuation in
            PHAssetResourceManager.default().writeData(for: resource, toFile: destination, options: nil) { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: destination) }
            }
        }
    }
}
#endif
