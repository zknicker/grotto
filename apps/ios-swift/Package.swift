// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "GrottoIOS",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "GrottoModels", targets: ["GrottoModels"]),
        .library(name: "GrottoTransport", targets: ["GrottoTransport"]),
        .library(name: "GrottoUI", targets: ["GrottoUI"]),
    ],
    targets: [
        .target(
            name: "GrottoModels",
            path: "Sources/GrottoModels",
            swiftSettings: [.enableUpcomingFeature("StrictConcurrency")]
        ),
        .target(
            name: "GrottoTransport",
            dependencies: ["GrottoModels"],
            path: "Sources/GrottoTransport",
            swiftSettings: [.enableUpcomingFeature("StrictConcurrency")]
        ),
        .target(
            name: "GrottoUI",
            dependencies: ["GrottoModels"],
            path: "Sources/GrottoUI",
            resources: [.process("Resources")],
            swiftSettings: [.enableUpcomingFeature("StrictConcurrency")]
        ),
        .testTarget(
            name: "GrottoModelsTests",
            dependencies: ["GrottoModels"],
            path: "Tests/GrottoModelsTests",
            swiftSettings: [.enableUpcomingFeature("StrictConcurrency")]
        ),
        .testTarget(
            name: "GrottoTransportTests",
            dependencies: ["GrottoTransport"],
            path: "Tests/GrottoTransportTests",
            swiftSettings: [.enableUpcomingFeature("StrictConcurrency")]
        ),
        .testTarget(
            name: "GrottoUITests",
            dependencies: ["GrottoUI"],
            path: "Tests/GrottoUITests",
            swiftSettings: [.enableUpcomingFeature("StrictConcurrency")]
        ),
    ]
)
