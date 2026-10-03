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

  private let locationManager = CLLocationManager()
  private let geocoder = CLGeocoder()
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?

  override init() {
    super.init()
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    true
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

  @objc(refreshPrayerLocation:rejecter:)
  func refreshPrayerLocation(
    _ resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    pendingResolve = resolver
    pendingReject = rejecter
    switch locationManager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      locationManager.requestLocation()
    case .notDetermined:
      locationManager.requestWhenInUseAuthorization()
    default:
      finish(false)
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
