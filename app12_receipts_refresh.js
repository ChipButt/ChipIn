// Chip In HQ receipt viewing and explicit invoice refresh from linked jobs
let chipInReceiptPreviewUrl='';
const chipInPrevCloseModal=closeModal;
closeModal=function(){if(chipInReceiptPreviewUrl){URL.revokeObjectURL(chipInReceiptPreviewUrl);chipInReceiptPreviewUrl=''}return chipInPrevCloseModal()};

async function chipInReceiptBlob(id){
  const e=expenseById(id);if(!e)return null;
  let blob=await dbGet('receipts',id);
  if(!blob&&e.cloudReceiptPath&&typeof ghUnlocked!=='undefined'&&ghUnlocked){
    try{const bytes=await getEncrypted(e.cloudReceiptPath);blob=new Blob([bytes],{type:e.receiptType||'application/octet-stream'});await dbPut('receipts',id,blob)}catch(err){toast(err.message);return null}
  }
  return blob;
}
async function viewReceipt(id){
  const e=expenseById(id),blob=await chipInReceiptBlob(id);if(!e)return;
  if(!blob){toast(e.cloudReceiptPath?'Unlock private storage to view this receipt.':'Receipt file is not available on this device.');return}
  if(chipInReceiptPreviewUrl)URL.revokeObjectURL(chipInReceiptPreviewUrl);
  chipInReceiptPreviewUrl=URL.createObjectURL(blob);
  const type=blob.type||e.receiptType||'',isImage=type.startsWith('image/'),isPdf=type==='application/pdf'||/\.pdf$/i.test(e.receiptName||'');
  const preview=isImage?`<img src="${chipInReceiptPreviewUrl}" alt="${esc(e.receiptName||'Receipt')}" style="display:block;max-width:100%;max-height:70vh;margin:0 auto;border-radius:10px;object-fit:contain">`:isPdf?`<iframe src="${chipInReceiptPreviewUrl}" title="${esc(e.receiptName||'Receipt')}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>`:`<div class="hint-box">This file type cannot be previewed in the browser, but you can download it.</div>`;
  openModal(`<div class="section-title" style="margin-top:0"><div><h2>Receipt</h2><p>${esc(e.receiptName||'Evidence')} · ${esc(e.description||'')}</p></div><button class="btn secondary" id="downloadViewedReceipt">Download</button></div>${preview}`,true);
  $('#downloadViewedReceipt').onclick=()=>downloadBlob(blob,e.receiptName||`receipt-${id}`);
}

expenseRows=function(rows){return rows.map(e=>`<tr><td>${fmtDate(e.date)}</td><td><strong>${esc(e.description)}</strong><div class="muted">${esc(e.supplier||'')}</div></td><td>${esc(e.category||'Other')}</td><td>${esc(jobById(e.jobId)?.title||'—')}</td><td>${e.allowable===false?statusBadge('Review'):'<span class="badge ok">Yes</span>'}${e.receiptName?`<div class="row-actions" style="justify-content:flex-start;margin-top:5px"><button class="btn link" data-action="view-receipt" data-id="${e.id}">View receipt</button><button class="btn link" data-action="receipt" data-id="${e.id}">Download</button></div>`:''}</td><td>${money(e.amount)}</td><td class="right"><div class="row-actions"><button class="btn small secondary" data-action="edit-expense" data-id="${e.id}">Edit</button><button class="icon-btn" data-action="delete-expense" data-id="${e.id}">×</button></div></td></tr>`).join('')};

const chipInPrevHandleAction12=handleAction;
handleAction=async function(action,id){if(action==='view-receipt'){await viewReceipt(id);return}return chipInPrevHandleAction12(action,id)};

const chipInPrevOpenInvoiceForm12=openInvoiceForm;
openInvoiceForm=function(id,jobId){
  chipInPrevOpenInvoiceForm12(id,jobId);
  const form=$('#invoiceForm');if(!form)return;
  const inv=id?invoiceById(id):null,j=jobId?jobById(jobId):chipInInvoiceJob(inv);if(!j)return;
  const actions=form.querySelector('.form-actions');if(!actions||$('#refreshInvoiceJobBtn',form))return;
  const b=document.createElement('button');b.type='button';b.className='btn secondary';b.id='refreshInvoiceJobBtn';b.textContent='Refresh from linked job';
  b.onclick=()=>{
    $('#invoiceItems',form).innerHTML=chipInInvoiceItemsForJob(j).map(invoiceItemRow).join('');bindInvoiceItems();
    const notes=$('[name="notes"]',form),jobRef=$('[name="jobReference"]',form),custRef=$('[name="customerReference"]',form);
    if(notes)notes.value=j.notes||'';if(jobRef)jobRef.value=j.reference||'';if(custRef)custRef.value=j.customerReference||'';
    toast('Invoice refreshed from latest job details');
  };
  actions.insertBefore(b,actions.firstChild);
};
