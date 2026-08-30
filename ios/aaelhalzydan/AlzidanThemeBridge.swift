import Foundation
import WidgetKit
import React

@objc(AlzidanThemeBridge)
class AlzidanThemeBridge: NSObject {
  static let suiteName = "group.com.alzidan.family2"
  static let themeKey = "alzidan_theme_id"

  @objc static func requiresMainQueueSetup() -> Bool {
    false
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
}
