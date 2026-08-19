#!/usr/bin/env bash
# Cloud Agent environment install for Grotto.
# Runs during Builds (and dependency refreshes) from the repository root.
# Must be idempotent: it can run repeatedly on top of prepared disk state.
set -euo pipefail

BUN_VERSION="1.3.5"

echo "==> Ensuring Bun ${BUN_VERSION} is installed"
if ! command -v bun >/dev/null 2>&1 || [ "$(bun --version 2>/dev/null || true)" != "${BUN_VERSION}" ]; then
    curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"
fi
export BUN_INSTALL="${BUN_INSTALL:-${HOME}/.bun}"
export PATH="${BUN_INSTALL}/bin:${PATH}"
sudo ln -sf "${BUN_INSTALL}/bin/bun" /usr/local/bin/bun
sudo ln -sf "${BUN_INSTALL}/bin/bunx" /usr/local/bin/bunx

echo "==> Ensuring PostgreSQL 16 is installed (required by the dev stack)"
if [ ! -x /usr/lib/postgresql/16/bin/postgres ]; then
    # Retry apt to tolerate transient mirror/CDN errors (e.g. sporadic 400s).
    for attempt in 1 2 3; do
        sudo DEBIAN_FRONTEND=noninteractive apt-get update || true
        if sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
            -o Acquire::Retries=5 --fix-missing \
            postgresql-16 postgresql-client-16; then
            break
        fi
        echo "apt-get install attempt ${attempt} failed; retrying in 5s..."
        sleep 5
    done
    if [ ! -x /usr/lib/postgresql/16/bin/postgres ]; then
        echo "PostgreSQL 16 installation failed after retries." >&2
        exit 1
    fi
fi

# Expose the PostgreSQL 16 binaries on PATH. scripts/dev-postgres.mjs and the
# server test harness only auto-discover Homebrew paths (or bare PATH) for these
# tools, so without this any PostgreSQL-backed lane invoked from a plain shell
# (`bun run test:app`, `apps/server` tests, evals) fails to find them unless
# GROTTO_POSTGRES_BIN is set by hand.
echo "==> Exposing PostgreSQL 16 binaries on PATH"
for pg_bin in postgres initdb pg_ctl pg_isready psql createdb; do
    if [ -x "/usr/lib/postgresql/16/bin/${pg_bin}" ]; then
        sudo ln -sf "/usr/lib/postgresql/16/bin/${pg_bin}" "/usr/local/bin/${pg_bin}"
    fi
done

echo "==> Installing project dependencies and HeroUI Pro artifacts"
# setup:worktree runs `bun install --frozen-lockfile` then downloads the pinned
# HeroUI Pro artifacts. The @hugeicons-pro registry and the HeroUI Pro download
# require HUGEICONS_LICENSE_KEY and HEROUI_AUTH_TOKEN to be present as build
# secrets during this step.
bun run setup:worktree

echo "==> Install complete"
