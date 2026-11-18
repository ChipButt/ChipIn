// Safe regression tests: quotations publish without sending or queuing any email.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
execFileSync(process.execPath,['quote-portal/build.mjs'],{stdio:'inherit'});
const {default:app}=await import(pathToFileURL(resolve('quote-portal/dist/worker.js')).href);
const quoteId='qte_manual_email_test',token='a'.repeat(54),key='Bearer test-admin-secret';
const proposal={
 id:quoteId,number:'QTE-MANUAL-001',title:'Website proposal',clientName:'Synthetic Customer',
 clientContact:'Test Person',clientEmail:'test@example.test',issuedAt:'2026-11-16',validUntil:'2027-04-01',
 paymentSchedule:'split-50',required:[{id:'web',name:'Website design',amount:250,frequency:'one-off'}],
 domain:{mode:'own'},includedExtras:[],optionalExtras:[],careOptions:[],defaultCare:0,defaultExtras:[],
 emailTemplate:{subject:'Your quotation {quoteNumber}',body:'Hello {clientName}.\n{quoteLink}'}
};
let quote,updates=0,outboxWrites=0;
const db={
 prepare(sql){
  let args=[];
  const statement={
   bind(...v){args=v;return statement},
   async first(){
    if(sql.startsWith('SELECT view_token,status FROM quotes'))return quote&&quote.id===args[0]?{view_token:quote.view_token,status:quote.status}:null;
    throw Error('Unexpected SELECT: '+sql);
   },
   async run(){
    if(sql.startsWith('INSERT INTO quotes(')){
     quote={id:args[0],number:args[1],view_token:args[2],customer_name:args[3],status:args[4],proposal_json:args[5],issued_at:args[6],valid_until:args[7],created_at:args[8],updated_at:args[9]};
     updates++;return {meta:{changes:1}};
    }
    if(sql.includes('quote_email_outbox')){outboxWrites++;throw Error('Email queue must never be used');}
    throw Error('Unexpected UPDATE: '+sql);
   }
  };
  return statement;
 }
};
const env={DB:db,ADMIN_KEY:'test-admin-secret'};
async function post(path,payload,authorization=key){
 const response=await app.fetch(new Request('https://chipin-hq-quotes.goldplushighdefinition.workers.dev'+path,{
  method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization,Origin:'https://chipinworks.co.uk'},body:JSON.stringify(payload)
 }),env);
 return {status:response.status,data:await response.json()};
}
const denied=await post('/api/admin/publish',{proposal},'Bearer wrong');
assert.equal(denied.status,401);
const published=await post('/api/admin/publish',{proposal});
assert.equal(published.status,201,JSON.stringify(published.data));
assert.ok(published.data.url.endsWith(quote.view_token));
assert.equal(published.data.email,null);
assert.equal(updates,1);
assert.equal(outboxWrites,0);
const duplicate=await post('/api/admin/publish',{proposal});
assert.equal(duplicate.status,200);
assert.equal(duplicate.data.alreadyPublished,true);
assert.equal(updates,1);
const blocked=await post('/api/admin/send-email',{id:quoteId});
assert.equal(blocked.status,410);
assert.equal(outboxWrites,0);

// The one shared browser composer opens drafts; it has no send capability.
const opened=[],alerts=[];
const ctx={window:{open:(url)=>{opened.push(url);return {opener:null}}},state:{settings:{tradingName:'Chip In Works',email:'jamesbutt.chipin@gmail.com'},clients:[]},
 toast:(text)=>alerts.push(text),openModal:()=>{throw Error('Unexpected popup block')},esc:s=>s};
vm.runInNewContext(readFileSync(resolve('hq/app28_email_drafts.js'),'utf8'),ctx,{filename:'app28_email_drafts.js'});
const lead={businessName:'Example Inn',contactName:'Pat',email:'pat@example.test',service:'website design',stage:'Found'};
assert.equal(ctx.window.ChipInEmailDrafts.forSalesLead(lead),true);
let u=new URL(opened.at(-1));
assert.equal(u.hostname,'mail.google.com');
assert.equal(u.searchParams.get('to'),lead.email);
assert.ok(u.searchParams.get('body').includes('website design'));
assert.ok(u.searchParams.get('body').includes('Chip In Works'));
const followup={...lead,stage:'Follow-up',lastContactSummary:'our website meeting'};
ctx.window.ChipInEmailDrafts.forSalesLead(followup);
u=new URL(opened.at(-1));
assert.ok(u.searchParams.get('su').includes('Following up'));
assert.ok(u.searchParams.get('body').includes('our website meeting'));
assert.equal(opened.length,2);
console.log('PASS: publishing never sends/queues; automatic route disabled; Gmail opens editable first-contact and follow-up drafts.');
