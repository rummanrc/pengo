import Foundation

/// One notification per local date, with today's completed goal omitted.
/// Refresh on app activation; reserve four of iOS's pending slots for tests.
enum ReminderPlan {
    static func timeParts(_ time: String) -> (Int, Int)? {
        let parts = time.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2, parts.allSatisfy({ $0.count == 2 && $0.allSatisfy({ $0.isASCII && $0.isNumber }) }),
              let hour = Int(parts[0]), let minute = Int(parts[1]),
              (0...23).contains(hour), (0...59).contains(minute) else { return nil }
        return (hour, minute)
    }

    static func dateKey(_ date: Date, calendar: Calendar) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    static func dates(time: String, goalDate: String, now: Date = Date(), calendar: Calendar = .current) -> [Date] {
        guard let (hour, minute) = timeParts(time) else { return [] }
        let start = calendar.startOfDay(for: now)
        return (0..<60).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset, to: start),
                  let date = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day),
                  date > now, dateKey(date, calendar: calendar) != goalDate else { return nil }
            return date
        }
    }
}
