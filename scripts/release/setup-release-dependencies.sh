#!/usr/bin/env bash

# Keep licensed dependency bootstrap on the existing production-scoped CI
# identity. The release Tooling identity cannot resolve HugeIcons and HeroUI.
set -euo pipefail

if [[ -z "${CI_OP_TOKEN:-}" ]]; then
  echo "GH_DEPLOY_AGENT_PRODUCTION_OP_TOKEN is required for dependency bootstrap" >&2
  exit 1
fi

bun run setup:worktree
