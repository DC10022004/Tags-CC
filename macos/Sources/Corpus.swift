import Foundation

struct Tag: Codable, Identifiable, Equatable {
    let id: String
    let term: String
    let category: String
    let level: String
    let summary: String
    let body: String
    let example: String?
    let why: String
    let source: String
    let related: [String]?
    let updated: String
}

struct CorpusFile: Codable {
    let schema: Int
    let version: String
    let count: Int
    let tags: [Tag]
}

/// Carga dist/tags.json y lo recarga cuando cambia en disco, para que editar una
/// tarjeta y correr el build se vea sin reiniciar la app.
final class Corpus {
    private(set) var file: CorpusFile?
    private var loadedMTime: Date?
    private let path: String

    init(path: String) {
        self.path = path
        reloadIfNeeded()
    }

    var version: String { file?.version ?? "vacio" }
    var tags: [Tag] { file?.tags ?? [] }

    func reloadIfNeeded() {
        let attrs = try? FileManager.default.attributesOfItem(atPath: path)
        let mtime = attrs?[.modificationDate] as? Date
        if let mtime, let loaded = loadedMTime, mtime == loaded { return }

        guard let data = FileManager.default.contents(atPath: path) else {
            Log.warn("corpus no encontrado en \(path)")
            return
        }
        do {
            let decoded = try JSONDecoder().decode(CorpusFile.self, from: data)
            file = decoded
            loadedMTime = mtime
            Log.info("corpus cargado: \(decoded.count) tarjetas, versión \(decoded.version)")
        } catch {
            // Se conserva el último corpus válido en memoria en lugar de quedarse
            // sin nada por un JSON a medio escribir (SDD §6).
            Log.warn("corpus ilegible, se conserva el anterior: \(error.localizedDescription)")
        }
    }

    func tag(id: String) -> Tag? { tags.first { $0.id == id } }

    /// Ruta del corpus: config explícita, luego la ruta del repo que build.sh
    /// escribió en el Info.plist, y como último recurso la copia dentro del bundle.
    static func resolvePath(configured: String?) -> String {
        if let configured, !configured.isEmpty {
            return (configured as NSString).expandingTildeInPath
        }
        if let embedded = Bundle.main.object(forInfoDictionaryKey: "TCCCorpusPath") as? String,
           FileManager.default.fileExists(atPath: embedded) {
            return embedded
        }
        if let bundled = Bundle.main.path(forResource: "tags", ofType: "json") {
            return bundled
        }
        return (configured ?? "")
    }
}
