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
const stageLabels={
 Research:'Introduction email',Found:'First contact email',Contact:'First follow-up email',
 'Follow-up':'Further follow-up email',Interested:'Next steps email',Quote:'Quote follow-up email',
 Won:'Project next steps email',Client:'Client check-in email',Lost:'Close conversation email'
};
function stageLabel(stage){return stageLabels[stage]||stageLabels.Client}
function stageDraft(c,l,stage){
 const recipient=field(c?.email)||field(l?.email);
 const contact=field(c?.contact)||field(l?.contactName);
 const name=field(c?.name)||field(l?.businessName)||'your business';
 const greeting=contact?'Hello '+contact+',\n\n':'Hello,\n\n';
 const service=field(l?.service);
 const serviceLine=service?' I would be happy to talk through '+service.toLowerCase()+' in more detail.':'';
 let subject,message;
 switch(stage){
 case 'Research':
 case 'Found':
  subject='Introduction — Chip In and '+name;
  message="I'm Chip from Chip In. I work with businesses on websites and practical digital support.\n\n"+(service?'I wanted to get in touch about '+service.toLowerCase()+'. ':'')+'If you think I might be able to help '+name+', I would be happy to have a quick chat and see what would be useful.';
  break;
 case 'Contact':
  subject='Following up on my introduction — '+name;
  message='I wanted to follow up on my recent contact and see whether you have had a chance to consider what Chip In could help with.'+serviceLine+'\n\nIf you are interested, I would be happy to arrange a convenient time for a quick chat.';
  break;
 case 'Follow-up':
  subject='Checking back in — '+name;
  message='I just wanted to check back in and see whether you would still like to explore working with Chip In.\n\nI appreciate things can get busy, so there is no pressure. If now is not the right time, just let me know and we can pick things up when it suits you.';
  break;
 case 'Interested':
  subject='Discussing the next steps — '+name;
  message='Thank you for your interest in working with Chip In.'+serviceLine+'\n\nIt would be useful to discuss your requirements and agree the best way forward. Would you be able to let me know a convenient time for a chat?';
  break;
 case 'Quote':
  subject='Following up on your quotation — '+name;
  message='I wanted to check whether you have had a chance to look through the quotation from Chip In.\n\nIf you have any questions, would like anything clarified or want to discuss any changes, I would be happy to help. If you are ready to go ahead, just let me know and we can agree the next steps.';
  // Include a link only if there is exactly one confirmed-sent online quote for this client.
  const sent=(Array.isArray(state.quotes)?state.quotes:[]).filter(q=>c?.id&&q.clientId===c.id&&q.status==='Sent'&&q.interactive?.email?.status==='sent'&&/^https:\/\/[^\s<>]+$/i.test(field(q.interactive?.url)));
  if(sent.length===1){
   subject='Following up on quotation '+(field(sent[0].number)||'')+' — '+name;
   message+='\n\nYou can review your quotation here:\n'+field(sent[0].interactive.url);
  }
  break;
 case 'Won':
  subject='Getting started with Chip In — '+name;
  message='Thank you for choosing to work with Chip In. I am looking forward to getting things moving for '+name+'.\n\nI wanted to check in about the next steps and make sure we have everything we need. If you have any questions or anything else you would like to discuss, please feel free to get in touch.';
  break;
 case 'Lost':
  subject='Thank you for your time — '+name;
  message='Thank you for taking the time to consider working with Chip In.\n\nI appreciate that it may not be the right fit at the moment. I will leave things with you, but if your requirements change in future, you are very welcome to get in touch.';
  break;
 default:
  subject='Checking in — '+name;
  message='I hope all is going well with '+name+'.\n\nI wanted to check in and make sure everything is going smoothly. If there is anything you need help with or anything you would like to discuss, please let me know.';
 }
 const demo=field(l?.demoUrl);
 if(['Research','Found','Contact','Interested'].includes(stage)&&/^https:\/\/chipbutt\.github\.io\/HospoLP\/samples\/[a-z0-9-]+\/?$/i.test(demo))message+='\n\nYou can also view the website demonstration here:\n'+demo;
 return {recipient,subject,body:greeting+message+'\n\n'+signature()};
}
function forPipelineClient(c,lead,stage){
 if(!c)return false;
 const d=stageDraft(c,lead,stage||c.pipelineStage||(c.archivedAt?'Lost':'Client'));
 return open(d.recipient,d.subject,d.body);
}
function forSalesLead(l){
 if(!l)return false;
 const c=(state.clients||[]).find(c=>(c.sourceLeadId&&(c.sourceLeadId===l.id||c.sourceLeadId===l.sourceLeadId))||(l.convertedClientId&&c.id===l.convertedClientId)||(l.clientRecordId&&c.id===l.clientRecordId));
 const d=stageDraft(c,l,l.stage||'Research');
 return open(d.recipient,d.subject,d.body);
}
function forClient(c,kind='intro'){
 if(!c)return false;
 return forPipelineClient(c,null,c.pipelineStage||(c.archivedAt?'Lost':kind==='followup'?'Contact':'Found'));
}
window.ChipInEmailDrafts={open,link,urlFor,forSalesLead,forClient,forPipelineClient,stageLabel,stageDraft,signature};
})();
