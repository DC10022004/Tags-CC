import Foundation

enum Log {
    // stderr va al StandardErrorPath del LaunchAgent (~/Library/Logs/tagscc.log),
    // que es la única forma de diagnosticar un agente sin interfaz.
    private static func emit(_ level: String, _ msg: String) {
        let ts = ISO8601DateFormatter().string(from: Date())
        FileHandle.standardError.write("[\(ts)] \(level) \(msg)\n".data(using: .utf8)!)
    }
    static func info(_ m: String) { emit("info ", m) }
    static func warn(_ m: String) { emit("warn ", m) }
}

/// Configuración de ~/.config/tagscc/config.json. Todo es opcional: una configuración
/// ausente o inválida nunca impide que el agente arranque (SDD §7).
struct Config: Codable {
    var intervalHours: Double = 4
    var minGapMinutes: Double = 90
    var autoDismissSeconds: Double = 25
    var corpusPath: String? = nil
    var levels: [String]? = nil

    static let path = (NSHomeDirectory() as NSString)
        .appendingPathComponent(".config/tagscc/config.json")

    static func load() -> Config {
        guard let data = FileManager.default.contents(atPath: path) else { return Config() }
        do {
            return try JSONDecoder().decode(Config.self, from: data)
        } catch {
            Log.warn("config.json inválido, se usan los valores por defecto: \(error.localizedDescription)")
            return Config()
        }
    }
}

/// Progreso de aprendizaje: cajas de Leitner. Local a la Mac y gitignored; si se
/// borra, el sistema arranca de cero sin errores (ADR 0002, SDD §1.4).
struct Progress: Codable {
    struct Entry: Codable {
        var box: Int = 1          // 1 = por aprender, 3 = dominado
        var seen: Int = 0
        var lastSeen: Date? = nil
        var dueAt: Date? = nil
    }
    var schema: Int = 1
    var lastShownAt: Date? = nil
    var entries: [String: Entry] = [:]
}

final class Store {
    private let path: String
    private(set) var progress: Progress

    init(path: String) {
        self.path = path
        let dir = (path as NSString).deletingLastPathComponent
        try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)

        if let data = FileManager.default.contents(atPath: path) {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601   // debe coincidir con save(), o todo
                                                      // estado leído parecería corrupto
            if let decoded = try? decoder.decode(Progress.self, from: data) {
                progress = decoded
            } else {
                // Un estado corrupto no debe bloquear el arranque: se aparta y se empieza
                // de cero, dejando el archivo para inspección (SDD §6).
                Log.warn("progress.json corrupto; se renombra a .bak y se empieza de cero")
                try? FileManager.default.removeItem(atPath: path + ".bak")
                try? FileManager.default.moveItem(atPath: path, toPath: path + ".bak")
                progress = Progress()
            }
        } else {
            progress = Progress()
        }
    }

    func markShown(_ id: String) {
        var e = progress.entries[id] ?? Progress.Entry()
        e.seen += 1
        e.lastSeen = Date()
        progress.entries[id] = e
        progress.lastShownAt = Date()
        save()
    }

    /// "Lo sé": sube de caja y aleja el vencimiento. "Repetir pronto": vuelve a la caja 1.
    func judge(_ id: String, known: Bool) {
        var e = progress.entries[id] ?? Progress.Entry()
        if known {
            e.box = min(3, e.box + 1)
            let days: Double = [1: 1, 2: 3, 3: 10][e.box] ?? 1   // cajas de Leitner: 1, 3 y 10 días
            e.dueAt = Date().addingTimeInterval(days * 86_400)
        } else {
            e.box = 1
            e.dueAt = Date().addingTimeInterval(3_600)
        }
        progress.entries[id] = e
        save()
    }

    func isMastered(_ id: String, now: Date = Date()) -> Bool {
        guard let e = progress.entries[id] else { return false }
        guard e.box >= 3, let due = e.dueAt else { return false }
        return due > now
    }

    var lastShownAt: Date? { progress.lastShownAt }

    private func save() {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(progress) else { return }
        // Escritura atómica: temporal + rename, para no dejar un estado a medias si el
        // proceso muere a mitad de la escritura (SDD §6).
        let tmp = path + ".tmp"
        do {
            try data.write(to: URL(fileURLWithPath: tmp))
            _ = try FileManager.default.replaceItemAt(URL(fileURLWithPath: path),
                                                     withItemAt: URL(fileURLWithPath: tmp))
        } catch {
            try? data.write(to: URL(fileURLWithPath: path))   // primera escritura: no hay qué reemplazar
            try? FileManager.default.removeItem(atPath: tmp)
        }
    }
}
