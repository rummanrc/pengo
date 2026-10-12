import UIKit
import WebKit
import UniformTypeIdentifiers

final class OfflineSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    init(root: URL) { self.root = root }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, let file = OfflineFiles.resolve(url, root: root),
              var data = try? Data(contentsOf: file) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        // Enforce offline subresources even if a study-data string contains a URL.
        if file.pathExtension == "html", let html = String(data: data, encoding: .utf8) {
            let policy = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-src 'none'\">"
            data = Data(html.replacingOccurrences(of: "<head>", with: "<head>" + policy).utf8)
        }
        task.didReceive(URLResponse(url: url, mimeType: OfflineFiles.mimeType(file), expectedContentLength: data.count, textEncodingName: "utf-8"))
        task.didReceive(data)
        task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) { }
}

/// A weak proxy prevents WKUserContentController from retaining its controller.
final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UIDocumentPickerDelegate {
    private var web: WKWebView!
    private let reminders = StudyReminders()
    private var pageReady = false
    private var homePending = false
    private var exportURL: URL?
    private var dark = false
    override var preferredStatusBarStyle: UIStatusBarStyle { dark ? .lightContent : .darkContent }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 250/255, green: 249/255, blue: 245/255, alpha: 1)
        guard let root = Bundle.main.url(forResource: "www", withExtension: nil),
              let bridgeURL = Bundle.main.url(forResource: "bridge", withExtension: "js"),
              let bridge = try? String(contentsOf: bridgeURL, encoding: .utf8) else {
            let label = UILabel(frame: view.bounds)
            label.text = "Missing app assets. Run python3 scripts/build_ios.py --assets-only, then rebuild."
            label.numberOfLines = 0
            view.addSubview(label)
            return
        }
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.setURLSchemeHandler(OfflineSchemeHandler(root: root), forURLScheme: "pengo")
        config.userContentController.add(WeakScriptHandler(self), name: "pengo")
        config.userContentController.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = view.backgroundColor
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) {
            #if DEBUG
            web.isInspectable = true
            #endif
        }
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.topAnchor), web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor), web.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        NotificationCenter.default.addObserver(self, selector: #selector(activate), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(activate), name: UIApplication.significantTimeChangeNotification, object: nil)
        web.load(URLRequest(url: URL(string: "pengo://app/index.html")!))
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    @objc private func activate() {
        reminders.refresh { [weak self] in self?.publishReminders(message: "") }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageReady = true
        activate()
        if homePending { openHome() }
    }

    func openHome() {
        guard pageReady else { homePending = true; return }
        homePending = false
        web.evaluateJavaScript("location.hash = '#/';", completionHandler: nil)
    }

    private func jsLiteral(_ value: Any) -> String {
        let data = try! JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed])
        return String(data: data, encoding: .utf8)!
    }

    private func publishReminders(ok: Bool = true, message: String) {
        guard pageReady else { return }
        web.evaluateJavaScript("window.PengoIOSUpdateReminders(\(jsLiteral(reminders.state))); if(window.PengoReminderResult) window.PengoReminderResult(\(ok), \(jsLiteral(message)));", completionHandler: nil)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.scheme == "pengo",
              message.frameInfo.request.url?.host == "app", let body = message.body as? [String: Any],
              let method = body["method"] as? String, let args = body["args"] as? [Any] else { return }
        let result: (Bool, String) -> Void = { [weak self] ok, text in self?.publishReminders(ok: ok, message: text) }
        switch method {
        case "exportJson":
            if args.count == 2, let name = args[0] as? String, let text = args[1] as? String { exportBackup(name: name, text: text) }
        case "importJson":
            guard presentedViewController == nil else { return }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json, .plainText], asCopy: true)
            picker.delegate = self
            picker.allowsMultipleSelection = false
            present(picker, animated: true)
        case "showMessage": if let text = args.first as? String { showMessage(text) }
        case "setDarkTheme":
            if let value = args.first as? Bool {
                dark = value
                view.backgroundColor = dark ? UIColor(red: 16/255, green: 36/255, blue: 34/255, alpha: 1) : UIColor(red: 250/255, green: 249/255, blue: 245/255, alpha: 1)
                web.backgroundColor = view.backgroundColor
                setNeedsStatusBarAppearanceUpdate()
            }
        case "setReminder":
            if args.count == 2, let enabled = args[0] as? Bool, let time = args[1] as? String { reminders.configure(enabled: enabled, time: time, completion: result) }
        case "resetReminderSettings": reminders.reset(result)
        case "setReminderGoalDate": if let date = args.first as? String { reminders.setGoalDate(date) }
        case "openNotificationSettings":
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        case "sendTestReminder": reminders.sendTest(result)
        default: break
        }
    }

    private func exportBackup(name: String, text: String) {
        guard presentedViewController == nil else { return }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let basename = (name as NSString).lastPathComponent
        let safeName = basename.hasSuffix(".json") ? basename : "pengo-backup.json"
        let file = folder.appendingPathComponent(safeName)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try Data(text.utf8).write(to: file, options: .atomic)
            exportURL = file
            let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
            picker.delegate = self
            present(picker, animated: true)
        } catch { try? FileManager.default.removeItem(at: folder); showMessage("Could not save backup.") }
    }

    private func cleanExport() {
        if let file = exportURL { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        exportURL = nil
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { cleanExport() }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if exportURL != nil { cleanExport(); return }
        guard let url = urls.first else { return }
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            let text = try String(contentsOf: url, encoding: .utf8)
            web.evaluateJavaScript("window.Platform.receiveImport(\(jsLiteral(text)));", completionHandler: nil)
        } catch { showMessage("Could not read backup.") }
    }

    private func showMessage(_ text: String) {
        // Picker delegate callbacks can arrive before its dismissal finishes.
        if let presented = presentedViewController {
            presented.dismiss(animated: true) { [weak self] in self?.showMessage(text) }
            return
        }
        let alert = UIAlertController(title: "Pengo", message: text, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "pengo", url.host == "app", action.targetFrame?.isMainFrame == true { decisionHandler(.allow); return }
        if action.navigationType == .linkActivated, ["https", "http"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "Pengo", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "Pengo", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }
}
