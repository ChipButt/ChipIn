const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('client-meeting/index.html','utf8');
const script=fs.readFileSync('client-meeting/meeting.js','utf8');
function open(existing){
 const dom=new JSDOM(html,{url:'https://chipinworks.co.uk/client-meeting/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});
 w.print=()=>{w._prints=(w._prints||0)+1};
 w.alert=()=>{};
 w.confirm=()=>true;
 w.TextEncoder=TextEncoder;
 w.open=(url,where,features)=>{w._lastOpened=url;return {closed:false};};
 if(existing)w.localStorage.setItem('chipin-client-meetings-v2',existing);
 w.eval(script);
 return w;
}
const w=open(),d=w.document,f=d.getElementById('meetingForm');
const input=(name,value)=>{
 const el=f.elements.namedItem(name);
 if(!el)throw new Error('Missing field '+name);
 if(el.length&&el[0].type==='radio')for(const r of Array.from(el))r.checked=r.value===value;
 else el.value=value;
 f.dispatchEvent(new w.Event('change',{bubbles:true}));
};
const text=()=>d.getElementById('liveQuote').textContent;
assert.match(text(),/£250/);
assert.equal(f.elements.namedItem('hostingChoice').value,'chipin');
assert.match(text(),/static hosting via Cloudflare Pages — £0 included/i);
assert.equal(d.getElementById('heroBusiness').textContent,'New client');
assert.equal(d.querySelectorAll('[name="includedPages"]:checked').length,7);
assert.equal(d.querySelectorAll('section.pane').length,9);
assert.equal(f.elements.namedItem('business').value,'');
input('business','Test Cafe');
input('location','Evesham');
assert.equal(d.getElementById('heroBusiness').textContent,'Test Cafe');
assert.match(d.getElementById('heroLocation').textContent,/Evesham/);
d.getElementById('plansTop').click();
assert.equal(d.querySelector('section.pane[data-pane="6"]').hidden,false);
input('care','care');
input('domainChoice','chipin');
input('hostingChoice','client');
d.getElementById('quoteTop').click();
assert.match(text(),/£49/);
assert.match(text(),/£20/);
assert.match(text(),/£858/);
input('extraPages','1');
assert.match(text(),/£908/);
input('care','partner');
assert.match(text(),/£1,388/);
input('hostingChoice','chipin');
assert.match(text(),/Cloudflare Pages — £0 included/i);
assert.doesNotMatch(d.getElementById('readiness').textContent,/hosting scope and price/i);
input('hostingChoice','special');
assert.match(d.getElementById('readiness').textContent,/Special hosting or server costs must be agreed/i);
input('hostingChoice','chipin');
assert.doesNotMatch(text(),/£1,532/);
const food=d.querySelector('input[name="includedPages"][value="Food / Menu"]');
food.checked=false;
food.dispatchEvent(new w.Event('change',{bubbles:true}));
assert.equal(f.elements.namedItem('assetFood').value,'Not needed');
assert.doesNotMatch(text(),/Home; About \/ Our Business; Food \/ Menu/);
assert.equal(d.querySelectorAll('[name="includedPages"]:checked').length,6);
// The client commits to a latest asset date; timeline stays projected until ALL assets actually arrive.
input('contentDue','2026-11-06'); // Friday
assert.match(d.getElementById('readiness').textContent,/Agree number of calendar days/i);
input('buildDays','7'); // 7 calendar days
let schedule=d.getElementById('timelinePreview').textContent;
assert.match(schedule,/13\/11\/2026/); // first version
assert.match(schedule,/16\/11\/2026/); // 3 calendar day review
assert.match(schedule,/23\/11\/2026/); // 5 working days: Tue-Fri then Mon
assert.match(schedule,/24\/11\/2026/);
assert.match(schedule,/25\/11\/2026/);
assert.match(schedule,/Illustrative ONLY/i);
assert.match(text(),/Agreed project delivery timeline/);
input('assetsReceivedDate','2026-11-09'); // Actual receipt pushes dates forwards
schedule=d.getElementById('timelinePreview').textContent;
assert.match(schedule,/16\/11\/2026/); // first version
assert.match(schedule,/19\/11\/2026/); // review due
assert.match(schedule,/26\/11\/2026/); // 5 working days after review
assert.match(schedule,/27\/11\/2026/); // illustrative launch +24h
input('finalApprovalDate','2026-11-30');
assert.match(d.getElementById('timelinePreview').textContent,/02\/12\/2026/);
assert.doesNotMatch(d.getElementById('timelinePreview').textContent,/Illustrative ONLY/i);
input('contentDue','2026-12-21');
input('buildDays','2');
input('assetsReceivedDate',''); // projected timeline through Christmas/New Year bank holidays
input('finalApprovalDate','');
schedule=d.getElementById('timelinePreview').textContent;
assert.match(schedule,/23\/12\/2026/); // first version
assert.match(schedule,/26\/12\/2026/); // 3-day review
assert.match(schedule,/05\/01\/2027/); // 5 working days after Dec 26 incl Boxing and New Year
input('contentDue','2026-11-06');
input('buildDays','7');
input('assetsReceivedDate','2026-11-09');
input('deliveryMethod','folder');
input('assetPhotos','To supply');
d.getElementById('printHandover').click();
assert.equal(w._prints,1);
assert.match(d.getElementById('printArea').textContent,/private upload-folder invitation/i);
assert.match(d.getElementById('printArea').textContent,/Approved photographs/);
assert.match(d.getElementById('printArea').textContent,/five UK working days/i);
assert.match(d.getElementById('printArea').textContent,/26\/11\/2026/);
input('uploadFolder','https://drive.google.com/drive/folders/demo123');
d.getElementById('printQuote').click();
assert.equal(w._prints,2);
assert.match(d.getElementById('printArea').textContent,/drive.google.com/);
assert.match(d.getElementById('printArea').textContent,/£0 included/);
assert.match(d.getElementById('printArea').textContent,/asset/i);
d.getElementById('plansTop').click();
d.getElementById('printPlans').click();
assert.equal(w._prints,3);
assert.match(d.getElementById('printArea').textContent,/Website Health/);
assert.ok(w.localStorage.getItem('chipin-client-meetings-v2'));
const oldName=f.elements.namedItem('business').value;
d.getElementById('newClient').click();
assert.equal(f.elements.namedItem('business').value,'');
assert.equal(d.querySelectorAll('[name="includedPages"]:checked').length,7);
assert.equal(f.elements.namedItem('hostingChoice').value,'chipin');
input('business','Second Client');
let select=d.getElementById('projectPicker');
assert.equal(select.options.length,2);
const first=Array.from(select.options).find(x=>x.textContent.includes('Test Cafe'));
assert.ok(first);
select.value=first.value;
select.dispatchEvent(new w.Event('change',{bubbles:true}));
assert.equal(f.elements.namedItem('business').value,oldName);
assert.equal(f.elements.namedItem('assetFood').value,'Not needed');
assert.equal(d.querySelectorAll('[name="includedPages"]:checked').length,6);
assert.equal(f.elements.namedItem('buildDays').value,'7');
// Client workspace is only provisioned after both the Apps Script setup and written quote acceptance.
d.getElementById('quoteTop').click();
input('deliveryMethod','portal');
d.getElementById('activateAssets').click();
assert.match(d.getElementById('activationStatus').textContent,/one-time Google Apps Script setup/i);
assert.equal(w._lastOpened,undefined);
d.getElementById('onboardingReady').checked=true;
d.getElementById('onboardingReady').dispatchEvent(new w.Event('change',{bubbles:true}));
d.getElementById('activateAssets').click();
assert.match(d.getElementById('activationStatus').textContent,/accepted the written quotation/i);
assert.equal(w._lastOpened,undefined);
d.getElementById('quoteApproved').checked=true;
d.getElementById('quoteApproved').dispatchEvent(new w.Event('change',{bubbles:true}));
input('email','contact@testcafe.example');
input('contact','Alex Owner');
d.getElementById('activateAssets').click();
assert.match(w._lastOpened,/mode=onboard-admin#brief=/);
const encoded=decodeURIComponent(w._lastOpened.split('#brief=')[1]).replace(/-/g,'+').replace(/_/g,'/');
const onboardingData=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));
assert.equal(onboardingData.business,'Test Cafe');
assert.equal(onboardingData.email,'contact@testcafe.example');
assert.equal(onboardingData.brief.fields.buildDays,'7');
assert.equal(onboardingData.brief.fields.assetsReceivedDate,'2026-11-09');
assert.equal(onboardingData.brief.fields.hostingChoice,'chipin');
assert.deepEqual(onboardingData.brief.fields.quoteApproved,['on']); // checkbox captured in structured brief
input('clientPortalUrl','https://script.google.com/macros/s/EXAMPLE/exec?mode=onboard-upload&code=private');
d.getElementById('printHandover').click();
assert.match(d.getElementById('printArea').textContent,/mode=onboard-upload/);
const saved=w.localStorage.getItem('chipin-client-meetings-v2');
const w2=open(saved);
assert.equal(w2.document.getElementById('heroBusiness').textContent,oldName);
const b=w2.document.getElementById('downloadBuildBrief');
assert.ok(b);
const source=fs.readFileSync('client-meeting/meeting.js','utf8');
assert.match(source,/function buildBriefMarkdown/);
assert.match(source,/## Build instructions for a new ChatGPT work session/);
console.log('PASS: free commercial static hosting, quote timeline from agreed client deadline, 3 calendar day feedback, 5 UK working days incl bank holidays, conditional DNS window, owner activation, print handover and saved client sessions.');
