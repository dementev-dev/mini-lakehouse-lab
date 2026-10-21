#!/usr/bin/env bash
# Проверка UI на Linux Docker Engine; зависимости браузера остаются в контейнере.
set -euo pipefail
cd "$(dirname "$0")/.."

artifact_dir=$(mktemp -d /tmp/lakehouse-browser-check.XXXXXX)
echo "Browser artifacts: $artifact_dir"
docker compose exec -T ide cp /opt/work/01_environment_and_smoke_test.ipynb \
  /tmp/lakehouse-browser-smoke.ipynb

docker run --rm --network host --shm-size=1g \
  -e IDE_URL="${IDE_URL:-http://localhost:8889}" \
  -v "$PWD:/repo:ro" -v "$artifact_dir:/artifacts" \
  mcr.microsoft.com/playwright:v1.56.1-noble \
  bash -c 'npm install --prefix /tmp/browser-test --no-audit --no-fund playwright@1.56.1 >/dev/null &&
    NODE_PATH=/tmp/browser-test/node_modules node /repo/tests/browser_ide.cjs'

docker compose exec -T ide python3 - <<'PY'
import json
from pathlib import Path

path = Path('/tmp/lakehouse-browser-smoke.ipynb')
notebook = json.loads(path.read_text())
cells = [cell for cell in notebook['cells'] if cell['cell_type'] == 'code']
assert all(cell['execution_count'] is not None for cell in cells)
assert not any(output['output_type'] == 'error'
               for cell in cells for output in cell.get('outputs', []))
output = '\n'.join(''.join(item.get('text', []))
                   for cell in cells for item in cell.get('outputs', []))
assert 'master_url=spark://spark-master:7077' in output
assert 'result_sum=499999500000' in output
path.unlink()
print(f'PASS: all {len(cells)} code cells executed and saved without errors')
PY
