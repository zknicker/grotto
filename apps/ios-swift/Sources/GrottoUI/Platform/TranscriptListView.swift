import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// What the list does with the viewport when newer items arrive at the tail.
enum TranscriptAppendBehavior {
    /// Show the newest item immediately — a send the reader just made.
    case snapToNewest
    /// Ease the newest item in — a delivery while the reader is at the tail.
    case animateToNewest
    /// Leave the viewport where it is — the reader has scrolled away.
    case stay
}

/// A one-shot request to bring an item into view, keyed by token so the same
/// item can be revealed twice.
struct TranscriptReveal: Equatable {
    let token: UUID
    let id: String
    let animated: Bool
}

/// One long-press menu action for a transcript row. The list owns the menu
/// presentation (see the coordinator's context-menu delegate methods) because
/// SwiftUI's `contextMenu` inside a flipped cell lifts an upside-down preview.
struct TranscriptMenuAction {
    let title: String
    let systemImage: String
    let handler: () -> Void
}

#if canImport(UIKit)

/// The bottom-anchored transcript substrate: a `UITableView` flipped with
/// `scaleY(-1)`, rows flipped back, data reversed so the newest item is row 0.
///
/// This is the mechanism production chat lists use instead of SwiftUI's
/// scroll-position primitives, and the reason is structural: the resting state
/// of this list is `contentOffset == -contentInset.top`, the scroll view's own
/// clamped origin. There is no bottom edge to resolve against in-flight layout
/// numbers, so the stranded-viewport class of bug — a transcript blank until
/// dragged, or strobing while assertions fight lazy estimation — cannot occur.
/// Measurement error is pushed to the far (visually top) end where it is
/// invisible, history prepends land beyond the viewport without moving it, and
/// a growing bottom inset (composer, keyboard) lifts the resting viewport with
/// the newest message still visible.
struct TranscriptListView<Item: Identifiable & Equatable, Row: View, Accessory: View>: UIViewRepresentable
where Item.ID == String {
    /// Chronological, oldest first — the same order the product stores.
    let items: [Item]
    /// Visual-top clearance (the chat header bar).
    let topInset: CGFloat
    /// Visual-bottom clearance (the composer, plus the keyboard when open).
    let bottomInset: CGFloat
    /// Shown past the oldest item (visual top); used for history loading.
    let showsAccessory: Bool
    /// Decides the viewport's reaction to newer items arriving at the tail.
    let onAppend: (_ items: [Item], _ isNearNewest: Bool) -> TranscriptAppendBehavior
    let reveal: TranscriptReveal?
    @Binding var isNearNewest: Bool
    /// Called for a tap that lands on the transcript itself; the Thread uses
    /// it to put the keyboard away. Scrolls and row controls are unaffected.
    var onContentTap: (() -> Void)? = nil
    /// Plays the app-opening settle (rise and fade, matching
    /// `OpeningEntranceSection.timeline`) once on mount. Owned here in UIKit
    /// because a SwiftUI opacity animation over a platform view can be dropped
    /// mid-flight by the table's own layout, freezing the fade partway.
    var animatesEntrance = false
    /// Long-press menu for a row; empty means no menu.
    var menuActions: (Item) -> [TranscriptMenuAction] = { _ in [] }
    @ViewBuilder let row: (Item) -> Row
    @ViewBuilder let accessory: () -> Accessory

    func makeUIView(context: Context) -> UITableView {
        let table = UITableView(frame: .zero, style: .plain)
        table.transform = CGAffineTransform(scaleX: 1, y: -1)
        table.separatorStyle = .none
        table.backgroundColor = .clear
        table.allowsSelection = false
        table.contentInsetAdjustmentBehavior = .never
        table.automaticallyAdjustsScrollIndicatorInsets = false
        table.insetsContentViewsToSafeArea = false
        table.preservesSuperviewLayoutMargins = false
        table.cellLayoutMarginsFollowReadableWidth = false
        table.scrollsToTop = false
        table.keyboardDismissMode = .interactive
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 72
        table.register(UITableViewCell.self, forCellReuseIdentifier: "row")
        table.dataSource = context.coordinator
        table.delegate = context.coordinator
        if #available(iOS 26, *) {
            // The system scroll edge effect computes its region from safe
            // areas the flipped table does not have; letting it paint washes
            // the whole viewport. The header's soft dissolve is drawn by the
            // chrome bar instead.
            table.topEdgeEffect.isHidden = true
            table.bottomEdgeEffect.isHidden = true
        }
        if onContentTap != nil {
            let tap = UITapGestureRecognizer(
                target: context.coordinator,
                action: #selector(TranscriptListCoordinator<Item, Row, Accessory>.contentTapped)
            )
            tap.cancelsTouchesInView = false
            table.addGestureRecognizer(tap)
        }
        context.coordinator.install(view: self, table: table)
        if animatesEntrance, !UIAccessibility.isReduceMotionEnabled {
            let flip = table.transform
            table.alpha = 0
            table.transform = flip.concatenating(CGAffineTransform(translationX: 0, y: 12))
            UIView.animate(
                withDuration: 0.5,
                delay: OpeningEntranceSection.timeline.delay,
                usingSpringWithDamping: 0.86,
                initialSpringVelocity: 0
            ) {
                table.alpha = 1
                table.transform = flip
            }
        }
        return table
    }

    func updateUIView(_ table: UITableView, context: Context) {
        context.coordinator.update(view: self, table: table)
    }

    func makeCoordinator() -> TranscriptListCoordinator<Item, Row, Accessory> {
        TranscriptListCoordinator()
    }
}

@MainActor
final class TranscriptListCoordinator<Item: Identifiable & Equatable, Row: View, Accessory: View>:
    NSObject, UITableViewDataSource, UITableViewDelegate
where Item.ID == String {
    private var view: TranscriptListView<Item, Row, Accessory>?
    private var items: [Item] = []
    private var showsAccessory = false
    private var appliedInsets: UIEdgeInsets?
    private var handledRevealToken: UUID?
    /// The row whose context menu is open, kept directly because the
    /// configuration identifier round-trips through `NSCopying` unreliably.
    private var menuIndexPath: IndexPath?
    private static var nearNewestTolerance: CGFloat { 80 }

    // MARK: Lifecycle from the representable

    func install(view: TranscriptListView<Item, Row, Accessory>, table: UITableView) {
        self.view = view
        items = view.items
        showsAccessory = view.showsAccessory
        applyInsets(view: view, table: table, wasNearNewest: true)
        table.reloadData()
    }

    func update(view: TranscriptListView<Item, Row, Accessory>, table: UITableView) {
        self.view = view

        let update = TranscriptListUpdate.classify(
            old: items.map(\.id),
            new: view.items.map(\.id)
        )
        let accessoryChanged = showsAccessory != view.showsAccessory
        let wasNearNewest = distanceFromNewest(table) < Self.nearNewestTolerance
        let oldCount = items.count
        items = view.items
        showsAccessory = view.showsAccessory

        applyInsets(view: view, table: table, wasNearNewest: wasNearNewest)

        switch update {
        case .refresh where !accessoryChanged:
            break
        case .append(let appended) where !accessoryChanged:
            UIView.performWithoutAnimation {
                table.insertRows(
                    at: (0..<appended).map { IndexPath(row: $0, section: 0) },
                    with: .none
                )
                table.layoutIfNeeded()
            }
            settleAppend(view: view, table: table, appended: appended, wasNearNewest: wasNearNewest)
        case .prepend(let prepended) where !accessoryChanged:
            UIView.performWithoutAnimation {
                table.insertRows(
                    at: (oldCount..<oldCount + prepended).map { IndexPath(row: $0, section: 0) },
                    with: .none
                )
            }
        default:
            table.reloadData()
        }

        reconfigureVisibleRows(table: table)
        performReveal(view: view, table: table)
    }

    // MARK: Anchoring

    /// Distance from the resting (newest) edge, in points. Zero at rest.
    private func distanceFromNewest(_ scrollView: UIScrollView) -> CGFloat {
        scrollView.contentOffset.y + scrollView.contentInset.top
    }

    private func applyInsets(
        view: TranscriptListView<Item, Row, Accessory>,
        table: UITableView,
        wasNearNewest: Bool
    ) {
        // Flipped mapping: the table's top inset renders at the visual bottom.
        let insets = UIEdgeInsets(
            top: view.bottomInset + 14, left: 0, bottom: view.topInset + 14, right: 0
        )
        guard insets != appliedInsets else { return }
        let isFirst = appliedInsets == nil
        appliedInsets = insets
        table.contentInset = insets
        table.verticalScrollIndicatorInsets = UIEdgeInsets(
            top: view.bottomInset, left: 0, bottom: view.topInset, right: 0
        )
        // A resting transcript rides an inset change: the composer or keyboard
        // growing must lift the newest message, not slide over it.
        if isFirst || (wasNearNewest && !table.isDragging && !table.isDecelerating) {
            table.contentOffset = CGPoint(x: 0, y: -insets.top)
        }
    }

    private func settleAppend(
        view: TranscriptListView<Item, Row, Accessory>,
        table: UITableView,
        appended: Int,
        wasNearNewest: Bool
    ) {
        let rest = CGPoint(x: 0, y: -table.contentInset.top)
        switch view.onAppend(view.items, wasNearNewest) {
        case .snapToNewest:
            table.contentOffset = rest
        case .animateToNewest:
            // In flipped space inserted rows appear in place; the ease-in is
            // staged by holding the viewport on the previous newest row and
            // releasing it toward rest, across everything that arrived.
            let insertedHeight = (0..<appended).reduce(CGFloat.zero) { height, row in
                height + table.rectForRow(at: IndexPath(row: row, section: 0)).height
            }
            table.contentOffset = CGPoint(x: 0, y: rest.y + insertedHeight)
            table.setContentOffset(rest, animated: true)
        case .stay:
            break
        }
    }

    private func performReveal(
        view: TranscriptListView<Item, Row, Accessory>,
        table: UITableView
    ) {
        guard let reveal = view.reveal, reveal.token != handledRevealToken else { return }
        handledRevealToken = reveal.token
        guard let index = items.lastIndex(where: { $0.id == reveal.id }) else { return }
        // The newest item's home is the resting edge, not the viewport center.
        guard index < items.count - 1 else {
            table.setContentOffset(
                CGPoint(x: 0, y: -table.contentInset.top),
                animated: reveal.animated
            )
            return
        }
        table.scrollToRow(
            at: IndexPath(row: items.count - 1 - index, section: 0),
            at: .middle,
            animated: reveal.animated
        )
    }

    /// Hosting configurations capture SwiftUI state by value, so every SwiftUI
    /// update re-hosts the rows that are on screen; off-screen rows pick up
    /// current state when they dequeue.
    private func reconfigureVisibleRows(table: UITableView) {
        for indexPath in table.indexPathsForVisibleRows ?? [] {
            guard let cell = table.cellForRow(at: indexPath) else { continue }
            configure(cell: cell, at: indexPath)
        }
    }

    // MARK: UITableViewDataSource

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        items.count + (showsAccessory ? 1 : 0)
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "row", for: indexPath)
        cell.selectionStyle = .none
        cell.backgroundColor = .clear
        configure(cell: cell, at: indexPath)
        return cell
    }

    private func configure(cell: UITableViewCell, at indexPath: IndexPath) {
        guard let view else { return }
        if indexPath.row >= items.count {
            cell.contentConfiguration = UIHostingConfiguration {
                view.accessory()
            }
            .margins(.vertical, 0)
            .margins(.horizontal, 16)
            .minSize(width: 0, height: 0)
        } else {
            let item = items[items.count - 1 - indexPath.row]
            cell.contentConfiguration = UIHostingConfiguration {
                view.row(item)
            }
            .margins(.vertical, 0)
            .margins(.horizontal, 16)
            .minSize(width: 0, height: 0)
        }
        // The counter-flip lives on the UIKit contentView, not inside the
        // hosted SwiftUI: the hosting view's own layer then renders upright,
        // so a context-menu interaction snapshots a readable preview. It is
        // applied *after* the configuration, because assigning one that the
        // cell cannot reuse — a brand-new cell, or a swap between the row and
        // accessory configurations — replaces `contentView` with a fresh one,
        // and a flip set beforehand would ride away on the discarded view,
        // leaving that row mirrored inside the flipped table.
        cell.contentView.transform = CGAffineTransform(scaleX: 1, y: -1)
    }

    // MARK: Context menus

    /// The system context menu lifts a snapshot of the pressed view, and the
    /// pressed cell is flipped — its lift renders upside down. These delegate
    /// methods substitute an upright preview: `drawHierarchy` on the flipped
    /// `contentView` ignores the view's own transform, and the targeted
    /// preview is anchored through the table's unflipped superview so the
    /// container cannot flip it back.
    func tableView(
        _ tableView: UITableView,
        contextMenuConfigurationForRowAt indexPath: IndexPath,
        point: CGPoint
    ) -> UIContextMenuConfiguration? {
        guard let view, indexPath.row < items.count else { return nil }
        let item = items[items.count - 1 - indexPath.row]
        let actions = view.menuActions(item)
        guard !actions.isEmpty else { return nil }
        menuIndexPath = indexPath
        return UIContextMenuConfiguration(
            identifier: indexPath as NSIndexPath,
            previewProvider: nil
        ) { _ in
            UIMenu(children: actions.map { action in
                UIAction(title: action.title, image: UIImage(systemName: action.systemImage)) { _ in
                    action.handler()
                }
            })
        }
    }

    func tableView(
        _ tableView: UITableView,
        previewForHighlightingContextMenuWithConfiguration configuration: UIContextMenuConfiguration
    ) -> UITargetedPreview? {
        uprightPreview(tableView: tableView, configuration: configuration)
    }

    func tableView(
        _ tableView: UITableView,
        previewForDismissingContextMenuWithConfiguration configuration: UIContextMenuConfiguration
    ) -> UITargetedPreview? {
        uprightPreview(tableView: tableView, configuration: configuration)
    }

    /// The custom lift is a snapshot, so the pressed cell would show twice;
    /// it hides for exactly the menu's lifetime.
    func tableView(
        _ tableView: UITableView,
        willDisplayContextMenu configuration: UIContextMenuConfiguration,
        animator: UIContextMenuInteractionAnimating?
    ) {
        guard let indexPath = menuIndexPath,
              let cell = tableView.cellForRow(at: indexPath)
        else { return }
        cell.contentView.isHidden = true
    }

    func tableView(
        _ tableView: UITableView,
        willEndContextMenuInteraction configuration: UIContextMenuConfiguration,
        animator: UIContextMenuInteractionAnimating?
    ) {
        guard let indexPath = menuIndexPath,
              let cell = tableView.cellForRow(at: indexPath)
        else { return }
        menuIndexPath = nil
        if let animator {
            animator.addCompletion { cell.contentView.isHidden = false }
        } else {
            cell.contentView.isHidden = false
        }
    }

    private func uprightPreview(
        tableView: UITableView,
        configuration: UIContextMenuConfiguration
    ) -> UITargetedPreview? {
        guard let indexPath = menuIndexPath,
              let cell = tableView.cellForRow(at: indexPath),
              let container = tableView.superview
        else { return nil }
        let content = cell.contentView
        let renderer = UIGraphicsImageRenderer(bounds: content.bounds)
        // `layer.render` composites the subtree without the root layer's own
        // transform, so the flipped contentView yields an upright image;
        // `drawHierarchy` bakes the flip in.
        let image = renderer.image { ctx in
            content.layer.render(in: ctx.cgContext)
        }
        let snapshot = UIImageView(image: image)
        let parameters = UIPreviewParameters()
        parameters.backgroundColor = .clear
        let center = content.convert(
            CGPoint(x: content.bounds.midX, y: content.bounds.midY),
            to: container
        )
        return UITargetedPreview(
            view: snapshot,
            parameters: parameters,
            target: UIPreviewTarget(container: container, center: center)
        )
    }

    // MARK: UITableViewDelegate

    @objc func contentTapped() {
        view?.onContentTap?()
    }

    func scrollViewDidScroll(_ scrollView: UIScrollView) {
        guard let view else { return }
        let near = distanceFromNewest(scrollView) < Self.nearNewestTolerance
        if view.isNearNewest != near {
            DispatchQueue.main.async { view.isNearNewest = near }
        }
    }
}

#else

/// macOS exists in this package only so the pure logic can run under
/// `swift test`; the app targets iOS. This stand-in keeps the SwiftUI callers
/// compiling with the same shape and no scroll management.
struct TranscriptListView<Item: Identifiable & Equatable, Row: View, Accessory: View>: View
where Item.ID == String {
    let items: [Item]
    let topInset: CGFloat
    let bottomInset: CGFloat
    let showsAccessory: Bool
    let onAppend: (_ items: [Item], _ isNearNewest: Bool) -> TranscriptAppendBehavior
    let reveal: TranscriptReveal?
    @Binding var isNearNewest: Bool
    var onContentTap: (() -> Void)? = nil
    var animatesEntrance = false
    var menuActions: (Item) -> [TranscriptMenuAction] = { _ in [] }
    @ViewBuilder let row: (Item) -> Row
    @ViewBuilder let accessory: () -> Accessory

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if showsAccessory {
                    accessory()
                }
                ForEach(items) { row($0) }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .defaultScrollAnchor(.bottom)
    }
}

#endif
