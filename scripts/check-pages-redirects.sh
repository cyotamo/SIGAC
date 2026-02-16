#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Arquivos servidos no GitHub Pages em que não deve existir redirect hardcoded para Firebase Hosting.
FILES_TO_SCAN=(
  "index.html"
  "service-worker.js"
  "login.js"
  "gestor.js"
  "faculdade.js"
)

for file in "${FILES_TO_SCAN[@]}"; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  if rg -n "web\.app|firebaseapp\.com" "$file" >/dev/null; then
    echo "[ERRO] Domínio hardcoded encontrado em $file"
    rg -n "web\.app|firebaseapp\.com" "$file"
    exit 1
  fi

done

echo "[OK] Nenhum domínio web.app/firebaseapp.com hardcoded nos ficheiros públicos verificados."
