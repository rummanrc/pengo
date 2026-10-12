import Foundation

enum OfflineFiles {
    static func resolve(_ url: URL, root: URL) -> URL? {
        guard url.scheme == "pengo", url.host == "app",
              let path = url.path.removingPercentEncoding,
              !path.contains("\0"), !path.split(separator: "/").contains("..") else { return nil }
        let base = root.resolvingSymlinksInPath().standardizedFileURL
        // Reject symlinks even if the requested leaf does not yet exist; URL's
        // resolvingSymlinksInPath can leave those parent links unresolved.
        var candidate = base
        for component in path.split(separator: "/") {
            candidate.appendPathComponent(String(component))
            guard (try? FileManager.default.destinationOfSymbolicLink(atPath: candidate.path)) == nil else { return nil }
        }
        let file = base.appendingPathComponent(path == "/" ? "index.html" : path)
            .resolvingSymlinksInPath().standardizedFileURL
        guard file.path.hasPrefix(base.path + "/") else { return nil }
        return file
    }

    static func mimeType(_ url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "html": return "text/html"
        case "js": return "application/javascript"
        case "css": return "text/css"
        case "json", "webmanifest": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "md", "txt": return "text/plain"
        default: return "application/octet-stream"
        }
    }
}
