// Chip In HQ — one consistent manual Gmail compose action for all communications.
// This module ONLY opens a pre-written Gmail draft. It never sends, queues, or marks emails as sent.
(function(){
'use strict';
const gmailBase='https://mail.google.com/mail/?view=cm&fs=1';
const validEmail=s=>/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(String(s||'').trim());
const field=s=>String(s??'').trim();
const business=()=>{
 const s=state.settings||{};
 return {name:field(s.tradingName)||'Chip In',email:field(s.email)||'jamesbutt.chipin@gmail.com',website:'https://chipinworks.co.uk/'};
};
const signature=()=>{
 const s=business();
 return 'Kind regards,\nChip\n'+s.name+'\n'+s.website+'\n'+s.email;
};
function urlFor(to,subject,body){
 const email=field(to).toLowerCase();
 if(!validEmail(email))throw Error('A valid recipient email address is required.');
 return gmailBase+'&to='+encodeURIComponent(email)+'&su='+encodeURIComponent(field(subject))+'&body='+encodeURIComponent(field(body));
}
function link(to,subject,body){return urlFor(to,subject,body)}
function open(to,subject,body){
 let url;
 try{url=urlFor(to,subject,body)}catch(e){toast(e.message);return false}
 // This is invoked directly from the user click, not from an asynchronous callback.
 const w=window.open(url,'_blank');
 if(!w){
  openModal('<h2>Open Gmail draft</h2><p class="sub">Your browser blocked the new tab. Select the link below to review your pre-written message in Gmail.</p><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">Open Gmail draft</a></div>');
  return false;
 }
 try{w.opener=null}catch{}
 toast('Gmail draft opened for your review. Nothing has been sent.');
 return true;
}
function forSalesLead(l){
 if(!l)return false;
 const c=(state.clients||[]).find(c=>(c.sourceLeadId&&(c.sourceLeadId===l.id||c.sourceLeadId===l.sourceLeadId))||(l.convertedClientId&&c.id===l.convertedClientId)||
    (field(l.businessName)&&field(c.name).toLowerCase()===field(l.businessName).toLowerCase()));
 const recipient=field(l.email||c?.email);
 const contact=field(l.contactName||c?.contact)||'there',name=field(l.businessName||c?.name)||'your business';
 const service=field(l.service),previous=field(l.lastContactSummary),isFollowUp=!!previous||['Follow-up','Contact','Interested','Quote'].includes(l.stage);
 const greeting='Hi '+contact+',\n\n';
 let subject,body;
 if(isFollowUp){
  subject='Following up — '+name+' | Chip In';
  body=greeting+'I just wanted to follow up'+(previous?' on our previous conversation about '+previous.replace(/[.!?]+$/,''):' with you')+'.\n\n'+
   (service?'I would be happy to discuss '+service.toLowerCase()+' if it would be useful to '+name+'. ':'')+
   'If you would like to take the next step or have any questions, please feel free to reply.\n\n'+signature();
 }else{
  subject='Introduction — Chip In and '+name;
  body=greeting+"I'm Chip from Chip In. I work with local businesses on websites and other practical digital support.\n\n"+
   (service?'I wanted to introduce myself regarding '+service.toLowerCase()+'.\n\n':'')+
   'If this is something that might be useful for '+name+', I would be happy to have a quick conversation.\n\n'+signature();
 }
 const demo=field(l.demoUrl);
 if(/^https:\/\/chipbutt\.github\.io\/HospoLP\/samples\/[a-z0-9-]+\/?$/i.test(demo))
  body=body.replace('\n\n'+signature(),'\n\nI have also prepared a website demonstration that you can view here:\n'+demo+'\n\n'+signature());
 return open(recipient,subject,body);
}
function forClient(c,kind='intro'){
 if(!c)return false;
 const name=field(c.name)||'your business',contact=field(c.contact)||'there';
 const greeting='Hi '+contact+',\n\n';
 const about=field(c.businessOverview||c.businessType),notes=field(c.notes);
 const subject=kind==='followup'?'Following up — '+name+' | Chip In':'Getting in touch — '+name+' | Chip In';
 const body=kind==='followup'
  ?greeting+'I wanted to follow up on our previous contact about '+name+'.\n\nIf you have any questions or would like to discuss the next steps, please let me know.\n\n'+signature()
  :greeting+"I'm Chip from Chip In, and I work with local businesses on websites and other practical digital support.\n\n"+
    (about?'I understand that your business focuses on '+about.replace(/[.!?]+$/,'')+'.\n\n':'')+
    'I wanted to introduce myself and see whether there is anything you might find helpful.\n\n'+signature();
 return open(c.email,subject,body);
}
window.ChipInEmailDrafts={open,link,urlFor,forSalesLead,forClient,signature};
})();
