#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[1/3] PHP syntax lint"
while IFS= read -r file; do
  php -l "$file" >/dev/null
done < <(rg --files api install.php)

echo "[2/3] JavaScript syntax lint"
while IFS= read -r file; do
  node --check "$file" >/dev/null
done < <(rg --files assets/js)

echo "[3/3] Settings UI surface smoke checks"
rg -q "h\\('h3', null, 'Slack integration'\\)" assets/js/app.js
rg -q "h\\('h3', null, 'Recurring rules'\\)" assets/js/app.js
rg -q "Template override \\(" assets/js/app.js
rg -q "Assignees" assets/js/app.js
rg -q "labelsForRecurringProject" assets/js/app.js

echo "beta-smoke: OK"
