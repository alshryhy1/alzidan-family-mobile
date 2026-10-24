#!/usr/bin/env bash
# Force-sync to remote branch, install (applies patches), then EAS iOS production build.
set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH="${1:-cursor/private-aid-requests-e8cc}"

echo "==> stash local changes (if any)"
git stash push -u -m "auto-stash before force-sync $(date +%Y%m%d%H%M%S)" || true

echo "==> fetch + hard reset to origin/${BRANCH}"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

echo "==> verify patch + Podfile fix present"
test -f patches/expo-modules-jsi+56.0.14.patch
grep -q "IPHONEOS_DEPLOYMENT_TARGET" ios/Podfile
grep -q '"postinstall": "patch-package"' package.json
node -p "require('./package.json').dependencies.expo"

echo "==> npm install (fresh expo-modules-jsi so the patch applies)"
# A previous install already patched this folder. patch-package only applies
# onto the published files, so a dirty copy makes the new patch fail.
rm -rf node_modules/expo-modules-jsi
npm install

echo "==> verify patched Swift source and xcframework script"
SWIFT="node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift"
XCFW="node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh"
if ! grep -q "setterCallback" "$SWIFT" || ! grep -q "exit code 0 but produced no further output" "$XCFW"; then
  echo "الباتش لم يُطبَّق على expo-modules-jsi. لا ترفع البناء."
  exit 1
fi
echo "PATCH_OK"

echo "==> expo config"
npx expo config --type public >/dev/null
echo "CONFIG_OK"

echo "==> eas build ios production"
npx eas-cli build --platform ios --profile production
