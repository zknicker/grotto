#!/bin/bash

set -euo pipefail

icon_dir="${GROTTO_PRECOMPILED_IOS_ICON_DIR:-}"
if [[ -z "${icon_dir}" ]]; then
    exit 0
fi

for file in Assets.car assetcatalog_generated_info.plist mac-icon60x60@2x.png mac-icon76x76@2x~ipad.png; do
    if [[ ! -f "${icon_dir}/${file}" ]]; then
        echo "error: compiled iOS icon artifact is missing ${file}" >&2
        exit 1
    fi
done

resources_dir="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}"
mkdir -p "${resources_dir}"
cp "${icon_dir}/Assets.car" "${resources_dir}/Assets.car"
cp "${icon_dir}/mac-icon60x60@2x.png" "${resources_dir}/mac-icon60x60@2x.png"
cp "${icon_dir}/mac-icon76x76@2x~ipad.png" "${resources_dir}/mac-icon76x76@2x~ipad.png"
