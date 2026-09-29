import AppKit

/// Los tres disparadores y el debounce (SDD §3.2 y §3.3).
///
/// El timer de intervalo es el disparador *garantizado*. El desbloqueo de pantalla usa
/// `com.apple.screenIsUnlocked`, que Apple no documenta y podría desaparecer en una
/// versión de macOS: es una mejora, no la base. Si deja de emitirse, el producto sigue
/// cumpliendo "cada 3–5 horas".
final class Scheduler {
    private let config: Config
    private let store: Store
    private let onFire: (_ explicit: Bool) -> Void
    private var timer: Timer?
    private var pausedUntil: Date?

    init(config: Config, store: Store, onFire: @escaping (_ explicit: Bool) -> Void) {
        self.config = config
        self.store = store
        self.onFire = onFire
    }

    func start() {
        let dnc = DistributedNotificationCenter.default()
        dnc.addObserver(self, selector: #selector(screenUnlocked),
                        name: NSNotification.Name("com.apple.screenIsUnlocked"), object: nil)

        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(didWake),
            name: NSWorkspace.didWakeNotification, object: nil)

        let interval = max(config.intervalHours, 0.05) * 3600
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.request(reason: "timer")
        }
        timer?.tolerance = 300      // el sistema puede agrupar el despertar: ahorra energía

        Log.info("scheduler activo · intervalo \(config.intervalHours) h · gap mínimo \(config.minGapMinutes) min")
    }

    @objc private func screenUnlocked() { request(reason: "desbloqueo") }
    @objc private func didWake() { request(reason: "despertar") }

    func pause(hours: Double) {
        pausedUntil = Date().addingTimeInterval(hours * 3600)
        Log.info("pausado hasta \(pausedUntil!)")
    }

    /// Disparo explícito del usuario desde la barra de menú: ignora el debounce y la
    /// pausa, porque lo pidió a propósito.
    func fireExplicit() { onFire(true) }

    private func request(reason: String) {
        if let until = pausedUntil, Date() < until {
            Log.info("\(reason): suprimido, en pausa")
            return
        }
        // Debounce. Sin esto, desbloquear la Mac quince veces al día daría quince
        // pop-ups y el sistema se volvería algo que se desinstala (SDD §3.3).
        if let last = store.lastShownAt {
            let minutes = Date().timeIntervalSince(last) / 60
            if minutes < config.minGapMinutes {
                Log.info("\(reason): suprimido por debounce (\(Int(minutes)) min < \(Int(config.minGapMinutes)))")
                return
            }
        }
        Log.info("\(reason): mostrando tarjeta")
        onFire(false)
    }
}
