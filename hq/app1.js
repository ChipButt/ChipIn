/* Chip In HQ - local-first sole trader admin system */
const LOGO_DATA_URL = "chip_in_logo_TRUE_TRANSPARENT.png";
let LOGO_PDF_DATA_URL = null;
const APP_VERSION = '1.0.0';
const NAV = [
  ['dashboard','▦','Dashboard'],['clients','◎','Clients'],['jobs','◫','Jobs'],['invoices','£','Invoices'],
  ['expenses','−','Expenses'],['tax','%','Tax'],['documents','▤','Documents'],['settings','⚙','Settings']
];
const PAGE_META = {
  dashboard:['Dashboard','What needs your attention today.'], clients:['Clients','People and businesses you work for.'],
  jobs:['Jobs','Every piece of work follows the same process.'], invoices:['Invoices','Generate, send and track what you are owed.'],
  expenses:['Expenses','Record business spending and keep the evidence.'], tax:['Tax','A live estimate based on the records in Chip In HQ.'],
  documents:['Documents','Backups, exports and your year-end tax pack.'], settings:['Settings','Your business identity, invoice details and tax assumptions.']
};
const TODAY = () => new Date().toISOString().slice(0,10);
const DEFAULT_STATE = {
  version: APP_VERSION,
  settings: {
    setupComplete:false, tradingName:'Chip In', legalName:'', address:'', email:'', phone:'',
    bankName:'', sortCode:'', accountNumber:'', defaultTerms:14, invoicePrefix:'INV', nextInvoiceNumber:1,
    vatRegistered:false, vatNumber:'', defaultVatRate:20, taxRegion:'england_wales_ni',
    employmentIncome:0, payeTaxPaid:0, taxPotBalance:0, reservePercent:25, useTradingAllowance:'auto'
  },
  clients:[], jobs:[], invoices:[], expenses:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
};
let state = structuredClone(DEFAULT_STATE);
let page = 'dashboard';
let modalContext = {};
let db;

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('chipin-hq-db',1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('app'))d.createObjectStore('app');if(!d.objectStoreNames.contains('receipts'))d.createObjectStore('receipts');};req.onsuccess=()=>{db=req.result;resolve(db)};req.onerror=()=>reject(req.error);});}
function dbGet(store,key){return new Promise((res,rej)=>{const tx=db.transaction(store,'readonly');const r=tx.objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function dbPut(store,key,val){return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(val,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
function dbDelete(store,key){return new Promise((res,rej)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
function dbGetAllEntries(store){return new Promise((res,rej)=>{const tx=db.transaction(store,'readonly');const os=tx.objectStore(store),out=[];const req=os.openCursor();req.onsuccess=()=>{const c=req.result;if(c){out.push([c.key,c.value]);c.continue()}else res(out)};req.onerror=()=>rej(req.error);});}
async function saveState(){state.updatedAt=new Date().toISOString();await dbPut('app','state',state);flashSaved();}
async function loadState(){const s=await dbGet('app','state');if(s)state=mergeDefaults(s,DEFAULT_STATE);}
function mergeDefaults(obj,def){if(Array.isArray(def))return Array.isArray(obj)?obj:def;if(def&&typeof def==='object'){const out={...def};for(const k of Object.keys(obj||{}))out[k]=k in def?mergeDefaults(obj[k],def[k]):obj[k];return out}return obj===undefined?def:obj;}

const $ = (s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function uid(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`}
function esc(v=''){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function money(v){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v)||0)}
function fmtDate(v){if(!v)return '—';const d=new Date(v+'T12:00:00');return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric'}).format(d)}
function addDays(date,n){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+Number(n||0));return d.toISOString().slice(0,10)}
function taxYearForDate(v=TODAY()){const d=new Date(v+'T12:00:00');const y=d.getFullYear();const start=(d.getMonth()>3||(d.getMonth()===3&&d.getDate()>=6))?y:y-1;return `${start}/${String(start+1).slice(-2)}`}
function taxYearBounds(label=taxYearForDate()){const start=Number(label.split('/')[0]);return [`${start}-04-06`,`${start+1}-04-05`];}
function inRange(date,start,end){return date&&date>=start&&date<=end}
function clientById(id){return state.clients.find(x=>x.id===id)} function jobById(id){return state.jobs.find(x=>x.id===id)}
function invoiceById(id){return state.invoices.find(x=>x.id===id)} function expenseById(id){return state.expenses.find(x=>x.id===id)}
function invoiceTotals(inv){const subtotal=(inv.items||[]).reduce((s,x)=>s+(Number(x.qty)||0)*(Number(x.rate)||0),0);const vat=state.settings.vatRegistered?subtotal*(Number(inv.vatRate??state.settings.defaultVatRate)||0)/100:0;return{subtotal,vat,total:subtotal+vat};}
function paymentsTotal(inv){return (inv.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0)}
function outstanding(inv){return Math.max(0,invoiceTotals(inv).total-paymentsTotal(inv))}
function invoiceStatus(inv){if(outstanding(inv)<=.005)return 'Paid';if(paymentsTotal(inv)>0)return 'Part paid';if(inv.status==='Draft')return 'Draft';if(inv.dueDate<TODAY())return 'Overdue';return 'Sent';}
function statusBadge(s){const c=s==='Paid'||s==='Complete'?'ok':s==='Overdue'?'bad':s==='Sent'||s==='Invoiced'||s==='In progress'?'blue':s==='Part paid'||s==='Booked'?'warn':'';return `<span class="badge ${c}">${esc(s)}</span>`}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function flashSaved(){const el=$('#saveState');if(!el)return;el.textContent='Saved just now';clearTimeout(flashSaved.t);flashSaved.t=setTimeout(()=>el.textContent='Saved on this device',1800)}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.add('hidden'),2300)}
function confirmAction(msg,fn){openModal(`<h2>Are you sure?</h2><p class="sub">${esc(msg)}</p><div class="form-actions"><button class="btn secondary" data-close-modal>Cancel</button><button class="btn danger" id="confirmDanger">Delete</button></div>`);$('#confirmDanger').onclick=async()=>{await fn();closeModal();render();};}
function empty(msg){return `<div class="empty-state"><div class="empty-icon">＋</div><h3>Nothing here yet</h3><p>${esc(msg)}</p></div>`}
function nextInvoiceNumber(){const y=taxYearForDate().split('/')[0];return `${state.settings.invoicePrefix||'INV'}-${y}-${String(state.settings.nextInvoiceNumber||1).padStart(4,'0')}`}
function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function makeCSV(rows){return rows.map(r=>r.map(csvEscape).join(',')).join('\n')}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(file);});}
function dataURLToBlob(dataURL){const [m,b64]=dataURL.split(',');const type=(m.match(/data:(.*?);/)||[])[1]||'application/octet-stream';const bytes=atob(b64);const a=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)a[i]=bytes.charCodeAt(i);return new Blob([a],{type});}
function isBusinessIdentityComplete(){const s=state.settings;return !!(s.legalName&&s.address&&s.email&&s.bankName&&s.sortCode&&s.accountNumber)}

function renderNav(){const n=$('#nav');n.innerHTML=NAV.map(([id,icon,label])=>`<button class="${page===id?'active':''}" data-nav="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('');$$('[data-nav]').forEach(b=>b.onclick=()=>{page=b.dataset.nav;render();});}
function render(){renderNav();const [t,st]=PAGE_META[page];$('#pageTitle').textContent=t;$('#pageSubtitle').textContent=st;renderTopActions();const fn={dashboard:renderDashboard,clients:renderClients,jobs:renderJobs,invoices:renderInvoices,expenses:renderExpenses,tax:renderTax,documents:renderDocuments,settings:renderSettings}[page];fn();wirePageActions();}
function renderTopActions(){const el=$('#topActions');const map={dashboard:`<button class="btn secondary" data-action="new-expense">+ Expense</button><button class="btn" data-action="new-job">+ Job</button>`,clients:`<button class="btn" data-action="new-client">+ Client</button>`,jobs:`<button class="btn" data-action="new-job">+ Job</button>`,invoices:`<button class="btn" data-action="new-invoice">+ Invoice</button>`,expenses:`<button class="btn" data-action="new-expense">+ Expense</button>`,documents:`<button class="btn" data-action="download-backup">Backup now</button>`,settings:''};el.innerHTML=map[page]||'';}
function wirePageActions(){$$('[data-action]').forEach(el=>el.onclick=()=>handleAction(el.dataset.action,el.dataset.id));}
function openModal(html,wide=false){$('#modalBody').innerHTML=html;$('.modal-card').classList.toggle('wide',wide);$('#modal').classList.remove('hidden');$('#modal').setAttribute('aria-hidden','false');$$('[data-close-modal]').forEach(x=>x.onclick=closeModal);}
function closeModal(){$('#modal').classList.add('hidden');$('#modal').setAttribute('aria-hidden','true');$('#modalBody').innerHTML='';modalContext={};}

function showSetup(){openModal(`<img class="setup-logo" src="${LOGO_DATA_URL}" alt="Chip In"><div class="setup-intro"><h2>Set up Chip In HQ</h2><p>These details are needed for proper invoices. They are stored in this browser, not published to GitHub. You can change them later in Settings.</p></div>
<form id="setupForm"><div class="form-grid">
<div class="field"><label>Your full legal name</label><input name="legalName" required placeholder="Name used for tax and invoices"></div>
<div class="field"><label>Trading name</label><input name="tradingName" value="Chip In" required></div>
<div class="field full"><label>Business / correspondence address</label><textarea name="address" required placeholder="Full postal address including postcode"></textarea></div>
<div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Phone (optional)</label><input name="phone"></div>
<div class="field"><label>Account name</label><input name="bankName" required></div><div class="field"><label>Default payment terms</label><select name="defaultTerms"><option value="7">7 days</option><option value="14" selected>14 days</option><option value="30">30 days</option></select></div>
<div class="field"><label>Sort code</label><input name="sortCode" required placeholder="00-00-00"></div><div class="field"><label>Account number</label><input name="accountNumber" required inputmode="numeric"></div>
</div><div class="warning-box" style="margin-top:14px">Because this GitHub repository is public, bank details and client data are deliberately <strong>not</strong> stored in the repository. They live in your browser database and in backups you download.</div><div class="form-actions"><button class="btn gold" type="submit">Finish setup</button></div></form>`,true);
$('#setupForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);Object.assign(state.settings,Object.fromEntries(f.entries()));state.settings.defaultTerms=Number(state.settings.defaultTerms);state.settings.setupComplete=true;await saveState();closeModal();render();toast('Chip In HQ is ready');};
}
