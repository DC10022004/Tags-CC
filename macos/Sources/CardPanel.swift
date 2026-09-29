import AppKit
import SwiftUI

// MARK: - Vista

struct CardView: View {
    let tag: Tag
    let onKnown: () -> Void
    let onRepeat: () -> Void
    let onSource: () -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(tag.term)
                        .font(.system(size: 20, weight: .semibold, design: .rounded))
                    HStack(spacing: 6) {
                        Chip(tag.category)
                        Chip(tag.level)
                    }
                }
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .help("Cerrar (Esc)")
            }

            Text(tag.summary)
                .font(.system(size: 14, weight: .medium))
                .fixedSize(horizontal: false, vertical: true)

            Text(tag.body.trimmingCharacters(in: .whitespacesAndNewlines))
                .font(.system(size: 12.5))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            if let ex = tag.example?.trimmingCharacters(in: .whitespacesAndNewlines), !ex.isEmpty {
                Text(ex)
                    .font(.system(size: 11.5, design: .monospaced))
                    .textSelection(.enabled)          // se puede copiar el comando y usarlo
                    .lineLimit(nil)
                    .fixedSize(horizontal: false, vertical: true)   // sin esto el ejemplo
                                                                    // se trunca a una línea
                    .multilineTextAlignment(.leading)
                    .padding(9)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 7))
            }

            HStack(spacing: 5) {
                Image(systemName: "arrow.turn.down.right").font(.system(size: 9))
                Text(tag.why).font(.system(size: 11.5)).italic()
            }
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)

            Divider().padding(.top, 2)

            HStack {
                Button("Lo sé", action: onKnown)
                Button("Repetir pronto", action: onRepeat)
                Spacer()
                Button("Ver fuente", action: onSource).buttonStyle(.plain)
                    .foregroundStyle(.tint).font(.system(size: 11.5))
            }
            .controlSize(.small)
        }
        .padding(16)
        .frame(width: 380)
        // Sin colores fijos: hereda el material del panel y respeta modo claro y oscuro.
    }
}

private struct Chip: View {
    let text: String
    init(_ t: String) { text = t }
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(Color.primary.opacity(0.08), in: Capsule())
    }
}

// MARK: - Panel

/// Ventana de la tarjeta. Es un NSPanel no-activante a propósito: aparece sin robar el
/// foco del teclado, así que si estás escribiendo sigues escribiendo (SDD §3.4).
/// Además no requiere ningún permiso del sistema, que es la razón por la que es el
/// mecanismo principal y no una notificación (ADR 0004).
final class CardPanel: NSObject {
    private var panel: NSPanel?
    private var dismissTimer: Timer?

    func show(tag: Tag, autoDismissSeconds: Double,
              onKnown: @escaping () -> Void, onRepeat: @escaping () -> Void) {
        close()

        let view = CardView(
            tag: tag,
            onKnown: { [weak self] in onKnown(); self?.close() },
            onRepeat: { [weak self] in onRepeat(); self?.close() },
            onSource: { if let u = URL(string: tag.source) { NSWorkspace.shared.open(u) } },
            onClose: { [weak self] in self?.close() }
        )

        let hosting = NSHostingView(rootView: view)
        hosting.layoutSubtreeIfNeeded()
        let size = hosting.fittingSize

        let p = KeyablePanel(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.nonactivatingPanel, .titled, .fullSizeContentView, .closable],
            backing: .buffered, defer: false)
        p.onEscape = { [weak self] in self?.close() }
        p.titleVisibility = .hidden
        p.titlebarAppearsTransparent = true
        p.isMovableByWindowBackground = true
        p.standardWindowButton(.closeButton)?.isHidden = true
        p.standardWindowButton(.miniaturizeButton)?.isHidden = true
        p.standardWindowButton(.zoomButton)?.isHidden = true
        p.level = .floating
        p.hidesOnDeactivate = false
        p.isFloatingPanel = true
        p.becomesKeyOnlyIfNeeded = true
        p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        p.contentView = hosting
        p.setFrame(Self.bottomRightFrame(size: size), display: true)
        p.alphaValue = 0
        p.orderFrontRegardless()

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.18
            p.animator().alphaValue = 1
        }

        panel = p
        if autoDismissSeconds > 0 {
            dismissTimer = Timer.scheduledTimer(withTimeInterval: autoDismissSeconds, repeats: false) { [weak self] _ in
                self?.close()
            }
        }
    }

    /// Esquina inferior derecha de la pantalla donde está el cursor, respetando el Dock.
    private static func bottomRightFrame(size: NSSize) -> NSRect {
        let screen = NSScreen.screens.first { NSMouseInRect(NSEvent.mouseLocation, $0.frame, false) }
            ?? NSScreen.main
        guard let visible = screen?.visibleFrame else {
            return NSRect(origin: NSPoint(x: 100, y: 100), size: size)
        }
        let margin: CGFloat = 20
        return NSRect(x: visible.maxX - size.width - margin,
                      y: visible.minY + margin,
                      width: size.width, height: size.height)
    }

    func close() {
        dismissTimer?.invalidate()
        dismissTimer = nil
        guard let p = panel else { return }
        panel = nil
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.12
            p.animator().alphaValue = 0
        }, completionHandler: { p.orderOut(nil) })
    }

    var isVisible: Bool { panel != nil }
}

/// Un panel no-activante no recibe cancelOperation por la vía normal, así que Esc se
/// intercepta en keyDown.
private final class KeyablePanel: NSPanel {
    var onEscape: (() -> Void)?
    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53 { onEscape?(); return }   // 53 = Esc
        super.keyDown(with: event)
    }
    override var canBecomeKey: Bool { true }
}
