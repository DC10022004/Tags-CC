import AppKit

final class MenuBarController: NSObject {
    private let item: NSStatusItem
    private let corpus: Corpus
    private let store: Store
    private let onShow: (Tag?) -> Void
    private let onNext: () -> Void
    private let onPause: (Double) -> Void

    init(corpus: Corpus, store: Store,
         onShow: @escaping (Tag?) -> Void, onNext: @escaping () -> Void,
         onPause: @escaping (Double) -> Void) {
        self.corpus = corpus
        self.store = store
        self.onShow = onShow
        self.onNext = onNext
        self.onPause = onPause
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        super.init()

        if let button = item.button {
            button.image = NSImage(systemSymbolName: "tag", accessibilityDescription: "Tags CC")
            button.image?.isTemplate = true
        }
        item.menu = buildMenu()
    }

    /// El menú se reconstruye en cada apertura para reflejar el corpus recargado y el
    /// progreso al día.
    private func buildMenu() -> NSMenu {
        let menu = NSMenu()
        menu.delegate = self
        return menu
    }

    private func rebuild(_ menu: NSMenu) {
        menu.removeAllItems()
        corpus.reloadIfNeeded()

        if corpus.tags.isEmpty {
            let warning = NSMenuItem(title: "Sin corpus — corre: node pipeline/build.mjs", action: nil, keyEquivalent: "")
            warning.isEnabled = false
            menu.addItem(warning)
            menu.addItem(.separator())
            menu.addItem(NSMenuItem(title: "Salir", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
            return
        }

        menu.addItem(withTitle: "Tag actual", action: #selector(showCurrent), keyEquivalent: "").target = self
        menu.addItem(withTitle: "Siguiente tag", action: #selector(next), keyEquivalent: "").target = self
        menu.addItem(.separator())

        // Explorar por categoría: más útil que un campo de búsqueda para 12–150 tarjetas,
        // y no necesita ventana propia.
        let browse = NSMenuItem(title: "Explorar", action: nil, keyEquivalent: "")
        let browseMenu = NSMenu()
        let byCategory = Dictionary(grouping: corpus.tags, by: \.category)
        for category in byCategory.keys.sorted() {
            let sub = NSMenuItem(title: category, action: nil, keyEquivalent: "")
            let subMenu = NSMenu()
            for tag in byCategory[category]!.sorted(by: { $0.term < $1.term }) {
                let mi = NSMenuItem(title: tag.term, action: #selector(showSpecific(_:)), keyEquivalent: "")
                mi.target = self
                mi.representedObject = tag
                if store.isMastered(tag.id) { mi.state = .on }   // ✓ = ya lo marcaste como sabido
                subMenu.addItem(mi)
            }
            sub.submenu = subMenu
            browseMenu.addItem(sub)
        }
        browse.submenu = browseMenu
        menu.addItem(browse)

        let pause = NSMenuItem(title: "Pausar", action: nil, keyEquivalent: "")
        let pauseMenu = NSMenu()
        for (label, hours) in [("1 hora", 1.0), ("4 horas", 4.0), ("Hasta mañana", 12.0)] {
            let mi = NSMenuItem(title: label, action: #selector(pauseFor(_:)), keyEquivalent: "")
            mi.target = self
            mi.representedObject = hours
            pauseMenu.addItem(mi)
        }
        pause.submenu = pauseMenu
        menu.addItem(pause)

        menu.addItem(.separator())
        let mastered = corpus.tags.filter { store.isMastered($0.id) }.count
        let status = NSMenuItem(title: "\(mastered)/\(corpus.tags.count) marcadas como sabidas · v\(corpus.version)",
                                action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)
        menu.addItem(withTitle: "Salir", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    }

    @objc private func showCurrent() { onShow(nil) }
    @objc private func next() { onNext() }
    @objc private func showSpecific(_ sender: NSMenuItem) { onShow(sender.representedObject as? Tag) }
    @objc private func pauseFor(_ sender: NSMenuItem) { onPause(sender.representedObject as? Double ?? 1) }
}

extension MenuBarController: NSMenuDelegate {
    func menuNeedsUpdate(_ menu: NSMenu) { rebuild(menu) }
}
