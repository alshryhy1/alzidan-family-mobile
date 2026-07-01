import WidgetKit
import SwiftUI
import Foundation

struct FamilyEvent: Identifiable {
    let id = UUID()
    let type: String
    let icon: String
    let name: String
    let dateText: String
    let daysLeft: Int?
}

struct PrayerEntry: TimelineEntry {
    let date: Date
    let events: [FamilyEvent]
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry {
        PrayerEntry(date: Date(), events: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        fetchEvents { events in
            completion(PrayerEntry(date: Date(), events: events))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let now = Date()
        fetchEvents { events in
            let next = Calendar.current.date(byAdding: .minute, value: 1, to: now) ?? now
            completion(Timeline(entries: [PrayerEntry(date: now, events: events)], policy: .after(next)))
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

                guard !cleanType.isEmpty || !cleanName.isEmpty else { return nil }

                let days = Self.daysLeft(cleanDate)
                return FamilyEvent(
                    type: cleanType.isEmpty ? "مناسبة" : Self.arabicType(cleanType),
                    icon: Self.iconForType(cleanType),
                    name: cleanName.isEmpty ? "بدون اسم" : cleanName,
                    dateText: row.date_label?.isEmpty == false ? row.date_label! : Self.prettyDate(cleanDate),
                    daysLeft: days
                )
            }

            completion(events)
        }.resume()
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

    private static func prettyDate(_ iso: String) -> String {
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"

        guard let date = parser.date(from: iso) else { return iso }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "ar_SA")
        formatter.dateFormat = "EEEE d MMMM"
        return formatter.string(from: date)
    }

    private static func arabicType(_ type: String) -> String {
        let key = type.lowercased()
        if key.contains("wedding") || key.contains("زواج") { return "زواج" }
        if key.contains("graduation") || key.contains("تخرج") { return "تخرج" }
        if key.contains("baby") || key.contains("birth") || key.contains("عقيقة") || key.contains("مولود") { return "مولود" }
        if key.contains("meeting") || key.contains("gathering") || key.contains("اجتماع") { return "اجتماع عائلي" }
        if key.contains("promotion") || key.contains("ترقية") { return "ترقية" }
        if key.contains("house") || key.contains("منزل") { return "منزل" }
        return type
    }

    private static func iconForType(_ type: String) -> String {
        let key = type.lowercased()
        if key.contains("wedding") || key.contains("زواج") { return "🎉" }
        if key.contains("graduation") || key.contains("تخرج") { return "🎓" }
        if key.contains("baby") || key.contains("birth") || key.contains("عقيقة") || key.contains("مولود") { return "👶" }
        if key.contains("meeting") || key.contains("gathering") || key.contains("اجتماع") { return "🎉" }
        if key.contains("promotion") || key.contains("ترقية") { return "⭐️" }
        if key.contains("house") || key.contains("منزل") { return "🏠" }
        return "📌"
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

extension FamilyEvent {
    func daysLeftText(prefix: String) -> String {
        guard let days = daysLeft else {
            return "\(prefix) قريباً"
        }
        if days <= 0 { return "\(prefix) اليوم" }
        if days == 1 { return "\(prefix) غداً" }
        if days == 2 { return "\(prefix) بعد يومين" }
        return "\(prefix) بعد \(days) أيام"
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

    static func deg2rad(_ d: Double) -> Double { d * .pi / 180 }
    static func rad2deg(_ r: Double) -> Double { r * 180 / .pi }
}

struct AlzidanFamilyWidgetEntryView: View {
    var entry: PrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            smallEventView
        case .systemMedium:
            mediumEventView
        default:
            largePrayerAndEventsView
        }
    }

    var smallEventView: some View {
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)

        return ZStack {
            background

            VStack(alignment: .trailing, spacing: 6) {
                Text("🌳 عائلة الزيدان")
                    .font(.caption)
                    .fontWeight(.bold)
                    .lineLimit(1)

                Spacer(minLength: 2)

                Text(info.nextName)
                    .font(.title2)
                    .fontWeight(.bold)
                    .lineLimit(1)

                Text(timerInterval: entry.date...info.nextTime, countsDown: true)
                    .font(.headline.weight(.semibold))
                    .monospacedDigit()
                    .lineLimit(1)

                Divider().opacity(0.25)

                if let event = entry.events.first {
                    Text(event.daysLeftText(prefix: event.icon))
                        .font(.caption2)
                        .fontWeight(.bold)
                        .lineLimit(1)

                    Text(event.type)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                } else {
                    Text("لا توجد مناسبات")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .opacity(0.75)
                        .lineLimit(1)
                }
            }
            .padding()
        }
    }

    var mediumEventView: some View {
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)

        return ZStack {
            background

            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("🌳 عائلة الزيدان")
                        .font(.headline)
                        .fontWeight(.bold)

                    Text("الصلاة القادمة")
                        .font(.caption)
                        .opacity(0.8)

                    Text(info.nextName)
                        .font(.title2)
                        .fontWeight(.bold)

                    Text(timerInterval: entry.date...info.nextTime, countsDown: true)
                        .font(.headline.weight(.semibold))
                        .monospacedDigit()
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 5) {
                    if let event = entry.events.first {
                        Text(event.daysLeftText(prefix: event.icon))
                            .font(.caption)
                            .fontWeight(.bold)
                            .lineLimit(1)

                        Text(event.type)
                            .font(.system(size: 18, weight: .bold))
                            .lineLimit(1)

                        Text(event.name)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .opacity(0.75)
                            .lineLimit(1)
                    } else {
                        Text("🌿 لا توجد")
                            .font(.headline)
                            .fontWeight(.bold)
                        Text("مناسبات قريبة")
                            .font(.caption)
                            .opacity(0.75)
                    }
                }
            }
            .padding()
        }
    }

    var largePrayerAndEventsView: some View {
        let info = HailPrayerCalculator.prayerInfo(now: entry.date)
        let nextEvents = Array(entry.events.prefix(1))

        return ZStack {
            background

            VStack(alignment: .trailing, spacing: 9) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("حائل")
                            .font(.headline)
                            .fontWeight(.bold)
                        Text(miladiDate(entry.date))
                            .font(.caption)
                        Text(hijriDate(entry.date))
                            .font(.caption)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 3) {
                        Text("🌳 عائلة الزيدان")
                            .font(.title3)
                            .fontWeight(.bold)
                        Text("أوقات الصلاة والمناسبات")
                            .font(.caption)
                    }
                }

                RoundedRectangle(cornerRadius: 18)
                    .fill(Color.white.opacity(0.24))
                    .overlay(
                        VStack(spacing: 5) {
                            Text("الصلاة القادمة")
                                .font(.caption)

                            Text(info.nextName)
                                .font(.title2)
                                .fontWeight(.bold)

                            Text(timerInterval: entry.date...info.nextTime, countsDown: true)
                                .monospacedDigit()
                                .font(.title3.weight(.semibold))
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                    )
                    .frame(height: 56)

                VStack(spacing: 4) {
                    ForEach(info.prayers) { p in
                        HStack {
                            Text(timeText(p.time))
                                .font(.system(size: 12, weight: p.name == info.nextName ? .bold : .semibold))
                            Spacer()
                            Text(p.name)
                                .font(.system(size: 12, weight: p.name == info.nextName ? .bold : .regular))
                        }
                        .padding(.vertical, 1)
                        .padding(.horizontal, 6)
                        .background(p.name == info.nextName ? Color(red: 0.55, green: 0.68, blue: 0.32).opacity(0.28) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }

                Divider().opacity(0.25)

                if let event = nextEvents.first {
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(event.daysLeftText(prefix: event.icon))
                            .font(.caption)
                            .fontWeight(.bold)
                            .lineLimit(1)

                        Text(event.type)
                            .font(.system(size: 17, weight: .bold))
                            .lineLimit(1)

                        Text(event.name)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .opacity(0.75)
                            .lineLimit(1)

                    }
                    .padding(.top, 2)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                } else {
                    Text("🌿 لا توجد مناسبات خلال الأيام القادمة")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .opacity(0.8)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            .padding()
        }
    }

    var background: some View {
        LinearGradient(
            colors: [
                Color(red: 0.98, green: 0.94, blue: 0.84),
                Color(red: 0.78, green: 0.62, blue: 0.36)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .foregroundStyle(Color(red: 0.12, green: 0.08, blue: 0.03))
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
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                AlzidanFamilyWidgetEntryView(entry: entry)
                    .containerBackground(.clear, for: .widget)
            } else {
                AlzidanFamilyWidgetEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("عائلة الزيدان")
        .description("يعرض مناسبات العائلة وأوقات الصلاة في حائل.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
