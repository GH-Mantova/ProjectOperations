#!/usr/bin/env bash
# Azure App Service Linux startup wrapper.
#
# Why this exists: `pnpm --filter @project-ops/api deploy` ships a pinned Chrome
# binary for puppeteer, but the App Service Linux runtime image does NOT include
# the shared libraries Chrome links against (libglib-2.0.so.0, libnss3.so,
# libgtk-3, libatk, libcups, etc.). Without them every /export/pdf endpoint
# 500s with "error while loading shared libraries: libglib-2.0.so.0: cannot
# open shared object file". PRs #525 / #548 only surfaced the error path; this
# script fixes the root cause by install-deps at container init.
#
# Idempotent: apt-get skips already-installed packages, so warm restarts are
# fast. First cold start after a deploy pays ~30–60s while packages install.
#
# Root gate: apt-get needs root. App Service's Startup Command runs as root
# BEFORE the app user is assumed, so this works when invoked via Startup
# Command. If invoked later (e.g. via `npm start` from a non-root context) the
# install is skipped and the app still starts — but Chrome will then fail to
# launch. Configure the App Service Startup Command to `bash
# /home/site/wwwroot/startup.sh` (one-time portal step, documented in the PR).

set -euo pipefail

APP_DIR="${APP_DIR:-/home/site/wwwroot}"

install_chrome_deps() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "[startup] apt-get not available — skipping install-deps (Chrome will only work if libs are pre-installed)."
    return 0
  fi
  if [ "$(id -u)" != "0" ]; then
    echo "[startup] not running as root (uid=$(id -u)) — skipping install-deps. Set the App Service Startup Command to 'bash /home/site/wwwroot/startup.sh' so this runs as root."
    return 0
  fi

  echo "[startup] Installing Chrome system libraries (libglib, libnss3, libgtk, ...)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2
  echo "[startup] Chrome deps install complete."
}

install_chrome_deps || echo "[startup] install-deps step failed but proceeding — check apt logs above."

cd "$APP_DIR"
echo "[startup] exec node dist/src/main.js"
exec node dist/src/main.js
