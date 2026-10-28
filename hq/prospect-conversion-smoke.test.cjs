// Regression tests for the HQ won-prospect handover.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

function createApp(withExisting=false) {
  const dom = new JSDOM('<div id="content"></div><div id="modalBody"></div>', {
    url: 'https://chipinworks.co.uk/hq/', runScripts: 'outside-only'
  });
  const w = dom.window;
  const salesLead = {
    id: 'lead_bulls_001', businessName: 'The Bulls Head', contactName: 'Manager',
    email: 'manager@example.test', phone: '01234 567890',
    address: 'Bidford-on-Avon', website: '', service: 'Website Design',
    estimatedValue: 250, notes: '', problem: 'Website build', stage: 'Won'
  };
  const state = {
    settings: {nextJobNumber: 1},
    clients: withExisting ? [{id:'cli_existing_001',name:'The Bulls Head',contact:'Manager',
      email:'manager@example.test',phone:'',address:'',notes:''}] : [],
    jobs: withExisting ? [{id:'job_existing_001',clientId:'cli_existing_001',
      title:'The Bulls Head website build',category:'Website',status:'Booked',
      reference:'JOB-2026-0001',rate:250,amount:250,days:1,rateType:'day'}] : [],
    salesAssistant: {leads:[salesLead],activity:[]}
  };
  const library = {activeId:'bulls-meeting',projects:{
    'bulls-meeting':{
      version:2,projectId:'bulls-head-project',fields:{
        business:'The Bulls Head',meetingDate:'2026-10-28',contact:'Manager',
        email:'manager@example.test'
      }
    }
  }};
  w.localStorage.setItem('chipin-client-meetings-v2', JSON.stringify(library));
  let sequence = 0;
  Object.assign(w, {
    state, page:'sales', structuredClone:global.structuredClone,
    $:(selector,root=w.document)=>root.querySelector(selector),
    $$:(selector,root=w.document)=>Array.from(root.querySelectorAll(selector)),
    esc:(v='')=>String(v??'').replace(/[&<>'"]/g, c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    }[c])),
    uid: prefix=>prefix+'_test_'+String(++sequence).padStart(5,'0'),
    TODAY:()=> '2026-10-28',
    saveState:async()=>{},
    toast:message=>{w._toast=message},
    clientById:id=>state.clients.find(c=>c.id===id),
    jobById:id=>state.jobs.find(j=>j.id===id),
    chipInNextJobReference:()=> 'JOB-2026-'+String(state.settings.nextJobNumber++).padStart(4,'0'),
    openModal:html=>{w.document.getElementById('modalBody').innerHTML=html},
    closeModal:()=>{w.document.getElementById('modalBody').innerHTML=''},
    openJobForm:()=>{}, render:()=>{},
    renderSales:()=>{w.document.getElementById('content').innerHTML='<div class="sales-pipeline"></div>'},
    renderJobs:()=>{w.document.getElementById('content').innerHTML='<div class="table-wrap"></div>'},
    open:url=>{w._opened=url}
  });
  w.eval(fs.readFileSync('hq/app21_prospect_conversion.js','utf8'));
  return {w,state};
}
function submit(form,w) {
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
}
async function tick() {await new Promise(resolve=>setTimeout(resolve,0))}
async function testNewConversion() {
  const {w,state}=createApp();
  w.renderSales();
  assert.match(w.document.getElementById('content').textContent,/Create client \+ job/);
  w.ChipInProspectConversion.start('lead_bulls_001');
  const cf=w.document.getElementById('hqConversionClient');
  assert.equal(cf.elements.name.value,'The Bulls Head');
  assert.equal(cf.elements.email.value,'manager@example.test');
  cf.elements.confirmedClient.checked=true;
  submit(cf,w);
  const jf=w.document.getElementById('hqConversionJob');
  assert.equal(jf.elements.category.value,'Website');
  assert.equal(jf.elements.meetingId.value,'bulls-meeting');
  assert.equal(jf.elements.amount.value,'250');
  jf.elements.confirmedJob.checked=true;
  submit(jf,w);
  await tick();
  assert.equal(state.clients.length,1);
  assert.equal(state.jobs.length,1);
  assert.equal(state.jobs[0].clientId,state.clients[0].id);
  assert.equal(state.jobs[0].meetingId,'bulls-meeting');
  assert.equal(state.salesAssistant.leads[0].convertedJobId,state.jobs[0].id);
  const saved=JSON.parse(w.localStorage.getItem('chipin-client-meetings-v2'));
  assert.equal(saved.projects['bulls-meeting'].hqJobId,state.jobs[0].id);
  assert.equal(saved.projects['bulls-meeting'].projectId,'bulls-head-project');
  w.ChipInProspectConversion.start('lead_bulls_001');
  assert.match(w.document.getElementById('modalBody').textContent,/Already converted/);
  assert.equal(state.jobs.length,1);
  w.ChipInProspectConversion.openMeetingForJob(state.jobs[0].id);
  assert.match(w._opened,/meetingId=bulls-meeting/);
  assert.match(w._opened,/projectId=bulls-head-project/);
}
async function testExistingRecords() {
  const {w,state}=createApp(true);
  // The existing meeting is already linked to the existing website job.
  const lib=JSON.parse(w.localStorage.getItem('chipin-client-meetings-v2'));
  lib.projects['bulls-meeting'].hqJobId='job_existing_001';
  lib.projects['bulls-meeting'].hqClientId='cli_existing_001';
  w.localStorage.setItem('chipin-client-meetings-v2',JSON.stringify(lib));
  w.ChipInProspectConversion.start('lead_bulls_001');
  const cf=w.document.getElementById('hqConversionClient');
  assert.equal(cf.elements.existingClientId.value,'cli_existing_001');
  cf.elements.confirmedClient.checked=true;
  submit(cf,w);
  const jf=w.document.getElementById('hqConversionJob');
  assert.equal(jf.elements.existingJobId.value,'job_existing_001');
  assert.equal(jf.elements.meetingId.value,'bulls-meeting');
  jf.elements.confirmedJob.checked=true;
  submit(jf,w);
  await tick();
  assert.equal(state.clients.length,1);
  assert.equal(state.jobs.length,1);
  assert.equal(state.salesAssistant.leads[0].convertedClientId,'cli_existing_001');
  assert.equal(state.salesAssistant.leads[0].convertedJobId,'job_existing_001');
}
(async () => {
  await testNewConversion();
  await testExistingRecords();
  console.log('HQ prospect conversion tests passed');
})().catch(e => {console.error(e);process.exitCode=1});