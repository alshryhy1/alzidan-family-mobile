import WidgetKit
import SwiftUI

struct PrayerEntry: TimelineEntry {
    let date: Date
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry { PrayerEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) { completion(PrayerEntry(date: Date())) }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        let now = Date()
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: now) ?? now
        completion(Timeline(entries: [PrayerEntry(date: now)], policy: .after(next)))
    }
}

struct PrayerTime: Identifiable {
    let id = UUID()
    let name: String
    let time: String
}

struct AlzidanFamilyWidgetEntryView: View {
    var entry: PrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if family == .systemLarge {
            largePrayerView
        } else {
            familyView
        }
    }

    var largePrayerView: some View {
        let prayers = [
            PrayerTime(name: "الفجر", time: "4:05"),
            PrayerTime(name: "الشروق", time: "5:33"),
            PrayerTime(name: "الظهر", time: "12:24"),
            PrayerTime(name: "العصر", time: "3:47"),
            PrayerTime(name: "المغرب", time: "7:12"),
            PrayerTime(name: "العشاء", time: "8:42")
        ]

        return ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.98, green: 0.94, blue: 0.84),
                    Color(red: 0.78, green: 0.62, blue: 0.36)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(alignment: .trailing, spacing: 12) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("حائل")
                            .font(.headline)
                            .fontWeight(.bold)
                        Text(Date(), style: .date)
                            .font(.caption)
                        Text(hijriDate())
                            .font(.caption)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 4) {
                        Text("عائلة الزيدان")
                            .font(.title3)
                            .fontWeight(.bold)
                        Text("أوقات الصلاة")
                            .font(.caption)
                    }
                }

                RoundedRectangle(cornerRadius: 18)
                    .fill(Color.white.opacity(0.22))
                    .overlay(
                        VStack(spacing: 6) {
                            Text("الصلاة القادمة")
                                .font(.caption)
                            Text("المغرب")
                                .font(.title2)
                                .fontWeight(.bold)
                            Text("المتبقي 48 دقيقة")
                                .font(.caption)
                        }
                        .foregroundStyle(.black)
                    )
                    .frame(height: 88)

                VStack(spacing: 7) {
                    ForEach(prayers) { p in
                        HStack {
                            Text(p.time)
                                .font(.system(size: 14, weight: .semibold))
                            Spacer()
                            Text(p.name)
                                .font(.system(size: 14, weight: .semibold))
                        }
                    }
                }

                Divider().opacity(0.3)

                Text("تابع أخبار ومناسبات العائلة")
                    .font(.caption2)
                    .lineLimit(1)
            }
            .padding()
            .foregroundStyle(Color(red: 0.12, green: 0.08, blue: 0.03))
        }
    }

    var familyView: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.98, green: 0.94, blue: 0.84),
                    Color(red: 0.78, green: 0.62, blue: 0.36)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack(alignment: .trailing, spacing: 8) {
                Text("عائلة الزيدان")
                    .font(.headline)
                    .fontWeight(.bold)
                Spacer()
                Text("لا توجد مناسبة قريبة")
                    .font(.caption)
                Text("تابع أخبار العائلة")
                    .font(.caption2)
            }
            .padding()
        }
    }

    func hijriDate() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .islamicUmmAlQura)
        formatter.locale = Locale(identifier: "ar_SA")
        formatter.dateFormat = "d MMMM yyyy هـ"
        return formatter.string(from: Date())
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
        .description("يعرض التاريخ وأوقات الصلاة في حائل ومناسبات العائلة.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
