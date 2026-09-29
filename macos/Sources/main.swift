import AppKit

/// Agente sin icono en el Dock (LSUIElement en el Info.plist): vive en la barra de menú.
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var config = Config.load()
    private var corpus: Corpus!
    private var store: Store!
    private var scheduler: Scheduler!
    private var menuBar: MenuBarController!
    private let card = CardPanel()

    /// Índice dentro del orden por id, para que "Siguiente" avance de forma predecible
    /// en lugar de saltar al azar.
    private var cursor: Int?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Los vectores de conformidad se comprueban al arrancar: una divergencia con el
        // cliente de iOS no falla sola, así que hay que hacerla visible (SDD §2.2).
        for problem in Selector.verifyConformance() { Log.warn("CONFORMIDAD: \(problem)") }

        let corpusPath = Corpus.resolvePath(configured: config.corpusPath)
        corpus = Corpus(path: corpusPath)
        store = Store(path: Self.statePath())
        Log.info("corpus: \(corpusPath)")
        Log.info("estado: \(Self.statePath())")

        scheduler = Scheduler(config: config, store: store) { [weak self] _ in
            self?.showScheduled()
        }
        menuBar = MenuBarController(
            corpus: corpus, store: store,
            onShow: { [weak self] tag in
                if let tag { self?.present(tag) } else { self?.showScheduled() }
            },
            onNext: { [weak self] in self?.advance() },
            onPause: { [weak self] hours in self?.scheduler.pause(hours: hours) })

        scheduler.start()

        // Al arrancar el LaunchAgent (login, o reinstalación) se muestra una tarjeta,
        // sujeta al debounce, para que el primer arranque no quede en silencio.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
            self?.showScheduledRespectingGap()
        }
    }

    // MARK: - Presentación

    /// El tag que corresponde a este momento según la selección determinista, con el
    /// sesgo por progreso acotado a 3 saltos (SDD §2.3): la Mac se salta lo ya dominado
    /// sin alejarse demasiado de lo que muestra el iPhone.
    private func scheduledTag() -> Tag? {
        corpus.reloadIfNeeded()
        let tags = corpus.tags
        guard !tags.isEmpty,
              let base = Selector.pick(version: corpus.version, date: Date(),
                                       intervalHours: config.intervalHours, count: tags.count)
        else { return nil }

        var index = base
        for _ in 0..<3 {
            guard store.isMastered(tags[index].id) else { break }
            index = (index + 1) % tags.count
        }
        cursor = index
        return tags[index]
    }

    private func showScheduled() {
        guard let tag = scheduledTag() else {
            Log.warn("no hay tarjeta que mostrar (corpus vacío o ilegible)")
            return
        }
        present(tag)
    }

    private func showScheduledRespectingGap() {
        if let last = store.lastShownAt,
           Date().timeIntervalSince(last) / 60 < config.minGapMinutes {
            Log.info("arranque: suprimido por debounce")
            return
        }
        showScheduled()
    }

    private func advance() {
        let tags = corpus.tags
        guard !tags.isEmpty else { return }
        let start = cursor ?? 0
        cursor = (start + 1) % tags.count
        present(tags[cursor!])
    }

    private func present(_ tag: Tag) {
        store.markShown(tag.id)
        card.show(tag: tag, autoDismissSeconds: config.autoDismissSeconds,
                  onKnown: { [weak self] in self?.store.judge(tag.id, known: true) },
                  onRepeat: { [weak self] in self?.store.judge(tag.id, known: false) })
    }

    private static func statePath() -> String {
        // El estado vive junto al repo si build.sh dejó su ruta; si no, en Application Support.
        if let root = Bundle.main.object(forInfoDictionaryKey: "TCCRepoRoot") as? String,
           FileManager.default.fileExists(atPath: root) {
            return (root as NSString).appendingPathComponent("state/progress.json")
        }
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("TagsCC/progress.json").path
    }
}

// El código en el nivel superior solo se permite en main.swift: de ahí el nombre.
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)      // sin icono en el Dock, sin robar el foco
app.run()
