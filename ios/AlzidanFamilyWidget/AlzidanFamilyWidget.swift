import WidgetKit
import SwiftUI
import Foundation

struct FamilyEvent: Identifiable {
    let id = UUID()
    let rawType: String
    let typeLabel: String
    let icon: String
    let name: String
    let dateText: String
    let daysLeft: Int?
    let sortDate: Date?
    let hijriDisplay: String
    let gregorianDisplay: String
    let createdAt: Date?
    let showDays: Int
    let showAt: Date?
    let endAt: Date?
    let showBeforeDays: Int
    let manualHidden: Bool

    init(
        rawType: String,
        name: String,
        dateLabel: String?,
        eventDateISO: String?,
        daysLeft: Int?,
        createdAt: Date? = nil,
        showDays: Int = 7,
        showAt: Date? = nil,
        endAt: Date? = nil,
        showBeforeDays: Int = 3,
        manualHidden: Bool = false
    ) {
        let cleanType = rawType.trimmingCharacters(in: .whitespacesAndNewlines)
        self.rawType = cleanType
        self.typeLabel = EventArabic.typeLabel(cleanType)
        self.icon = EventArabic.icon(for: cleanType)
        self.name = name
        self.createdAt = createdAt
        self.showDays = EventVisibility.clampShowDays(showDays)
        self.showAt = showAt
        self.endAt = endAt
        self.showBeforeDays = EventVisibility.clampShowBeforeDays(showBeforeDays)
        self.manualHidden = manualHidden

        let parsed = EventDateFormatter.resolve(dateLabel: dateLabel, eventDateISO: eventDateISO)
        self.sortDate = parsed.sortDate
        self.hijriDisplay = parsed.hijriDisplay
        self.gregorianDisplay = parsed.gregorianDisplay
        self.dateText = parsed.displayLine
        self.daysLeft = daysLeft ?? parsed.daysLeft
    }

    var dateLine: String {
        if !hijriDisplay.isEmpty && !gregorianDisplay.isEmpty {
            return "\(hijriDisplay) · \(gregorianDisplay)"
        }
        if !hijriDisplay.isEmpty { return hijriDisplay }
        if !gregorianDisplay.isEmpty { return gregorianDisplay }
        return dateText
    }
}

enum EventDateFormatter {
    static func arabicDigitsToWestern(_ s: String) -> String {
        let map: [Character: Character] = [
            "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
            "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
        ]
        return String(s.map { map[$0] ?? $0 })
    }

    static func parseGregorianISO(_ iso: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: iso.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    static func parseHijriLabel(_ label: String) -> Date? {
        let normalized = arabicDigitsToWestern(label)
            .replacingOccurrences(of: "\\", with: "/")
            .replacingOccurrences(of: "-", with: "/")
            .replacingOccurrences(of: "هـ", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let parts = normalized.split(separator: "/").map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count == 3,
              let day = Int(parts[0]),
              let month = Int(parts[1]),
              let year = Int(parts[2]) else { return nil }

        var components = DateComponents()
        components.calendar = Calendar(identifier: .islamicUmmAlQura)
        components.day = day
        components.month = month
        components.year = year
        return components.date
    }

    static func hijriText(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .islamicUmmAlQura)
        formatter.locale = Locale(identifier: "ar_SA")
        formatter.dateFormat = "d/M/yyyy"
        return formatter.string(from: date) + " هـ"
    }

    static func gregorianText(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "ar_SA")
        formatter.dateFormat = "d/M/yyyy"
        return formatter.string(from: date)
    }

    static func daysLeft(from date: Date) -> Int {
        let startToday = Calendar.current.startOfDay(for: Date())
        let startEvent = Calendar.current.startOfDay(for: date)
        return Calendar.current.dateComponents([.day], from: startToday, to: startEvent).day ?? 0
    }

    static func resolve(dateLabel: String?, eventDateISO: String?) -> (sortDate: Date?, hijriDisplay: String, gregorianDisplay: String, displayLine: String, daysLeft: Int?) {
        let label = (dateLabel ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let iso = (eventDateISO ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        if let gregorianDate = parseGregorianISO(iso) {
            let hijri = hijriText(from: gregorianDate)
            let gregorian = gregorianText(from: gregorianDate)
            return (gregorianDate, hijri, gregorian, "\(hijri) · \(gregorian)", daysLeft(from: gregorianDate))
        }

        if !label.isEmpty, let hijriDate = parseHijriLabel(label) {
            let hijri = hijriText(from: hijriDate)
            let gregorian = gregorianText(from: hijriDate)
            return (hijriDate, hijri, gregorian, "\(hijri) · \(gregorian)", daysLeft(from: hijriDate))
        }

        if !label.isEmpty {
            let hijri = label.contains("هـ") ? label : "\(label) هـ"
            return (nil, hijri, "", hijri, nil)
        }

        return (nil, "", "", "", nil)
    }
}

enum EventArabic {
    private static let labels: [String: String] = [
        "birth": "عقيقة مولود",
        "marriage": "زواج",
        "wedding": "زواج",
        "graduation": "حفل تخرج",
        "promotion": "حفل ترقية",
        "promotion_notice": "تهنئة ترقية",
        "congratulation": "تهنئة عائلية",
        "invitation": "دعوة عائلية",
        "new_house": "منزل جديد",
        "gathering": "اجتماع عائلي",
        "meeting": "اجتماع عائلي",
        "success": "نجاح / تفوق",
        "travel": "سفر",
        "engagement": "خطوبة",
        "contract": "عقد قران",
        "sick": "مريض",
        "operation": "عملية",
        "discharge": "خروج من المستشفى",
        "death": "وفاة",
        "general": "مناسبة عامة",
        "happy": "فرح",
    ]

    static func typeLabel(_ type: String) -> String {
        let key = type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if key.isEmpty { return "مناسبة" }
        if let exact = labels[key] { return exact }
        if key.contains("marriage") || key.contains("wedding") || key.contains("زواج") { return "زواج" }
        if key.contains("graduation") || key.contains("تخرج") { return "حفل تخرج" }
        if key.contains("birth") || key.contains("baby") || key.contains("عقيقة") || key.contains("مولود") { return "عقيقة مولود" }
        if key.contains("promotion") || key.contains("ترقية") { return "حفل ترقية" }
        if key.contains("house") || key.contains("منزل") { return "منزل جديد" }
        if key.contains("gathering") || key.contains("meeting") || key.contains("اجتماع") { return "اجتماع عائلي" }
        if key.contains("success") || key.contains("نجاح") { return "نجاح / تفوق" }
        if key.contains("travel") || key.contains("سفر") { return "سفر" }
        if key.contains("engagement") || key.contains("خطوبة") { return "خطوبة" }
        if key.contains("contract") || key.contains("عقد") { return "عقد قران" }
        if key.contains("sick") || key.contains("مريض") { return "مريض" }
        if key.contains("operation") || key.contains("عملية") { return "عملية" }
        if key.contains("discharge") { return "خروج من المستشفى" }
        if key.contains("death") || key.contains("وفاة") { return "وفاة" }
        if key.contains("general") { return "مناسبة عامة" }
        return "مناسبة عامة"
    }

    static func icon(for type: String) -> String {
        let key = type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if key == "marriage" || key.contains("marriage") || key.contains("wedding") || key.contains("زواج") { return "💍" }
        if key.contains("graduation") || key.contains("تخرج") { return "🎓" }
        if key.contains("baby") || key.contains("birth") || key.contains("عقيقة") || key.contains("مولود") { return "👶" }
        if key.contains("meeting") || key.contains("gathering") || key.contains("اجتماع") { return "🎉" }
        if key.contains("promotion") || key.contains("ترقية") { return "⭐️" }
        if key.contains("house") || key.contains("منزل") { return "🏠" }
        if key.contains("death") || key.contains("وفاة") { return "🕊️" }
        if key.contains("sick") || key.contains("operation") || key.contains("مريض") { return "🤲" }
        return "📌"
    }
}

struct WidgetBackgroundView: View {
    var body: some View {
        LinearGradient(
            colors: [
                Color(red: 15 / 255, green: 42 / 255, blue: 36 / 255),
                Color(red: 23 / 255, green: 63 / 255, blue: 53 / 255),
                Color(red: 36 / 255, green: 88 / 255, blue: 76 / 255),
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }
}

struct WidgetRoot<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        ZStack {
            WidgetBackgroundView()
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        }
    }
}


/// مصدر ظهور موحّد مع التطبيق/الويب (مسار C / NEWS-001 + جدولة).
/// - وفاة: 3 أيام من يوم الحدث (أو created_at)
/// - صحة: نافذة showDays من created_at
/// - أفراح مؤرخة: لا تظهر قبل show_at (افتراضي 3 أيام قبل التاريخ)
/// - event_date null: لا ظهور أبدي — يعتمد على created_at/showDays
enum EventVisibility {
    static let deathKeepDays = 3
    static let defaultShowDays = 7
    static let defaultShowBeforeDays = 3

    static func clampShowDays(_ value: Int?) -> Int {
        guard let value else { return defaultShowDays }
        if value < 1 { return 1 }
        if value > 7 { return 7 }
        return value
    }

    static func clampShowBeforeDays(_ value: Int?) -> Int {
        guard let value else { return defaultShowBeforeDays }
        if value < 1 { return 1 }
        if value > 7 { return 7 }
        return value
    }

    static func parseTimestamp(_ raw: String?) -> Date? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        let isoFrac = ISO8601DateFormatter()
        isoFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFrac.date(from: raw) { return d }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return d }
        return EventDateFormatter.parseGregorianISO(raw)
    }

    static func detailsObject(_ raw: String?) -> [String: Any]? {
        guard let raw, let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        guard let nested = obj["event"] as? [String: Any] else { return obj }
        var merged = obj
        for (key, value) in nested where merged[key] == nil {
            merged[key] = value
        }
        return merged
    }

    static func readScheduleString(row: [String: Any], details: [String: Any]?, snake: String, camel: String) -> String? {
        if let s = row[snake] as? String, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return s }
        if let s = row[camel] as? String, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return s }
        if let s = details?[snake] as? String, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return s }
        if let s = details?[camel] as? String, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return s }
        return nil
    }

    static func readShowBeforeDays(row: [String: Any], details: [String: Any]?) -> Int {
        if let n = row["show_before_days"] as? Int { return clampShowBeforeDays(n) }
        if let n = row["showBeforeDays"] as? Int { return clampShowBeforeDays(n) }
        if let n = details?["show_before_days"] as? Int { return clampShowBeforeDays(n) }
        if let n = details?["showBeforeDays"] as? Int { return clampShowBeforeDays(n) }
        return defaultShowBeforeDays
    }

    static func isManualHidden(row: [String: Any], details: [String: Any]?) -> Bool {
        func truthy(_ value: Any?) -> Bool {
            if let b = value as? Bool { return b }
            if let n = value as? Int { return n == 1 }
            if let s = value as? String {
                let t = s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                return t == "1" || t == "true"
            }
            return false
        }
        return truthy(row["manual_hidden"]) || truthy(row["manualHidden"])
            || truthy(details?["manual_hidden"]) || truthy(details?["manualHidden"])
            || truthy(row["is_hidden"])
    }

    static func endOfLocalDay(_ date: Date) -> Date {
        let cal = Calendar.current
        let start = cal.startOfDay(for: date)
        return cal.date(byAdding: DateComponents(day: 1, second: -1), to: start) ?? date
    }

    static func showDays(fromDetails details: String?) -> Int {
        guard let details, let data = details.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return defaultShowDays
        }
        let kind = String(describing: obj["kind"] ?? "")
        let version = obj["v"] as? Int ?? Int("\(obj["v"] ?? "")") ?? 0
        guard version == 1, ["happy_notice", "health_notice", "death_notice"].contains(kind) else {
            return defaultShowDays
        }
        if let n = obj["showDays"] as? Int { return clampShowDays(n) }
        if let s = obj["showDays"] as? String, let n = Int(s.trimmingCharacters(in: .whitespacesAndNewlines)) {
            return clampShowDays(n)
        }
        return defaultShowDays
    }

    static func isDeath(_ type: String) -> Bool {
        let key = type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return key == "death" || key.contains("death") || key.contains("وفاة")
    }

    static func isHappy(_ type: String) -> Bool {
        let key = type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if key.isEmpty { return true }
        return !["death", "sick", "operation", "discharge"].contains(key)
    }

    static func isHealth(_ type: String) -> Bool {
        let key = type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return ["sick", "operation", "discharge"].contains(key)
    }

    static func daysFromEventDay(_ event: FamilyEvent, now: Date = Date()) -> Int? {
        guard let sortDate = event.sortDate else { return nil }
        let cal = Calendar.current
        let today = cal.startOfDay(for: now)
        let day = cal.startOfDay(for: sortDate)
        return cal.dateComponents([.day], from: today, to: day).day
    }

    static func isWithinDaysFromEventDay(_ event: FamilyEvent, keepDays: Int, now: Date = Date()) -> Bool {
        let days = max(1, keepDays)
        if let diff = daysFromEventDay(event, now: now) {
            return diff >= -(days - 1)
        }
        guard let createdAt = event.createdAt else { return true }
        let cal = Calendar.current
        let createdStart = cal.startOfDay(for: createdAt)
        let todayStart = cal.startOfDay(for: now)
        let age = cal.dateComponents([.day], from: createdStart, to: todayStart).day ?? 0
        return age >= 0 && age <= days - 1
    }

    static func isCreatedWithinShowWindow(_ event: FamilyEvent, now: Date = Date()) -> Bool {
        guard let createdAt = event.createdAt else { return true }
        let maxAge = TimeInterval(clampShowDays(event.showDays) * 24 * 60 * 60)
        return createdAt.timeIntervalSince1970 >= now.timeIntervalSince1970 - maxAge
    }

    static func isPubliclyVisible(_ event: FamilyEvent, now: Date = Date()) -> Bool {
        if event.manualHidden { return false }
        if isDeath(event.rawType) {
            return isWithinDaysFromEventDay(event, keepDays: deathKeepDays, now: now)
        }
        if isHealth(event.rawType) {
            return isCreatedWithinShowWindow(event, now: now)
        }

        let showAt = event.showAt ?? event.sortDate.map { $0.addingTimeInterval(TimeInterval(-event.showBeforeDays * 24 * 60 * 60)) }
        let endAt = event.endAt ?? event.sortDate.map { endOfLocalDay($0) }
        if event.sortDate != nil || showAt != nil || endAt != nil {
            if let endAt, now > endAt { return false }
            if let showAt, now < showAt { return false }
            if event.endAt == nil, let diff = daysFromEventDay(event, now: now), diff < 0 {
                return false
            }
            return true
        }

        return isCreatedWithinShowWindow(event, now: now)
    }

    /// أعد الجلب خلال 15 دقيقة حتى يختفي المحذوف، ومع منتصف الليل لنوافذ الظهور.
    static func nextRefreshDate(from now: Date = Date()) -> Date {
        let cal = Calendar.current
        let start = cal.startOfDay(for: now)
        let midnight = cal.date(byAdding: .second, value: 24 * 60 * 60 + 5, to: start) ?? now.addingTimeInterval(3600)
        let soon = now.addingTimeInterval(15 * 60)
        return min(soon, midnight)
    }
}

enum WidgetDeepLink {
    static let events = URL(string: "com.alzidan.family2://events")!
}

struct SceneInk {
    static let cream = Color(red: 1.0, green: 0.973, blue: 0.925)
    static let gold = Color(red: 196 / 255, green: 163 / 255, blue: 90 / 255)
    static let goldSoft = Color(red: 232 / 255, green: 213 / 255, blue: 168 / 255)
}

struct PrayerEntry: TimelineEntry {
    let date: Date
    let events: [FamilyEvent]
}

struct Provider: TimelineProvider {
    private static let sampleEvents: [FamilyEvent] = [
        FamilyEvent(rawType: "birth", name: "سلمان عيد عبدالمحسن", dateLabel: "٢/٢/١٤٤٨", eventDateISO: nil, daysLeft: nil, createdAt: Date(), showDays: 7),
        FamilyEvent(rawType: "marriage", name: "عبدالرحمن هليل محمد", dateLabel: "١٦/٢/١٤٤٨", eventDateISO: nil, daysLeft: nil, createdAt: Date(), showDays: 7),
    ]

    func placeholder(in context: Context) -> PrayerEntry {
        PrayerEntry(date: Date(), events: Self.sampleEvents)
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        if context.isPreview {
            completion(PrayerEntry(date: Date(), events: Self.sampleEvents))
            return
        }
        fetchEvents { events in
            DispatchQueue.main.async {
                completion(PrayerEntry(date: Date(), events: events))
            }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let now = Date()
        fetchEvents { events in
            let entry = PrayerEntry(date: now, events: events)
            let refresh = EventVisibility.nextRefreshDate(from: now)
            DispatchQueue.main.async {
                completion(Timeline(entries: [entry], policy: .after(refresh)))
            }
        }
    }

    private func fetchEvents(completion: @escaping ([FamilyEvent]) -> Void) {
        let baseUrl = "https://wbskjfdqpugnwvrykqcn.supabase.co"
        let anonKey = "sb_publishable_JhgwBIXhs6z4yBZOoE2EqA_UlzjzW9c"

        // عيّنة حديثة + فلتر محلي موحّد (لا تعتمد على event_date.gte وحده)
        let query = "/rest/v1/family_events?select=id,type,person,date_label,event_date,created_at,details,show_at,show_before_days,end_at,manual_hidden&order=created_at.desc&limit=40"

        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let requestUrl = URL(string: baseUrl + encoded) else {
            completion([])
            return
        }

        var request = URLRequest(url: requestUrl)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { data, _, _ in
            guard let data,
                  let raw = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                completion([])
                return
            }

            let now = Date()
            let events = raw.compactMap { row -> FamilyEvent? in
                let cleanType = (row["type"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanName = (row["person"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanDate = (row["event_date"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanLabel = (row["date_label"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

                guard !cleanType.isEmpty || !cleanName.isEmpty else { return nil }

                let days = cleanDate.isEmpty ? nil : Self.daysLeft(cleanDate)
                let createdAt = Self.parseCreatedAt(row["created_at"] as? String)
                let detailsString: String?
                if let s = row["details"] as? String {
                    detailsString = s
                } else if let obj = row["details"], JSONSerialization.isValidJSONObject(obj),
                          let d = try? JSONSerialization.data(withJSONObject: obj),
                          let s = String(data: d, encoding: .utf8) {
                    detailsString = s
                } else {
                    detailsString = nil
                }
                let showDays = EventVisibility.showDays(fromDetails: detailsString)
                let detailsObj = EventVisibility.detailsObject(detailsString)
                let showAt = EventVisibility.parseTimestamp(
                    EventVisibility.readScheduleString(row: row, details: detailsObj, snake: "show_at", camel: "showAt")
                )
                let endAt = EventVisibility.parseTimestamp(
                    EventVisibility.readScheduleString(row: row, details: detailsObj, snake: "end_at", camel: "endAt")
                )
                let event = FamilyEvent(
                    rawType: cleanType,
                    name: cleanName.isEmpty ? "بدون اسم" : cleanName,
                    dateLabel: cleanLabel.isEmpty ? nil : cleanLabel,
                    eventDateISO: cleanDate.isEmpty ? nil : cleanDate,
                    daysLeft: days,
                    createdAt: createdAt,
                    showDays: showDays,
                    showAt: showAt,
                    endAt: endAt,
                    showBeforeDays: EventVisibility.readShowBeforeDays(row: row, details: detailsObj),
                    manualHidden: EventVisibility.isManualHidden(row: row, details: detailsObj)
                )
                guard EventVisibility.isPubliclyVisible(event, now: now) else { return nil }
                return event
            }
            .sorted(by: Self.sortEvents)

            completion(events)
        }.resume()
    }

    private static func sortEvents(_ lhs: FamilyEvent, _ rhs: FamilyEvent) -> Bool {
        switch (lhs.sortDate, rhs.sortDate) {
        case let (left?, right?):
            if left != right { return left < right }
            return lhs.name < rhs.name
        case (nil, _?):
            return false
        case (_?, nil):
            return true
        case (nil, nil):
            return lhs.name < rhs.name
        }
    }

    private static func isoDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func parseCreatedAt(_ raw: String?) -> Date? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        let isoFrac = ISO8601DateFormatter()
        isoFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFrac.date(from: raw) { return d }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return d }
        return nil
    }

    private static func daysLeft(_ iso: String) -> Int? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"

        guard let date = formatter.date(from: iso) else { return nil }

        let startToday = Calendar.current.startOfDay(for: Date())
        let startEvent = Calendar.current.startOfDay(for: date)
        return Calendar.current.dateComponents([.day], from: startToday, to: startEvent).day
    }
}


enum ArabicRelativeDays {
    static func untilEvent(_ days: Int) -> String {
        if days <= 0 { return "اليوم" }
        if days == 1 { return "غداً" }
        if days == 2 { return "بعد يومين" }
        if days >= 3 && days <= 10 { return "بعد \(days) أيام" }
        return "بعد \(days) يومًا"
    }
}

extension FamilyEvent {
    var statusText: String {
        guard let days = daysLeft else {
            return "\(typeLabel) — قريباً"
        }
        return "\(typeLabel) — \(ArabicRelativeDays.untilEvent(days))"
    }

    func daysLeftText(prefix: String) -> String {
        statusText
    }
}

struct PrayerTime: Identifiable {
    let id = UUID()
    let name: String
    let time: Date
}

struct PrayerInfo {
    let prayers: [PrayerTime]
    let nextName: String
    let nextTime: Date
    let remainingText: String
}

struct HailPrayerCalculator {
    static let latitude = 27.5114
    static let longitude = 41.7208
    static let timezone = 3.0
    /// أوقات الحساب كانت متأخرة 2–3 دقائق عن الأذان المحلي؛ نقدم الساعة بهذا المقدار.
    static let clockCorrectionMinutes = -2.5

    static func prayerInfo(now: Date = Date()) -> PrayerInfo {
        let today = prayerTimes(for: now)

        if let next = today.first(where: { $0.time > now }) {
            return PrayerInfo(prayers: today, nextName: next.name, nextTime: next.time, remainingText: remaining(from: now, to: next.time))
        }

        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now
        let tomorrowPrayers = prayerTimes(for: tomorrow)
        let next = tomorrowPrayers.first!
        return PrayerInfo(prayers: today, nextName: next.name, nextTime: next.time, remainingText: remaining(from: now, to: next.time))
    }

    static func prayerTimes(for date: Date) -> [PrayerTime] {
        let cal = Calendar.current
        let c = cal.dateComponents([.year, .month, .day], from: date)
        let y = Double(c.year ?? 2026)
        let m = Double(c.month ?? 1)
        let d = Double(c.day ?? 1)

        let jd = julianDate(year: y, month: m, day: d)
        let decl = sunDeclination(jd)
        let eqt = equationOfTime(jd)

        let dhuhr = 12.0 + timezone - longitude / 15.0 - eqt / 60.0
        let fajr = dhuhr - hourAngle(angle: 108.5, declination: decl) / 15.0
        let sunrise = dhuhr - hourAngle(angle: 90.833, declination: decl) / 15.0
        let asr = dhuhr + asrHourAngle(declination: decl) / 15.0
        let maghrib = dhuhr + hourAngle(angle: 90.833, declination: decl) / 15.0
        let isha = maghrib + 1.5

        return [
            PrayerTime(name: "الفجر", time: dateFromHour(fajr, base: date)),
            PrayerTime(name: "الشروق", time: dateFromHour(sunrise, base: date)),
            PrayerTime(name: "الظهر", time: dateFromHour(dhuhr, base: date)),
            PrayerTime(name: "العصر", time: dateFromHour(asr, base: date)),
            PrayerTime(name: "المغرب", time: dateFromHour(maghrib, base: date)),
            PrayerTime(name: "العشاء", time: dateFromHour(isha, base: date))
        ]
    }

    static func julianDate(year: Double, month: Double, day: Double) -> Double {
        var y = year
        var m = month
        if m <= 2 { y -= 1; m += 12 }
        let a = floor(y / 100)
        let b = 2 - a + floor(a / 4)
        return floor(365.25 * (y + 4716)) + floor(30.6001 * (m + 1)) + day + b - 1524.5
    }

    static func sunDeclination(_ jd: Double) -> Double {
        let n = jd - 2451545.0
        let g = deg2rad(357.529 + 0.98560028 * n)
        let q = 280.459 + 0.98564736 * n
        let l = deg2rad(q + 1.915 * sin(g) + 0.020 * sin(2 * g))
        let e = deg2rad(23.439 - 0.00000036 * n)
        return asin(sin(e) * sin(l))
    }

    static func equationOfTime(_ jd: Double) -> Double {
        let n = jd - 2451545.0
        let g = deg2rad(357.529 + 0.98560028 * n)
        let q = 280.459 + 0.98564736 * n
        let l = deg2rad(q + 1.915 * sin(g) + 0.020 * sin(2 * g))
        let e = deg2rad(23.439 - 0.00000036 * n)
        let ra = atan2(cos(e) * sin(l), cos(l)) / Double.pi * 12.0
        let qHours = q / 15.0
        var eqt = qHours - ra
        while eqt > 12 { eqt -= 24 }
        while eqt < -12 { eqt += 24 }
        return eqt * 60
    }

    static func hourAngle(angle: Double, declination: Double) -> Double {
        let lat = deg2rad(latitude)
        let zenith = deg2rad(angle)
        let cosH = (cos(zenith) - sin(lat) * sin(declination)) / (cos(lat) * cos(declination))
        return rad2deg(acos(max(-1, min(1, cosH))))
    }

    static func asrHourAngle(declination: Double) -> Double {
        let lat = deg2rad(latitude)
        let shadowFactor = 1.0
        let angle = atan(1.0 / (shadowFactor + tan(abs(lat - declination))))
        let cosH = (sin(angle) - sin(lat) * sin(declination)) / (cos(lat) * cos(declination))
        return rad2deg(acos(max(-1, min(1, cosH))))
    }

    static func dateFromHour(_ hour: Double, base: Date) -> Date {
        let day = Calendar.current.startOfDay(for: base)
        let correctedHour = hour + (clockCorrectionMinutes / 60.0)
        return Calendar.current.date(byAdding: .second, value: Int((correctedHour * 3600).rounded()), to: day) ?? base
    }

    static func remaining(from now: Date, to next: Date) -> String {
        let total = max(0, Int(next.timeIntervalSince(now)))
        let h = total / 3600
        let m = (total % 3600) / 60
        return h > 0 ? "\(h) س \(m) د" : "\(m) د"
    }

    static func prayerWindow(now: Date = Date()) -> (previous: Date, next: Date) {
        let today = prayerTimes(for: now)

        if let nextPrayer = today.first(where: { $0.time > now }) {
            if let previousPrayer = today.last(where: { $0.time <= now }) {
                return (previousPrayer.time, nextPrayer.time)
            }

            let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: now) ?? now
            let previous = prayerTimes(for: yesterday).last!.time
            return (previous, nextPrayer.time)
        }

        let previous = today.last!.time
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now
        let next = prayerTimes(for: tomorrow).first!.time
        return (previous, next)
    }

    static func progressUntilNextPrayer(now: Date = Date()) -> Double {
        let window = prayerWindow(now: now)
        let total = window.next.timeIntervalSince(window.previous)
        guard total > 0 else { return 0 }
        let elapsed = now.timeIntervalSince(window.previous)
        return min(1, max(0, elapsed / total))
    }

    static func deg2rad(_ d: Double) -> Double { d * .pi / 180 }
    static func rad2deg(_ r: Double) -> Double { r * 180 / .pi }
}

struct PrayerProgressRing: View {
    let progress: Double
    let nextName: String
    let remainingRange: ClosedRange<Date>
    var ringColor = SceneInk.gold
    var size: CGFloat = 108

    private var timerFontSize: CGFloat { size < 90 ? 9 : 11 }
    private var timerMinWidth: CGFloat { size < 90 ? 54 : 66 }

    var body: some View {
        ZStack {
            Circle()
                .stroke(SceneInk.cream.opacity(0.18), lineWidth: 8)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    ringColor,
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            VStack(alignment: .center, spacing: size < 90 ? 2 : 3) {
                Text(nextName)
                    .font(.system(size: size < 90 ? 9 : 11, weight: .bold))
                    .foregroundStyle(SceneInk.cream)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .frame(maxWidth: .infinity, alignment: .center)

                Text("المتبقي")
                    .font(.system(size: size < 90 ? 7 : 8, weight: .medium))
                    .foregroundStyle(SceneInk.goldSoft)
                    .opacity(0.85)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .center)

                Text(timerInterval: remainingRange, countsDown: true)
                    .environment(\.locale, Locale(identifier: "ar_SA"))
                    .font(.system(size: timerFontSize, weight: .bold, design: .monospaced))
                    .foregroundStyle(SceneInk.cream)
                    .monospacedDigit()
                    .multilineTextAlignment(.center)
                    .frame(minWidth: timerMinWidth, alignment: .center)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(size < 90 ? 10 : 12)
        }
        .background(
            Circle()
                .fill(Color.white.opacity(0.08))
        )
        .frame(width: size, height: size)
    }
}

struct AlzidanFamilyWidgetEntryView: View {
    var entry: PrayerEntry
    @Environment(\.widgetFamily) var family

    private let contentPadding: CGFloat = 8
    private let maxEvents = 2

    var body: some View {
        switch family {
        case .systemSmall:
            smallEventView
                .foregroundStyle(SceneInk.cream)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        case .systemMedium:
            mediumEventView
                .foregroundStyle(SceneInk.cream)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        case .accessoryCircular:
            lockCircularView
        case .accessoryRectangular:
            lockRectangularView
        case .accessoryInline:
            lockInlineView
        default:
            largePrayerAndEventsView
                .foregroundStyle(SceneInk.cream)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func safeTimerRange(from start: Date, until end: Date) -> ClosedRange<Date> {
        let safeEnd = end > start ? end : start.addingTimeInterval(60)
        return start...safeEnd
    }

    private var visibleEvents: [FamilyEvent] {
        Array(entry.events.prefix(maxEvents))
    }

    private var pulseMoment: FamilyEvent? {
        entry.events.first { !EventVisibility.isDeath($0.rawType) }
    }

    @ViewBuilder
    private func familyBrand(titleSize: Font, mark: CGFloat) -> some View {
        HStack(spacing: 6) {
            Text("عائلة الزيدان")
                .font(titleSize)
                .foregroundStyle(SceneInk.goldSoft)
                .lineLimit(1)
            ZStack {
                Circle()
                    .fill(SceneInk.gold.opacity(0.18))
                Circle()
                    .stroke(SceneInk.gold, lineWidth: 1)
                Text("ز")
                    .font(.system(size: mark * 0.52, weight: .heavy))
                    .foregroundStyle(SceneInk.goldSoft)
            }
            .frame(width: mark, height: mark)
        }
    }

    /// Short daily adhkar shown only when there is no family event/news to display.
    private static let dailyAdhkarList: [String] = [
        "سبحان الله وبحمده",
        "اللهم صلِّ وسلِّم على نبينا محمد",
        "لا إله إلا الله وحده لا شريك له",
        "الحمد لله رب العالمين",
        "أستغفر الله وأتوب إليه",
        "حسبي الله لا إله إلا هو عليه توكلت",
        "سبحان الله والحمد لله ولا إله إلا الله والله أكبر",
    ]

    private var dailyAdhkarText: String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Riyadh") ?? .current
        let day = cal.ordinality(of: .day, in: .year, for: entry.date) ?? 1
        let list = Self.dailyAdhkarList
        return list[day % list.count]
    }

    @ViewBuilder
    private func emptyFamilyContentFallback(compact: Bool) -> some View {
        VStack(alignment: .trailing, spacing: compact ? 2 : 4) {
            Text("عائلتك معك")
                .font(compact ? .caption : .subheadline)
                .fontWeight(.bold)
                .foregroundStyle(SceneInk.goldSoft)
                .lineLimit(1)
            Text(dailyAdhkarText)
                .font(compact ? .caption2 : .caption)
                .fontWeight(.semibold)
                .multilineTextAlignment(.trailing)
                .lineLimit(compact ? 3 : 4)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
        .accessibilityLabel("عائلتك معك. \(dailyAdhkarText)")
    }

    private var weekdayName: String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "ar_SA")
        f.dateFormat = "EEEE"
        return f.string(from: entry.date)
    }

    private var compactDatePair: String {
        let hijri = compactHijriDate(entry.date)
        let gregorian = compactGregorianDate(entry.date)
        let miladi = gregorian.contains("م") ? gregorian : "\(gregorian) م"
        return "\(hijri) · \(miladi)"
    }

    @ViewBuilder
    private func widgetEventBlock(_ event: FamilyEvent, titleSize: Font, nameSize: Font, dateSize: Font) -> some View {
        VStack(alignment: .trailing, spacing: 1) {
            Text(event.statusText)
                .font(titleSize)
                .fontWeight(.bold)
                .foregroundStyle(SceneInk.gold)
                .multilineTextAlignment(.trailing)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Text(event.name)
                .font(nameSize)
                .fontWeight(.semibold)
                .opacity(0.8)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            if !event.dateLine.isEmpty {
                Text(event.dateLine)
                    .font(dateSize)
                    .opacity(0.72)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }
        }
    }

    var smallEventView: some View {
        VStack(alignment: .trailing, spacing: 8) {
            familyBrand(titleSize: .caption2.weight(.bold), mark: 22)

            if let event = pulseMoment {
                Spacer(minLength: 4)
                Text(event.name)
                    .font(.system(size: 17, weight: .heavy))
                    .multilineTextAlignment(.trailing)
                    .lineLimit(2)
                    .minimumScaleFactor(0.75)
                Text(event.statusText)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(SceneInk.gold)
                    .multilineTextAlignment(.trailing)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                if !event.dateLine.isEmpty {
                    Text(event.dateLine)
                        .font(.system(size: 9))
                        .foregroundStyle(SceneInk.goldSoft)
                        .opacity(0.85)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }
            } else {
                Spacer(minLength: 4)
                emptyFamilyContentFallback(compact: false)
            }
        }
        .padding(contentPadding)
    }

    var mediumEventView: some View {
        HStack(alignment: .center, spacing: 8) {
            TimelineView(.periodic(from: entry.date, by: 1)) { timeline in
                let now = timeline.date
                let liveInfo = HailPrayerCalculator.prayerInfo(now: now)
                let progress = HailPrayerCalculator.progressUntilNextPrayer(now: now)

                PrayerProgressRing(
                    progress: progress,
                    nextName: liveInfo.nextName,
                    remainingRange: safeTimerRange(from: now, until: liveInfo.nextTime),
                    size: 76
                )
            }
            .frame(width: 76)

            VStack(alignment: .trailing, spacing: 4) {
                familyBrand(titleSize: .caption.weight(.bold), mark: 20)

                Text(weekdayName)
                    .font(.system(size: 13, weight: .bold))
                    .lineLimit(1)

                Text(compactDatePair)
                    .font(.system(size: 9))
                    .foregroundStyle(SceneInk.goldSoft)
                    .opacity(0.9)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                if let event = pulseMoment {
                    widgetEventBlock(
                        event,
                        titleSize: .caption,
                        nameSize: .caption2,
                        dateSize: .system(size: 9)
                    )
                } else {
                    emptyFamilyContentFallback(compact: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(contentPadding)
    }

    var largePrayerAndEventsView: some View {
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)

        return VStack(alignment: .trailing, spacing: 0) {
            HStack(alignment: .top, spacing: 6) {
                VStack(alignment: .leading, spacing: 1) {
                    Text("حائل")
                        .font(.caption)
                        .fontWeight(.bold)
                    Text(weekdayName)
                        .font(.system(size: 13, weight: .bold))
                        .lineLimit(1)
                    Text(compactDatePair)
                        .font(.system(size: 10))
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                Spacer(minLength: 0)

                familyBrand(titleSize: .subheadline.weight(.bold), mark: 24)
            }

            TimelineView(.periodic(from: entry.date, by: 1)) { timeline in
                let now = timeline.date
                let liveInfo = HailPrayerCalculator.prayerInfo(now: now)
                let progress = HailPrayerCalculator.progressUntilNextPrayer(now: now)

                PrayerProgressRing(
                    progress: progress,
                    nextName: liveInfo.nextName,
                    remainingRange: safeTimerRange(from: now, until: liveInfo.nextTime)
                )
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 2)
            .padding(.bottom, 2)

            Spacer(minLength: 0)

            HStack(alignment: .top, spacing: 6) {
                VStack(spacing: 1) {
                    ForEach(info.prayers) { p in
                        HStack {
                            Text(timeText(p.time))
                                .font(.system(size: 10, weight: p.name == info.nextName ? .bold : .semibold))
                            Spacer(minLength: 0)
                            Text(p.name)
                                .font(.system(size: 10, weight: p.name == info.nextName ? .bold : .regular))
                        }
                        .padding(.vertical, 1)
                        .padding(.horizontal, 4)
                        .background(p.name == info.nextName ? SceneInk.gold.opacity(0.28) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .trailing, spacing: 4) {
                    if visibleEvents.isEmpty {
                        emptyFamilyContentFallback(compact: false)
                    } else {
                        ForEach(Array(visibleEvents.enumerated()), id: \.element.id) { index, event in
                            if index > 0 {
                                Divider().opacity(0.18)
                            }
                            widgetEventBlock(
                                event,
                                titleSize: .caption,
                                nameSize: .caption2,
                                dateSize: .system(size: 10)
                            )
                            .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(contentPadding)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    var lockCircularView: some View {
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)
        let progress = HailPrayerCalculator.progressUntilNextPrayer(now: entry.date)

        return Gauge(value: progress) {
            Text(info.nextName)
        } currentValueLabel: {
            Text("ز")
                .font(.headline.weight(.heavy))
        }
        .gaugeStyle(.accessoryCircular)
        .accessibilityLabel("\(info.nextName)، المتبقي \(info.remainingText)")
    }

    var lockRectangularView: some View {
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)

        return VStack(alignment: .trailing, spacing: 2) {
            HStack(spacing: 4) {
                Spacer(minLength: 0)
                Text("عائلة الزيدان")
                    .font(.headline)
                    .lineLimit(1)
                Text("ز")
                    .font(.headline.weight(.heavy))
            }

            if let event = pulseMoment {
                Text(event.name)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(event.statusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            } else {
                Text("عائلتك معك")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text("\(info.nextName) · \(info.remainingText)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
        .modifier(LockAccessoryBackground())
    }

    var lockInlineView: some View {
        Text(lockInlineText)
            .lineLimit(1)
    }

    private var lockInlineText: String {
        if let event = pulseMoment {
            let first = event.name.split(separator: " ").first.map(String.init) ?? event.name
            return "\(first) · \(event.typeLabel)"
        }
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)
        return "عائلتك معك · \(info.nextName)"
    }

    func timeText(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ar_SA")
        f.dateFormat = "h:mm a"
        return f.string(from: date)
            .replacingOccurrences(of: "AM", with: "ص")
            .replacingOccurrences(of: "PM", with: "م")
    }

    func compactGregorianDate(_ date: Date) -> String {
        EventDateFormatter.gregorianText(from: date)
    }

    func compactHijriDate(_ date: Date) -> String {
        EventDateFormatter.hijriText(from: date)
    }
}

struct AlzidanFamilyWidget: Widget {
    let kind: String = "AlzidanFamilyWidget"

    var body: some WidgetConfiguration {
        let configuration = StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                AlzidanFamilyWidgetEntryView(entry: entry)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .widgetURL(WidgetDeepLink.events)
                    .containerBackground(for: .widget) {
                        WidgetBackgroundView()
                    }
            } else {
                WidgetRoot {
                    AlzidanFamilyWidgetEntryView(entry: entry)
                }
                .widgetURL(WidgetDeepLink.events)
            }
        }
        .configurationDisplayName("عائلة الزيدان")
        .description("لحظة من أهلك، وأوقات الصلاة في حائل.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])

        if #available(iOS 17.0, *) {
            return configuration.contentMarginsDisabled()
        }
        return configuration
    }
}

struct AlzidanFamilyLockWidget: Widget {
    let kind: String = "AlzidanFamilyLockWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            AlzidanFamilyWidgetEntryView(entry: entry)
                .widgetURL(WidgetDeepLink.events)
        }
        .configurationDisplayName("عائلة الزيدان — القفل")
        .description("لحظة من أهلك أو الصلاة القادمة على شاشة القفل.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct LockAccessoryBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) {
                AccessoryWidgetBackground()
            }
        } else {
            content
        }
    }
}
