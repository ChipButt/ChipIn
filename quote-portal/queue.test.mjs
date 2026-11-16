// Standalone customer-email queue regression test. No real emails or databases used.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
execFileSync(process.execPath,['quote-portal/build.mjs'],{stdio:'inherit'});
const {default:app}=await import(pathToFileURL(resolve('quote-portal/dist/worker.js')).href);
const quoteId='qte_mock_email_2026';
const token='a'.repeat(54),auth='Bearer test-admin-secret';
const proposal={id:quoteId,number:'QTE-QA-1000',title:'Website design',clientName:'Synthetic Company',clientContact:'QA Customer',clientEmail:'test-customer@example.test',validUntil:'2027-04-01'};
const quote={id:quoteId,number:proposal.number,view_token:token,status:'published',valid_until:proposal.validUntil,proposal_json:JSON.stringify(proposal),first_opened_at:null,accepted_at:null,acceptance_json:null};
let message=null,insertCount=0;
const db={
 prepare(sql){
  let args=[];
  const statement={
   bind(...values){args=values;return statement},
   async first(){
    if(sql.startsWith('SELECT id,number,view_token,status,valid_until,proposal_json FROM quotes'))return quote.id===args[0]?quote:null;
    if(sql.startsWith('SELECT recipient,status,created_at,sent_at,gmail_message_id,last_error FROM quote_email_outbox'))return message?.quote_id===args[0]?message:null;
    throw Error('Unexpected mock first query: '+sql);
   },
   async run(){
    if(sql.startsWith('INSERT INTO quote_email_outbox')){
     if(!message){message={quote_id:args[0],recipient:args[1],sender:args[2],subject:args[3],body:args[4],status:'queued',created_at:args[5],sent_at:null,gmail_message_id:null,last_error:null};insertCount++;}
     return {meta:{changes:message?1:0}};
    }
    throw Error('Unexpected mock run query: '+sql);
   },
   async all(){
    if(sql.includes('FROM quotes q LEFT JOIN quote_email_outbox')){
     if(!args.includes(quoteId))return {results:[]};
     return {results:[{...quote,mail_recipient:message?.recipient||null,mail_status:message?.status||null,mail_created_at:message?.created_at||null,mail_sent_at:message?.sent_at||null,mail_message_id:message?.gmail_message_id||null,mail_error:message?.last_error||null}]};
    }
    throw Error('Unexpected mock all query: '+sql);
   }
  };
  return statement;
 }
};
const env={DB:db,ADMIN_KEY:'test-admin-secret'};
async function post(path,value,authorization=auth){
 const request=new Request('https://chipin-hq-quotes.goldplushighdefinition.workers.dev'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization,Origin:'https://chipinworks.co.uk'},body:JSON.stringify(value)});
 const response=await app.fetch(request,env);
 return {status:response.status,data:await response.json()};
}
const unauth=await post('/api/admin/send-email',{id:quoteId},'Bearer wrong');
assert.equal(unauth.status,401);assert.equal(insertCount,0);
const one=await post('/api/admin/send-email',{id:quoteId});
assert.equal(one.status,202);assert.equal(one.data.email.status,'queued');assert.equal(one.data.email.recipient,proposal.clientEmail);assert.equal(insertCount,1);
assert.equal(message.sender,'jamesbutt.chipin@gmail.com');assert.ok(message.subject.includes(quote.number));assert.ok(message.body.includes('/q/'+token));
const two=await post('/api/admin/send-email',{id:quoteId});
assert.equal(two.status,200);assert.equal(two.data.alreadyQueued,true);assert.equal(insertCount,1);
const syn=await post('/api/admin/sync',{ids:[quoteId]});
assert.equal(syn.status,200);assert.equal(syn.data.quotes[0].email.status,'queued');
message.status='sent';message.gmail_message_id='confirmed-gmail-message';message.sent_at='2026-11-16T18:00:00Z';
const confirmed=await post('/api/admin/sync',{ids:[quoteId]});
assert.equal(confirmed.data.quotes[0].email.gmailMessageId,'confirmed-gmail-message');
quote.status='accepted';
const closed=await post('/api/admin/send-email',{id:quoteId});
assert.equal(closed.status,409);assert.equal(insertCount,1);
console.log('PASS: unauthorised blocked; one queued email only; Gmail sender/recipient/link verified; sync shows only confirmed send; accepted quotes blocked.');
