import CoreLocation
import Foundation
import WidgetKit
import React

@objc(AlzidanThemeBridge)
class AlzidanThemeBridge: NSObject, CLLocationManagerDelegate {
  static let suiteName = "group.com.alzidan.family2"
  static let themeKey = "alzidan_theme_id"
  static let latitudeKey = "alzidan_prayer_lat"
  static let longitudeKey = "alzidan_prayer_lon"
  static let placeKey = "alzidan_prayer_place"
  static let onlineKey = "alzidan_pulse_online"

  private var locationManager: CLLocationManager?
  private let geocoder = CLGeocoder()
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?

  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  private func managerOnMain() -> CLLocationManager {
    if let locationManager {
      return locationManager
    }
    let manager = CLLocationManager()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyKilometer
    locationManager = manager
    return manager
  }

  @objc(setThemeId:resolver:rejecter:)
  func setThemeId(
    _ themeId: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let id = themeId == "feminine" ? "feminine" : "heritage"
    let defaults = UserDefaults(suiteName: Self.suiteName)
    defaults?.set(id, forKey: Self.themeKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolver(true)
  }

  @objc(setPulseOnline:resolver:rejecter:)
  func setPulseOnline(
    _ count: NSNumber,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let defaults = UserDefaults(suiteName: Self.suiteName)
    defaults?.set(max(0, count.intValue), forKey: Self.onlineKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolver(true)
  }

  @objc(readPrayerCoordinate:rejecter:)
  func readPrayerCoordinate(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let defaults = UserDefaults(suiteName: Self.suiteName)
    guard let lat = defaults?.object(forKey: Self.latitudeKey) as? Double,
          let lon = defaults?.object(forKey: Self.longitudeKey) as? Double,
          lat >= -90, lat <= 90, lon >= -180, lon <= 180 else {
      resolver(NSNull())
      return
    }
    resolver(["latitude": lat, "longitude": lon])
  }

  @objc(refreshPrayerLocation:rejecter:)
  func refreshPrayerLocation(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        resolver(false)
        return
      }
      self.pendingResolve = resolver
      self.pendingReject = rejecter
      let manager = self.managerOnMain()
      switch manager.authorizationStatus {
      case .authorizedAlways, .authorizedWhenInUse:
        manager.requestLocation()
      case .notDetermined:
        manager.requestWhenInUseAuthorization()
      default:
        self.finish(false)
      }
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard pendingResolve != nil else { return }
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      manager.requestLocation()
    case .denied, .restricted:
      finish(false)
    default:
      break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else {
      finish(false)
      return
    }
    let defaults = UserDefaults(suiteName: Self.suiteName)
    defaults?.set(location.coordinate.latitude, forKey: Self.latitudeKey)
    defaults?.set(location.coordinate.longitude, forKey: Self.longitudeKey)
    geocoder.reverseGeocodeLocation(location, preferredLocale: Locale(identifier: "ar")) { [weak self] marks, _ in
      let place = marks?.first?.locality ?? marks?.first?.administrativeArea ?? ""
      DispatchQueue.main.async {
        defaults?.set(place, forKey: Self.placeKey)
        WidgetCenter.shared.reloadAllTimelines()
        self?.finish(true)
      }
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    finish(false)
  }

  private func finish(_ ok: Bool) {
    pendingResolve?(ok)
    pendingResolve = nil
    pendingReject = nil
  }
}
