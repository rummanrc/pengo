import Foundation

var checks = 0
func check(_ value: @autoclosure () -> Bool, _ label: String) {
    precondition(value(), label)
    checks += 1
}
var calendar = Calendar(identifier: .gregorian)
calendar.timeZone = TimeZone(identifier: "Asia/Tokyo")!
func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int, _ minute: Int, cal: Calendar = calendar) -> Date {
    cal.date(from: DateComponents(year: year, month: month, day: day, hour: hour, minute: minute))!
}
for time in ["24:00", "19:60", "2:00", "19:00:00", "１９:００", "19:00\n", "", "../"] {
    check(ReminderPlan.timeParts(time) == nil, "invalid time: \(time)")
}
check(ReminderPlan.timeParts("00:00") != nil, "midnight")
check(ReminderPlan.timeParts("23:59") != nil, "last minute")
let now = date(2026, 10, 11, 18, 0)
let dates = ReminderPlan.dates(time: "19:00", goalDate: "", now: now, calendar: calendar)
check(dates.count == 60, "60 day renewal window")
check(dates.first == date(2026, 10, 11, 19, 0), "today before time")
check(Set(dates.map { ReminderPlan.dateKey($0, calendar: calendar) }).count == 60, "no duplicate dates")
let suppressed = ReminderPlan.dates(time: "19:00", goalDate: "2026-10-11", now: now, calendar: calendar)
check(suppressed.count == 59 && suppressed.first == date(2026, 10, 12, 19, 0), "today's goal suppresses only today")
check(ReminderPlan.dates(time: "19:00", goalDate: "2026-10-10", now: now, calendar: calendar) == dates, "previous goal does not suppress today")
check(ReminderPlan.dates(time: "19:00", goalDate: "", now: date(2026, 10, 11, 19, 0), calendar: calendar).first == date(2026, 10, 12, 19, 0), "never schedule a past or equal time")
check(ReminderPlan.dates(time: "00:01", goalDate: "", now: date(2026, 12, 31, 23, 0), calendar: calendar).first == date(2027, 1, 1, 0, 1), "year rollover")
var dstCalendar = calendar
dstCalendar.timeZone = TimeZone(identifier: "America/New_York")!
let dstDates = ReminderPlan.dates(time: "19:00", goalDate: "", now: date(2026, 10, 31, 18, 0, cal: dstCalendar), calendar: dstCalendar)
check(dstDates.allSatisfy { dstCalendar.component(.hour, from: $0) == 19 }, "local wall clock survives DST")
check(Set(dstDates.map { ReminderPlan.dateKey($0, calendar: dstCalendar) }).count == 60, "DST does not duplicate dates")
let root = FileManager.default.temporaryDirectory.appendingPathComponent("pengo-ios-tests-" + UUID().uuidString)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
check(OfflineFiles.resolve(URL(string: "pengo://app/index.html")!, root: root)?.path == root.appendingPathComponent("index.html").path, "local index")
check(OfflineFiles.resolve(URL(string: "pengo://app/resources/stroke-order/04e00.svg")!, root: root)?.path == root.appendingPathComponent("resources/stroke-order/04e00.svg").path, "nested stroke diagram")
check(OfflineFiles.resolve(URL(string: "pengo://app/")!, root: root)?.lastPathComponent == "index.html", "root index")
for url in ["https://app/index.html", "pengo://other/index.html", "pengo://app/../secret", "pengo://app/%2e%2e/secret", "pengo://app/%252e%252e/secret", "pengo://app/a/../../secret", "pengo://app/%00"] {
    check(OfflineFiles.resolve(URL(string: url)!, root: root) == nil, "reject unsafe URL: \(url)")
}
try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("escape"), withDestinationURL: root.deletingLastPathComponent())
check(OfflineFiles.resolve(URL(string: "pengo://app/escape/secret")!, root: root) == nil, "symlink escape")
check(OfflineFiles.mimeType(URL(string: "pengo://app/a.svg")!) == "image/svg+xml", "SVG MIME")
print("iOS Foundation: \(checks) checks passed")
