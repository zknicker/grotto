#!/usr/bin/env bash

# Called inside Varlock with --include-internal. This helper owns the short
# lived p12/keychain and, for iOS, the App Store Connect key file.
set -euo pipefail

mode="${1:-}"
if [[ "${mode}" != 'computer' && "${mode}" != 'ios' ]]; then
  echo "usage: setup-apple-material.sh <computer|ios>" >&2
  exit 1
fi

if [[ -z "${RELEASE_AGENT_TOOLING_OP_TOKEN:-}" ]]; then
  echo "GH_RELEASE_AGENT_TOOLING_OP_TOKEN is required for release Tooling access" >&2
  exit 1
fi

require_material() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing release material ${name}; provision the matching Tooling item field." >&2
    exit 1
  fi
}

require_material GROTTO_RELEASE_APPLE_CERTIFICATES_P12_BASE64
require_material GROTTO_RELEASE_APPLE_CERTIFICATES_PASSWORD
if [[ "${mode}" == 'ios' ]]; then
  require_material GROTTO_RELEASE_APP_STORE_CONNECT_PRIVATE_KEY
  require_material APPLE_API_KEY_ID
  require_material APPLE_API_ISSUER
  if [[ ! "${APPLE_API_KEY_ID}" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "APPLE_API_KEY_ID contains unsupported path characters" >&2
    exit 1
  fi
fi
if [[ -z "${RUNNER_TEMP:-}" || -z "${GITHUB_ENV:-}" ]]; then
  echo "RUNNER_TEMP and GITHUB_ENV are required for Apple release material" >&2
  exit 1
fi

certificate_path="${RUNNER_TEMP}/grotto-release-certificates.p12"
keychain_path="${RUNNER_TEMP}/grotto-release-$(uuidgen).keychain-db"
keychain_password="$(openssl rand -hex 32)"
{
  echo "GROTTO_RELEASE_CERTIFICATE_PATH=${certificate_path}"
  echo "GROTTO_RELEASE_KEYCHAIN_PATH=${keychain_path}"
} >>"${GITHUB_ENV}"

umask 077
printf "%s" "${GROTTO_RELEASE_APPLE_CERTIFICATES_P12_BASE64}" |
  base64 -D >"${certificate_path}"
security create-keychain -p "${keychain_password}" "${keychain_path}"
security set-keychain-settings -lut 21600 "${keychain_path}"
security unlock-keychain -p "${keychain_password}" "${keychain_path}"
security import "${certificate_path}" \
  -P "${GROTTO_RELEASE_APPLE_CERTIFICATES_PASSWORD}" \
  -A -t cert -f pkcs12 -k "${keychain_path}"
security set-key-partition-list \
  -S apple-tool:,apple: \
  -k "${keychain_password}" \
  "${keychain_path}"
security list-keychain -d user -s "${keychain_path}"

if ! identities="$(security find-identity -v -p codesigning "${keychain_path}")"; then
  echo "Apple release keychain could not be inspected after certificate import" >&2
  exit 1
fi
if ! grep -Fq "Developer ID Application:" <<<"${identities}"; then
  echo "Apple release p12 is missing a Developer ID Application identity" >&2
  exit 1
fi
if ! grep -Fq "Apple Distribution:" <<<"${identities}"; then
  echo "Apple release p12 is missing an Apple Distribution identity" >&2
  exit 1
fi
if ! grep -Fq "Apple Development:" <<<"${identities}"; then
  echo "Apple release p12 is missing an Apple Development identity" >&2
  exit 1
fi

if [[ "${mode}" == 'ios' ]]; then
  api_key_path="${RUNNER_TEMP}/AuthKey_${APPLE_API_KEY_ID}.p8"
  echo "APPLE_API_KEY_PATH=${api_key_path}" >>"${GITHUB_ENV}"
  printf "%s" "${GROTTO_RELEASE_APP_STORE_CONNECT_PRIVATE_KEY}" >"${api_key_path}"
fi
