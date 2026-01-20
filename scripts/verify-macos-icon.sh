#!/usr/bin/env bash
set -euo pipefail

app_path="${1:-}"

if [[ -z "${app_path}" ]]; then
  app_path="$(ls -dt src-tauri/target/release/bundle/macos/*.app 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "${app_path}" ]]; then
  echo "Usage: $(basename "$0") /path/to/Your.app" >&2
  echo "Or run from repo root after building on macOS." >&2
  exit 2
fi

if [[ ! -d "${app_path}" ]]; then
  echo "Not found: ${app_path}" >&2
  exit 2
fi

info_plist="${app_path}/Contents/Info.plist"
if [[ ! -f "${info_plist}" ]]; then
  echo "Missing Info.plist: ${info_plist}" >&2
  exit 2
fi

if ! command -v /usr/libexec/PlistBuddy >/dev/null 2>&1; then
  echo "Missing /usr/libexec/PlistBuddy; this script must run on macOS." >&2
  exit 2
fi

bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "${info_plist}" 2>/dev/null || true)"
icon_file="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' "${info_plist}" 2>/dev/null || true)"

if [[ -z "${icon_file}" ]]; then
  echo "CFBundleIconFile is missing in: ${info_plist}" >&2
  exit 1
fi

if [[ "${icon_file}" != *.icns ]]; then
  icon_file="${icon_file}.icns"
fi

icon_path="${app_path}/Contents/Resources/${icon_file}"
if [[ ! -f "${icon_path}" ]]; then
  echo "Icon file not found at: ${icon_path}" >&2
  echo "Info.plist CFBundleIconFile: ${icon_file}" >&2
  exit 1
fi

echo "OK"
echo "App: ${app_path}"
echo "Bundle ID: ${bundle_id:-<unknown>}"
echo "Icon: ${icon_path}"

