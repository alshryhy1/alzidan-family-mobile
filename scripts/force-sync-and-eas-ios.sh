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

echo "==> npm install (must apply expo-modules-jsi patch)"
npm install

echo "==> verify patched Swift source and xcframework script"
grep -q "setterCallback" node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/JavaScriptRuntime.swift
grep -q "exit code 0 but produced no further output" node_modules/expo-modules-jsi/apple/scripts/build-xcframework.sh

echo "==> expo config"
npx expo config --type public >/dev/null
echo "CONFIG_OK"

echo "==> eas build ios production"
npx eas-cli build --platform ios --profile production
