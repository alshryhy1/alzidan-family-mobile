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

    init(rawType: String, name: String, dateLabel: String?, eventDateISO: String?, daysLeft: Int?) {
        let cleanType = rawType.trimmingCharacters(in: .whitespacesAndNewlines)
        self.rawType = cleanType
        self.typeLabel = EventArabic.typeLabel(cleanType)
        self.icon = EventArabic.icon(for: cleanType)
        self.name = name

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
                Color(red: 0.98, green: 0.94, blue: 0.84),
                Color(red: 0.78, green: 0.62, blue: 0.36)
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

struct PrayerEntry: TimelineEntry {
    let date: Date
    let events: [FamilyEvent]
}

struct Provider: TimelineProvider {
    private static let sampleEvents: [FamilyEvent] = [
        FamilyEvent(rawType: "birth", name: "سلمان عيد عبدالمحسن", dateLabel: "٢/٢/١٤٤٨", eventDateISO: nil, daysLeft: nil),
        FamilyEvent(rawType: "marriage", name: "عبدالرحمن هليل محمد", dateLabel: "١٦/٢/١٤٤٨", eventDateISO: nil, daysLeft: nil),
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

    private static let timelineEntryCount = 120

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let now = Date()
        fetchEvents { events in
            var entries: [PrayerEntry] = []
            entries.reserveCapacity(Self.timelineEntryCount)

            for minuteOffset in 0..<Self.timelineEntryCount {
                guard let entryDate = Calendar.current.date(byAdding: .minute, value: minuteOffset, to: now) else {
                    continue
                }
                entries.append(PrayerEntry(date: entryDate, events: events))
            }

            if entries.isEmpty {
                entries.append(PrayerEntry(date: now, events: events))
            }

            DispatchQueue.main.async {
                completion(Timeline(entries: entries, policy: .atEnd))
            }
        }
    }

    private func fetchEvents(completion: @escaping ([FamilyEvent]) -> Void) {
        let baseUrl = "https://wbskjfdqpugnwvrykqcn.supabase.co"
        let anonKey = "sb_publishable_JhgwBIXhs6z4yBZOoE2EqA_UlzjzW9c"

        let today = Self.isoDate(Date())
        let query = "/rest/v1/family_events?select=id,type,person,date_label,event_date,created_at&or=(event_date.gte.\(today),event_date.is.null)&order=event_date.asc.nullslast,created_at.desc&limit=10"

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
            guard let data else {
                completion([])
                return
            }

            let rows = (try? JSONDecoder().decode([SupabaseEventRow].self, from: data)) ?? []
            let events = rows.compactMap { row -> FamilyEvent? in
                let cleanType = row.type.trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanName = row.person.trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanDate = (row.event_date ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanLabel = (row.date_label ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

                guard !cleanType.isEmpty || !cleanName.isEmpty else { return nil }

                let days = cleanDate.isEmpty ? nil : Self.daysLeft(cleanDate)
                return FamilyEvent(
                    rawType: cleanType,
                    name: cleanName.isEmpty ? "بدون اسم" : cleanName,
                    dateLabel: cleanLabel.isEmpty ? nil : cleanLabel,
                    eventDateISO: cleanDate.isEmpty ? nil : cleanDate,
                    daysLeft: days
                )
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

struct SupabaseEventRow: Codable {
    let id: Int?
    let type: String
    let person: String
    let date_label: String?
    let event_date: String?
    let created_at: String?
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
        return Calendar.current.date(byAdding: .second, value: Int((hour * 3600).rounded()), to: day) ?? base
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

func arabicDigits(_ s: String) -> String {
    let map = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤", "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
    return s.map { map[String($0)] ?? String($0) }.joined()
}

func arabicCountdownText(until endDate: Date, now: Date) -> String {
    let total = max(0, Int(endDate.timeIntervalSince(now)))
    let hours = total / 3600
    let minutes = (total % 3600) / 60
    let seconds = total % 60
    return arabicDigits(String(format: "%02d:%02d:%02d", hours, minutes, seconds))
}

struct PrayerProgressRing: View {
    let progress: Double
    let nextName: String
    let now: Date
    let endDate: Date
    var ringColor = Color(red: 0.55, green: 0.68, blue: 0.32)
    var size: CGFloat = 108

    private var timerFontSize: CGFloat { size < 90 ? 9 : 11 }
    private var timerMinWidth: CGFloat { size < 90 ? 54 : 66 }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.primary.opacity(0.14), lineWidth: 8)

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
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .frame(maxWidth: .infinity, alignment: .center)

                Text("المتبقي")
                    .font(.system(size: size < 90 ? 7 : 8, weight: .medium))
                    .opacity(0.72)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .center)

                Text(arabicCountdownText(until: endDate, now: now))
                    .font(.system(size: timerFontSize, weight: .bold, design: .monospaced))
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
                .fill(Color.white.opacity(0.55))
        )
        .frame(width: size, height: size)
    }
}

struct AlzidanFamilyWidgetEntryView: View {
    var entry: PrayerEntry
    @Environment(\.widgetFamily) var family

    private let contentPadding: CGFloat = 8
    private let ink = Color(red: 0.12, green: 0.08, blue: 0.03)
    private let maxEvents = 2

    var body: some View {
        switch family {
        case .systemSmall:
            smallEventView
                .foregroundStyle(ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        case .systemMedium:
            mediumEventView
                .foregroundStyle(ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        default:
            largePrayerAndEventsView
                .foregroundStyle(ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var visibleEvents: [FamilyEvent] {
        Array(entry.events.prefix(maxEvents))
    }

    private var compactTodayLine: String {
        let gregorian = compactGregorianDate(entry.date)
        let hijri = compactHijriDate(entry.date)
        return "\(gregorian) · \(hijri)"
    }

    @ViewBuilder
    private func widgetEventBlock(_ event: FamilyEvent, titleSize: Font, nameSize: Font, dateSize: Font) -> some View {
        VStack(alignment: .trailing, spacing: 1) {
            Text(event.statusText)
                .font(titleSize)
                .fontWeight(.bold)
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

    @ViewBuilder
    private func nextPrayerSection(info: PrayerInfo, alignment: HorizontalAlignment = .leading, compact: Bool = false, showRemaining: Bool = true) -> some View {
        VStack(alignment: alignment, spacing: compact ? 2 : 3) {
            Text("الصلاة القادمة")
                .font(.caption2)
                .opacity(0.8)

            Text(info.nextName)
                .font(compact ? .headline : .title3)
                .fontWeight(.bold)
                .lineLimit(1)
                .minimumScaleFactor(0.85)

            HStack(spacing: 4) {
                Text("الساعة:")
                    .font(.caption2)
                    .opacity(0.75)
                Text(timeText(info.nextTime))
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
            }

            if showRemaining {
                HStack(spacing: 4) {
                    Text("المتبقي:")
                        .font(.caption2)
                        .opacity(0.75)
                    Text(arabicCountdownText(until: info.nextTime, now: entry.date))
                        .font(.caption.weight(.semibold))
                        .monospacedDigit()
                        .lineLimit(1)
                }
            }
        }
    }

    var smallEventView: some View {
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)

        return VStack(alignment: .trailing, spacing: 2) {
            Text("🌳 عائلة الزيدان")
                .font(.caption2)
                .fontWeight(.bold)
                .lineLimit(1)

            Text(compactTodayLine)
                .font(.system(size: 8))
                .opacity(0.78)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            nextPrayerSection(info: info, alignment: .trailing, compact: true)

            Divider().opacity(0.25)

            if visibleEvents.isEmpty {
                Text("لا توجد مناسبات")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .opacity(0.75)
                    .lineLimit(1)
            } else {
                ForEach(Array(visibleEvents.enumerated()), id: \.element.id) { index, event in
                    if index > 0 {
                        Divider().opacity(0.18)
                    }
                    widgetEventBlock(
                        event,
                        titleSize: .system(size: 10, weight: .bold),
                        nameSize: .system(size: 9, weight: .semibold),
                        dateSize: .system(size: 8)
                    )
                }
            }
        }
        .padding(contentPadding)
    }

    var mediumEventView: some View {
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)

        return HStack(alignment: .center, spacing: 6) {
            VStack(alignment: .leading, spacing: 3) {
                Text("🌳 عائلة الزيدان")
                    .font(.caption)
                    .fontWeight(.bold)
                    .lineLimit(1)

                Text(compactTodayLine)
                    .font(.system(size: 9))
                    .opacity(0.78)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                nextPrayerSection(info: info, alignment: .leading, compact: false, showRemaining: false)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            PrayerProgressRing(
                progress: HailPrayerCalculator.progressUntilNextPrayer(now: entry.date),
                nextName: info.nextName,
                now: entry.date,
                endDate: info.nextTime,
                size: 76
            )
            .frame(width: 76)

            VStack(alignment: .trailing, spacing: 4) {
                if visibleEvents.isEmpty {
                    Text("🌿 لا توجد")
                        .font(.caption)
                        .fontWeight(.bold)
                    Text("مناسبات قريبة")
                        .font(.caption2)
                        .opacity(0.75)
                } else {
                    ForEach(Array(visibleEvents.enumerated()), id: \.element.id) { index, event in
                        if index > 0 {
                            Divider().opacity(0.18)
                        }
                        widgetEventBlock(
                            event,
                            titleSize: .caption2,
                            nameSize: .caption2,
                            dateSize: .system(size: 9)
                        )
                    }
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
                    Text(miladiDate(entry.date))
                        .font(.system(size: 10))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text(hijriDate(entry.date))
                        .font(.system(size: 10))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }

                Spacer(minLength: 0)

                Text("🌳 عائلة الزيدان")
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .lineLimit(1)
            }

            PrayerProgressRing(
                progress: HailPrayerCalculator.progressUntilNextPrayer(now: entry.date),
                nextName: info.nextName,
                now: entry.date,
                endDate: info.nextTime
            )
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
                        .background(p.name == info.nextName ? Color(red: 0.55, green: 0.68, blue: 0.32).opacity(0.28) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .trailing, spacing: 4) {
                    if visibleEvents.isEmpty {
                        Text("🌿 لا توجد مناسبات")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .opacity(0.8)
                            .lineLimit(2)
                            .multilineTextAlignment(.trailing)
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

    func timeText(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ar_SA")
        f.dateFormat = "h:mm a"
        return f.string(from: date)
            .replacingOccurrences(of: "AM", with: "ص")
            .replacingOccurrences(of: "PM", with: "م")
    }

    func miladiDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "ar_SA")
        f.dateFormat = "EEEE d MMMM yyyy"
        return f.string(from: date)
    }

    func compactGregorianDate(_ date: Date) -> String {
        EventDateFormatter.gregorianText(from: date)
    }

    func compactHijriDate(_ date: Date) -> String {
        EventDateFormatter.hijriText(from: date)
    }

    func hijriDate(_ date: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .islamicUmmAlQura)
        f.locale = Locale(identifier: "ar_SA")
        f.dateFormat = "d MMMM yyyy هـ"
        return f.string(from: date)
    }
}

struct AlzidanFamilyWidget: Widget {
    let kind: String = "AlzidanFamilyWidget"

    var body: some WidgetConfiguration {
        let configuration = StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                AlzidanFamilyWidgetEntryView(entry: entry)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .containerBackground(for: .widget) {
                        WidgetBackgroundView()
                    }
            } else {
                WidgetRoot {
                    AlzidanFamilyWidgetEntryView(entry: entry)
                }
            }
        }
        .configurationDisplayName("عائلة الزيدان")
        .description("يعرض مناسبات العائلة وأوقات الصلاة في حائل.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])

        if #available(iOS 17.0, *) {
            return configuration.contentMarginsDisabled()
        }
        return configuration
    }
}
