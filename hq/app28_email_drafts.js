// Chip In HQ — one consistent manual Gmail compose action for all communications.
// This module ONLY opens a pre-written Gmail draft. It never sends, queues, or marks emails as sent.
(function(){
'use strict';
const gmailBase='https://mail.google.com/mail/?view=cm&fs=1';
const validEmail=s=>/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(String(s||'').trim());
const field=s=>String(s??'').trim();
const firstName=value=>field(value).replace(/^(?:(?:mr|mrs|ms|miss|mx|dr|prof|sir|dame)\.?\s+)+/i,'').split(/\s+/)[0]||'';
// The HTML service replaces the final website fallback with the linked logo.
const signature=()=> 'Kind regards,\nChip\nhttps://chipinworks.co.uk/';
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
function quoteLinks(c){
 if(!c?.id)return [];
 return (Array.isArray(state.quotes)?state.quotes:[]).filter(q=>q.clientId===c.id&&
  ['Published','Sent'].includes(q.status)&&!q.interactive?.acceptance&&!['revoked','accepted','declined'].includes(field(q.interactive?.status).toLowerCase())&&
  /^https:\/\/(?:chipin-hq-quotes\.goldplushighdefinition\.workers\.dev|(?:www\.)?chipinworks\.co\.uk)\/q\/[0-9a-f]{54}\/?$/i.test(field(q.interactive?.url)));
}
function uniqueTitles(rows){
 return [...new Map(rows.map(x=>field(x.title)||field(x.category)).filter(Boolean).map(x=>[x.toLowerCase(),x])).values()];
}
function projectDetails(c,l,stage){
 const clientName=field(c?.name)||field(l?.businessName)||'your business';
 const jobs=(Array.isArray(state.jobs)?state.jobs:[]).filter(j=>c?.id&&j.clientId===c.id&&!['cancelled','canceled','declined'].includes(field(j.status).toLowerCase()));
 const active=jobs.filter(j=>['booked','in progress'].includes(field(j.status).toLowerCase()));
 const related=jobs.filter(j=>l?.id&&j.sourceLeadId===l.id||l?.convertedJobId&&j.id===l.convertedJobId);
 const quotes=quoteLinks(c);
 let titles=[];
 if(stage==='Quote')titles=uniqueTitles(quotes);
 if(!titles.length&&['Won','Client'].includes(stage))titles=uniqueTitles(related.length?related:active.length?active:jobs);
 if(!titles.length&&field(l?.service))titles=[field(l.service)];
 if(!titles.length&&['Interested','Follow-up','Contact','Quote','Won','Client'].includes(stage))titles=uniqueTitles(quotes);
 if(!titles.length)titles=uniqueTitles(related.length?related:active);
 const label=titles.length?titles.join(' / '):'Project';
 const cleanLabel=label.replace(/[\r\n\t]+/g,' ').trim();
 const cleanName=clientName.replace(/[\r\n\t]+/g,' ').trim();
 const includesName=cleanName.length>0&&cleanLabel.toLowerCase().includes(cleanName.toLowerCase());
 const subjectProject=(includesName?cleanLabel:cleanLabel+' for '+cleanName).slice(0,205);
 const suffix=' for '+cleanName;
 const topicLabel=cleanName&&cleanLabel.toLowerCase().endsWith(suffix.toLowerCase())?cleanLabel.slice(0,-suffix.length):cleanLabel;
 const topic=topicLabel.toLowerCase().replace(/\bseo\b/g,'SEO');
 return {subjectProject,topic:titles.length&&topic?topic:'your project',quotes};
}
function stageDraft(c,l,stage){
 const recipient=field(c?.email)||field(l?.email);
 const contact=firstName(field(c?.contact)||field(l?.contactName));
 const name=field(c?.name)||field(l?.businessName)||'your business';
 const greeting=contact?'Hello '+contact+',\n\n':'Hello,\n\n';
 const {subjectProject,topic,quotes}=projectDetails(c,l,stage);
 let subject,message;
 switch(stage){
 case 'Research':
 case 'Found':
  subject=subjectProject+' — an idea for you';
  message="I'm Chip, and I help businesses make the most of their digital presence.\n\n"+(topic!=='your project'?'I would love to explore how '+topic+' could support '+name+'. ':'I would love to explore how I could help '+name+'. ')+'A short chat would give us a chance to look at what you need and find a practical way forward. Would you have time for a quick conversation this week?';
  break;
 case 'Contact':
  subject=subjectProject+' — following up';
  message='I wanted to follow up on my recent message about '+topic+'. I would really welcome the opportunity to help '+name+' and explore what we could achieve together.\n\nThe next step can be as simple as a short chat to work out what would suit you best. Would you have a convenient time this week?';
  break;
 case 'Follow-up':
  subject=subjectProject+' — shall we take the next step?';
  message='I wanted to check back in about '+topic+' for '+name+'. I would love to help you move this forward and make the process as straightforward as possible.\n\nIf there is anything you are unsure about, or if your requirements have changed, we can work through it together. Would you like to arrange a quick chat and decide on the best next step?';
  break;
 case 'Interested':
  subject=subjectProject+' — next steps';
  message='Thank you for your interest in working together on '+topic+'. I am looking forward to exploring how we can make this work for '+name+'.\n\nA brief conversation about your requirements will help me put together the right approach. Let me know a convenient time and we can start turning your ideas into a plan.';
  break;
 case 'Quote':
  subject=subjectProject+' — quotation follow-up';
  message='I wanted to follow up on the quotation for '+topic+' and see what you think. I would love to work with you on this and help bring the project to life.\n\nIf you have any questions or would like to adjust anything, I am happy to talk through the options so we can find an approach that works for you.';
  if(quotes.length===1)message+='\n\nYou can review your quotation here:\n'+field(quotes[0].interactive.url);
  else if(quotes.length>1)message+='\n\nYou can review your quotations here:\n'+quotes.map(q=>(field(q.number)||'Quotation')+': '+field(q.interactive.url)).join('\n');
  message+='\n\nIf you are happy with the proposal, let me know and we can agree the next steps to get things underway.';
  break;
 case 'Won':
  subject=subjectProject+' — getting started';
  message='Thank you for choosing to work with me on '+topic+'. I am looking forward to getting things moving for '+name+'.\n\nI would like to make sure we have everything in place for a smooth start. Let me know when you are available to go through the next steps, and we can get the project underway.';
  break;
 case 'Lost':
  subject=subjectProject+' — thank you for your time';
  message='Thank you for taking the time to consider working together. I appreciate that now may not be the right time to move forward.\n\nIf your plans change in the future, I would be very happy to pick things up again and help you find the right approach. Wishing you all the best in the meantime.';
  break;
 default:
  subject=subjectProject+' — checking in';
  message='I hope everything is going well with '+name+'. I wanted to check in on '+topic+' and make sure you are getting what you need from it.\n\nIf there are any improvements you would like to make, new ideas you want to explore, or anything I can help with, I would be happy to discuss them. Let me know how things are going.';
 }
 const demo=field(l?.demoUrl);
 if(['Research','Found','Contact','Follow-up','Interested'].includes(stage)&&/^https:\/\/chipbutt\.github\.io\/HospoLP\/samples\/[a-z0-9-]+\/?$/i.test(demo))message+='\n\nYou can also view the website demonstration here:\n'+demo;
 return {recipient,subject,body:greeting+message+'\n\n'+signature()};
}
// Uses the already-authorised Gmail draft service. No plain-text fallback or auto-send.
async function openFormatted(d){
 if(!validEmail(d.recipient)){toast('A valid recipient email address is required.');return false;}
 const tab=window.open('about:blank','_blank');
 if(tab)try{tab.opener=null;tab.document.body.textContent='Creating your formatted Gmail draft…';}catch{}
 try{
  if(!window.ChipInSharedHQ?.token)throw Error('Sign in to shared HQ to create a formatted draft.');
  const token=await window.ChipInSharedHQ.token();
  const response=await fetch('/hq/email-draft',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({to:d.recipient,subject:d.subject,body:d.body}),cache:'no-store'});
  const result=await response.json();
  if(!response.ok||!result.ok||!/^https:\/\/mail\.google\.com\/mail\/u\/\?authuser=[^#]+#(?:all\/[a-f0-9]+|drafts)$/i.test(result.open_url||''))throw Error(result.error||'Gmail could not create the draft.');
  if(tab&&!tab.closed)tab.location.replace(result.open_url);
  else openModal('<h2>Formatted Gmail draft created</h2><p class="sub">Your draft is saved in Gmail. Open it to review and send manually.</p><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Close</button><a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(result.open_url)+'">Open Gmail draft</a></div>');
  toast('Formatted Gmail draft created. Nothing has been sent.');return true;
 }catch(e){if(tab&&!tab.closed)tab.close();toast(e.message||'Could not create formatted Gmail draft.');return false;}
}
function forPipelineClient(c,lead,stage){
 if(!c)return false;
 const d=stageDraft(c,lead,stage||c.pipelineStage||(c.archivedAt?'Lost':'Client'));
 if(stage==='Quote'&&!quoteLinks(c).length)toast('No active online quotation link is saved for this client. Check the quotation before sending.');
 return openFormatted(d);
}
function forSalesLead(l){
 if(!l)return false;
 const c=(state.clients||[]).find(c=>(c.sourceLeadId&&(c.sourceLeadId===l.id||c.sourceLeadId===l.sourceLeadId))||(l.convertedClientId&&c.id===l.convertedClientId)||(l.clientRecordId&&c.id===l.clientRecordId));
 const d=stageDraft(c,l,l.stage||'Research');
 if(l.stage==='Quote'&&!quoteLinks(c).length)toast('No active online quotation link is saved for this client. Check the quotation before sending.');
 return openFormatted(d);
}
function forClient(c,kind='intro'){
 if(!c)return false;
 return forPipelineClient(c,null,c.pipelineStage||(c.archivedAt?'Lost':kind==='followup'?'Contact':'Found'));
}
window.ChipInEmailDrafts={open,link,urlFor,forSalesLead,forClient,forPipelineClient,stageLabel,stageDraft,signature,firstName,quoteLinks,openFormatted};
})();
