#if os(iOS)
@preconcurrency import AVFoundation
import SwiftUI
import UIKit

struct CameraCaptureView: View {
    let onCancel: @MainActor @Sendable () -> Void
    let onCapture: @MainActor @Sendable (Data) -> Void

    @State private var captureRequest = 0
    @State private var cameraPosition: AVCaptureDevice.Position = .back
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.black

            if AVCaptureDevice.default(for: .video) == nil {
                unavailableCamera
            } else {
                CameraPreview(
                    captureRequest: $captureRequest,
                    position: $cameraPosition,
                    onCapture: onCapture,
                    onError: { errorMessage = $0.localizedDescription }
                )
            }

            VStack {
                Spacer()
                cameraControls
            }
        }
        .alert("Camera unavailable", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "The camera could not start.")
        }
        .preferredColorScheme(.dark)
    }

    private var unavailableCamera: some View {
        ContentUnavailableView(
            "Camera unavailable",
            systemImage: "camera.fill",
            description: Text("Camera capture requires a physical iPhone.")
        )
        .foregroundStyle(.white)
    }

    /// Matches the photo portal: floating controls on the card's floor, chevron bottom-leading.
    private var cameraControls: some View {
        HStack {
            Button(action: onCancel) {
                Image(systemName: "chevron.left")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: .circle)
                    .overlay { Circle().stroke(.white.opacity(0.22), lineWidth: 0.5) }
                    .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close camera")
            Spacer()
            Button {
                captureRequest += 1
            } label: {
                Circle()
                    .stroke(.white, lineWidth: 4)
                    .frame(width: 70, height: 70)
                    .overlay { Circle().fill(.white).padding(6) }
            }
            .buttonStyle(.plain)
            .disabled(AVCaptureDevice.default(for: .video) == nil)
            .accessibilityLabel("Take photo")
            Spacer()
            Menu {
                Button {
                    cameraPosition = cameraPosition == .back ? .front : .back
                } label: {
                    Label("Switch camera", systemImage: "arrow.triangle.2.circlepath.camera")
                }
            } label: {
                GrottoIcon(.more, size: 22, weight: 2)
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: .circle)
                    .overlay { Circle().stroke(.white.opacity(0.22), lineWidth: 0.5) }
                    .shadow(color: .black.opacity(0.35), radius: 10, y: 4)
            }
            .buttonStyle(.plain)
            .disabled(AVCaptureDevice.default(for: .video) == nil)
            .accessibilityLabel("Camera options")
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }

}

private struct CameraPreview: UIViewRepresentable {
    @Binding var captureRequest: Int
    @Binding var position: AVCaptureDevice.Position
    let onCapture: @MainActor @Sendable (Data) -> Void
    let onError: @MainActor @Sendable (Error) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture, onError: onError)
    }

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        context.coordinator.connect(to: view, position: position)
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {
        if context.coordinator.position != position {
            context.coordinator.changeCamera(to: position)
        }
        if context.coordinator.lastCaptureRequest != captureRequest {
            context.coordinator.lastCaptureRequest = captureRequest
            context.coordinator.capture()
        }
    }

    static func dismantleUIView(_ view: PreviewView, coordinator: Coordinator) {
        coordinator.stop()
    }

    final class Coordinator: NSObject, AVCapturePhotoCaptureDelegate, @unchecked Sendable {
        private let session = AVCaptureSession()
        private let photoOutput = AVCapturePhotoOutput()
        private let sessionQueue = DispatchQueue(label: "build.grotto.ios.camera-session")
        private let onCapture: @MainActor (Data) -> Void
        private let onError: @MainActor (Error) -> Void
        private weak var preview: PreviewView?
        private(set) var position: AVCaptureDevice.Position = .back
        var lastCaptureRequest = 0

        init(onCapture: @escaping @MainActor (Data) -> Void, onError: @escaping @MainActor (Error) -> Void) {
            self.onCapture = onCapture
            self.onError = onError
        }

        @MainActor
        func connect(to preview: PreviewView, position: AVCaptureDevice.Position) {
            self.preview = preview
            preview.previewLayer.videoGravity = .resizeAspectFill
            preview.previewLayer.session = session
            configure(position: position)
        }

        func changeCamera(to position: AVCaptureDevice.Position) {
            configure(position: position)
        }

        func capture() {
            sessionQueue.async { [photoOutput] in
                guard photoOutput.connection(with: .video) != nil else { return }
                photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
            }
        }

        func stop() {
            sessionQueue.async { [session] in
                if session.isRunning { session.stopRunning() }
            }
        }

        private func configure(position: AVCaptureDevice.Position) {
            Task { [weak self] in
                guard let self else { return }
                guard await Self.cameraAuthorized() else {
                    await self.report(CameraCaptureError.notAuthorized)
                    return
                }
                self.sessionQueue.async { [weak self] in
                    guard let self else { return }
                    do {
                        try self.configureSession(position: position)
                    } catch {
                        Task { await self.report(error) }
                    }
                }
            }
        }

        private func configureSession(position: AVCaptureDevice.Position) throws {
            guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
                ?? AVCaptureDevice.default(for: .video)
            else { throw CameraCaptureError.unavailable }

            session.beginConfiguration()
            defer { session.commitConfiguration() }
            session.inputs.forEach(session.removeInput)
            let input = try AVCaptureDeviceInput(device: camera)
            guard session.canAddInput(input) else { throw CameraCaptureError.configurationFailed }
            session.addInput(input)
            if session.outputs.isEmpty {
                guard session.canAddOutput(photoOutput) else { throw CameraCaptureError.configurationFailed }
                session.addOutput(photoOutput)
            }
            session.sessionPreset = .photo
            self.position = camera.position
            if !session.isRunning { session.startRunning() }
        }

        private static func cameraAuthorized() async -> Bool {
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized: true
            case .notDetermined: await AVCaptureDevice.requestAccess(for: .video)
            default: false
            }
        }

        private func report(_ error: Error) async {
            await onError(error)
        }

        func photoOutput(
            _ output: AVCapturePhotoOutput,
            didFinishProcessingPhoto photo: AVCapturePhoto,
            error: Error?
        ) {
            if let error {
                Task { await report(error) }
                return
            }
            guard let data = photo.fileDataRepresentation() else {
                Task { await report(CameraCaptureError.captureFailed) }
                return
            }
            Task { @MainActor in onCapture(data) }
        }
    }
}

private final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

private enum CameraCaptureError: LocalizedError {
    case notAuthorized
    case unavailable
    case configurationFailed
    case captureFailed

    var errorDescription: String? {
        switch self {
        case .notAuthorized: "Allow camera access in Settings to take a photo."
        case .unavailable: "This device does not have an available camera."
        case .configurationFailed: "The camera could not be configured."
        case .captureFailed: "The photo could not be captured."
        }
    }
}
#endif
