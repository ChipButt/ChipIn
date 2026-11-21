"""Write the self-contained Cloudflare ES module to stdout."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
worker = (root / 'worker.mjs').read_text()
for name, path in (
    ('meetingShared',root/'meetings.js'),
    ('dashboardSync', root / 'dashboard.js'),
    ('accountPage', root / 'login.html'),
    ('quoteClient', root.parent.parent / 'hq' / 'app27_interactive_quotes.js'),
):
    worker = worker.replace('/* embed ' + name + ' */', 'const ' + name + '=' + json.dumps(path.read_text().replace('/* shared documents */',(root/'documents.js').read_text())) + ';')
billing = (root / 'billing.js').read_text()
renewals = (root.parent.parent / 'hq/app25_recurring_billing.js').read_text()
helpers = renewals.split("const onlyDate",1)[1].split("const chargesFor",1)[0]
logic = renewals.split("const recurringKey",1)[1].split("// Automatically prepare",1)[0]
billing = billing.replace('/* renewal helpers */','const onlyDate'+helpers).replace('/* renewal calculation */','const recurringKey'+logic)
worker = worker.replace('/* billing service */',billing).replace('/* file service */',(root/'files.js').read_text())
print(worker)
