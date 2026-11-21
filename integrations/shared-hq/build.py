"""Write the self-contained Cloudflare ES module to stdout."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
worker = (root / 'worker.mjs').read_text()
for name, path in (
    ('dashboardSync', root / 'dashboard.js'),
    ('accountPage', root / 'login.html'),
    ('quoteClient', root.parent.parent / 'hq' / 'app27_interactive_quotes.js'),
):
    worker = worker.replace('/* embed ' + name + ' */', 'const ' + name + '=' + json.dumps(path.read_text()) + ';')
print(worker)
