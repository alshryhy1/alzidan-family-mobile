#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AlzidanThemeBridge, NSObject)
RCT_EXTERN_METHOD(setThemeId:(NSString *)themeId
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)
RCT_EXTERN_METHOD(refreshPrayerLocation:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)
@end
