#!/bin/sh
set -eu

server_path="${1:-}"
if [ -z "$server_path" ] || [ "${server_path#/}" = "$server_path" ]; then
    echo "Usage: install-grotto-computer /server-slug" >&2
    exit 64
fi

manifest_url="${GROTTO_COMPUTER_RELEASE_MANIFEST_URL:-https://releases.grotto.sh/computer/latest.json}"
install_path="${GROTTO_COMPUTER_INSTALL_PATH:-$HOME/.local/bin/grotto-computer}"
expected_team_id="__GROTTO_APPLE_TEAM_ID__"
expected_identity="__GROTTO_APPLE_SIGNING_IDENTITY__"
temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/grotto-computer-install.XXXXXX")"
trap 'rm -rf "$temporary_root"' EXIT INT TERM

descriptor="$temporary_root/latest.json"
artifact="$temporary_root/grotto-computer"
/usr/bin/curl --fail --silent --show-error --location "$manifest_url" --output "$descriptor"

artifact_url="$(/usr/bin/plutil -extract release.artifactUrl raw -o - "$descriptor")"
expected_sha256="$(/usr/bin/plutil -extract release.sha256 raw -o - "$descriptor")"
case "$artifact_url" in
    https://*) ;;
    *) echo "Grotto Computer artifact URL is not HTTPS." >&2; exit 1 ;;
esac
case "$expected_sha256" in
    *[!0-9a-f]*|'') echo "Grotto Computer descriptor digest is invalid." >&2; exit 1 ;;
esac
if [ "${#expected_sha256}" -ne 64 ]; then
    echo "Grotto Computer descriptor digest is invalid." >&2
    exit 1
fi

/usr/bin/curl --fail --silent --show-error --location "$artifact_url" --output "$artifact"
actual_sha256="$(/usr/bin/shasum -a 256 "$artifact" | /usr/bin/awk '{print $1}')"
if [ "$actual_sha256" != "$expected_sha256" ]; then
    echo "Grotto Computer checksum verification failed." >&2
    exit 1
fi

/usr/bin/codesign --verify --deep --strict "$artifact"
signature_details="$(/usr/bin/codesign -dv --verbose=4 "$artifact" 2>&1)"
printf '%s\n' "$signature_details" | /usr/bin/grep -Fqx "TeamIdentifier=$expected_team_id"
printf '%s\n' "$signature_details" | /usr/bin/grep -Fqx "Authority=$expected_identity"

/bin/chmod 755 "$artifact"
/bin/mkdir -p "$(dirname "$install_path")"
staged="$install_path.installing"
previous="$install_path.prev"
displaced="$install_path.replaced"
/bin/cp "$artifact" "$staged"
/bin/rm -f "$displaced"
if [ -e "$install_path" ]; then
    /bin/mv "$install_path" "$displaced"
fi
if ! /bin/mv "$staged" "$install_path"; then
    [ ! -e "$displaced" ] || /bin/mv "$displaced" "$install_path"
    exit 1
fi
/bin/rm -f "$previous"
if [ -e "$displaced" ] && ! /bin/mv "$displaced" "$previous"; then
    /bin/rm -f "$install_path"
    /bin/mv "$displaced" "$install_path"
    exit 1
fi

"$install_path" install
"$install_path" setup "$server_path"
