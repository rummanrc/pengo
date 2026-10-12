import Foundation
import UserNotifications

/// All state changes run on the main queue. Only explicit opt-in requests permission.
final class StudyReminders {
    private let defaults = UserDefaults.standard
    private let center = UNUserNotificationCenter.current()
    private var permission = "default"
    private var requestVersion = 0
    private let dailyIDs = (0..<60).map { "pengo-daily-\($0)" }
    var enabled: Bool { defaults.bool(forKey: "pengo.reminder.enabled") }
    var time: String { defaults.string(forKey: "pengo.reminder.time") ?? "19:00" }
    var state: [String: Any] { ["enabled": enabled, "time": time, "lastDate": "", "permission": permission] }

    func refresh(_ completion: @escaping () -> Void) {
        center.getNotificationSettings { settings in
            DispatchQueue.main.async {
                switch settings.authorizationStatus {
                case .authorized, .provisional, .ephemeral: self.permission = "granted"
                case .notDetermined: self.permission = "default"
                default: self.permission = "denied"
                }
                self.schedule()
                completion()
            }
        }
    }

    func configure(enabled: Bool, time: String, completion: @escaping (Bool, String) -> Void) {
        guard ReminderPlan.timeParts(time) != nil else { completion(false, "Choose a valid reminder time."); return }
        requestVersion += 1
        let version = requestVersion
        defaults.set(time, forKey: "pengo.reminder.time")
        if !enabled {
            defaults.set(false, forKey: "pengo.reminder.enabled")
            schedule()
            center.removeDeliveredNotifications(withIdentifiers: dailyIDs)
            completion(true, "Reminders are off. Your progress stays right here.")
            return
        }
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            DispatchQueue.main.async {
                guard version == self.requestVersion else { return }
                self.permission = granted ? "granted" : "denied"
                self.defaults.set(granted, forKey: "pengo.reminder.enabled")
                if !granted || error != nil {
                    self.schedule()
                    completion(false, "Notifications are blocked. Allow them in System settings to enable reminders.")
                } else {
                    self.schedule { ok in
                        guard version == self.requestVersion else { return }
                        completion(ok, ok ? "Daily reminder enabled. Open Pengo at least every 60 days to renew it." : "Could not schedule reminders. Try saving the time again.")
                    }
                }
            }
        }
    }

    func reset(_ completion: @escaping (Bool, String) -> Void) {
        defaults.removeObject(forKey: "pengo.reminder.goalDate")
        configure(enabled: false, time: "19:00", completion: completion)
    }

    func setGoalDate(_ date: String) {
        guard date.isEmpty || date.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { return }
        guard defaults.string(forKey: "pengo.reminder.goalDate") != date else { return }
        defaults.set(date, forKey: "pengo.reminder.goalDate")
        schedule()
        if date == ReminderPlan.dateKey(Date(), calendar: .current) {
            center.removeDeliveredNotifications(withIdentifiers: dailyIDs)
        }
    }

    private func schedule(_ completion: ((Bool) -> Void)? = nil) {
        center.removePendingNotificationRequests(withIdentifiers: dailyIDs)
        guard enabled, permission == "granted" else { completion?(true); return }
        let calendar = Calendar.current
        let dates = ReminderPlan.dates(time: time, goalDate: defaults.string(forKey: "pengo.reminder.goalDate") ?? "", calendar: calendar)
        let group = DispatchGroup()
        var succeeded = true
        for (index, date) in dates.enumerated() {
            let content = UNMutableNotificationContent()
            content.title = "A little Japanese with Pengo?"
            content.body = "Your study buddy is ready. Three questions are a lovely place to start."
            content.sound = .default
            // No fixed time zone: delivery follows the device's local wall clock.
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: date)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            let request = UNNotificationRequest(identifier: dailyIDs[index], content: content, trigger: trigger)
            group.enter()
            center.add(request) { error in
                DispatchQueue.main.async {
                    if error != nil { succeeded = false }
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) { completion?(succeeded) }
    }

    func sendTest(_ completion: @escaping (Bool, String) -> Void) {
        guard permission == "granted" else { completion(false, "Allow notifications in System settings first."); return }
        let content = UNMutableNotificationContent()
        content.title = "Hello from Pengo!"
        content.body = "Your study buddy is ready whenever you are."
        content.sound = .default
        center.add(UNNotificationRequest(identifier: "pengo-test", content: content,
                                        trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false))) { error in
            DispatchQueue.main.async { completion(error == nil, error == nil ? "Test sent. Check your notifications." : "Could not send a test reminder.") }
        }
    }
}
