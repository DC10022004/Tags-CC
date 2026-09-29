import Foundation

/// Selección determinista compartida con el cliente de iOS.
/// Especificación normativa: docs/SDD.md §2 y docs/adr/0003.
/// Cualquier cambio acá debe replicarse en ios/TagsCC.scriptable.js, o los dos
/// dispositivos mostrarán tags distintos sin que nada falle visiblemente.
enum Selector {

    /// FNV-1a de 32 bits. Elegido por portabilidad, no por calidad: seis líneas
    /// idénticas en Swift y en JavaScript, sin dependencias.
    static func fnv1a32(_ s: String) -> UInt32 {
        var h: UInt32 = 0x811c9dc5
        for b in Array(s.utf8) {
            h ^= UInt32(b)
            h = h &* 0x01000193          // &* es obligatorio: el desbordamiento es parte del algoritmo
        }
        return h
    }

    /// Ventana horaria del día, en hora local. Ver SDD §2.1.
    static func slot(at date: Date, intervalHours: Double, calendar: Calendar = .current) -> Int {
        let startOfDay = calendar.startOfDay(for: date)
        let minutes = date.timeIntervalSince(startOfDay) / 60
        return Int(floor(minutes / (intervalHours * 60)))
    }

    static func dateKey(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Índice del tag que corresponde a este momento. Mismas entradas -> mismo
    /// resultado en ambos dispositivos, sin comunicación.
    static func pick(version: String, date: Date, intervalHours: Double, count: Int,
                     calendar: Calendar = .current) -> Int? {
        guard count > 0 else { return nil }      // corpus vacío: no se divide por cero (SDD §6)
        let s = slot(at: date, intervalHours: intervalHours, calendar: calendar)
        let key = "\(version)|\(dateKey(date, calendar: calendar))|\(s)"
        return Int(fnv1a32(key) % UInt32(count))
    }

    /// Vectores de conformidad del SDD §2.2. Los dos primeros son los valores
    /// canónicos de la especificación FNV-1a: comprueban que el algoritmo es el
    /// correcto, no solo que Swift y JS coinciden entre sí.
    static func verifyConformance() -> [String] {
        let vectors: [(String, UInt32)] = [
            ("", 0x811c9dc5),
            ("a", 0xe40c292c),
            ("tags-cc", 0x4022b04d),
            ("2026-09-28.1|2026-09-28|3", 0x35ea280f),
        ]
        return vectors.compactMap { input, expected in
            let got = fnv1a32(input)
            guard got != expected else { return nil }
            return "fnv1a32(\(input.debugDescription)) dio 0x\(String(got, radix: 16)), se esperaba 0x\(String(expected, radix: 16))"
        }
    }
}
