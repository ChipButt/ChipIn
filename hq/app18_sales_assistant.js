// Chip In HQ - Sales Assistant
(function(){
  'use strict';

  function ensureSales(){
    state.salesAssistant = state.salesAssistant || {};
    const s = state.salesAssistant;
    s.targets = Object.assign({monthlyClients:3,prospects:50,conversations:15,quotes:6}, s.targets||{});
    s.leads = Array.isArray(s.leads)?s.leads:[];
    s.activity = Array.isArray(s.activity)?s.activity:[];
    s.settings = Object.assign({defaultFollowUpDays:5}, s.settings||{});
    return s;
  }
  const sales = ()=>ensureSales();
  const stageOrder=['Found','Research','Contact','Follow-up','Interested','Quote','Won','Lost'];
  const methodLabels={research:'RESEARCH',email:'EMAIL',call:'CALL',visit:'VISIT'};
  const methodIcon={research:'⌕',email:'✉',call:'☎',visit:'⌖'};
  const leadById=id=>sales().leads.find(x=>x.id===id);

  function monthKey(d=new Date()){return d.toISOString().slice(0,7)}
  function activityThisMonth(type){
    const m=monthKey();
    return sales().activity.filter(a=>(a.date||'').slice(0,7)===m && (!type||a.type===type));
  }
  function countStage(stages){return sales().leads.filter(l=>stages.includes(l.stage)).length}
  function prospectStats(){
    return {
      prospects:sales().leads.length,
      conversations:activityThisMonth('conversation').length,
      quotes:activityThisMonth('quote').length,
      won:activityThisMonth('won').length
    };
  }
  function targetPct(v,t){return Math.min(100, Math.round((Number(v)||0)/Math.max(1,Number(t)||1)*100))}
  function dueActions(){
    const today=TODAY();
    return sales().leads
      .filter(l=>!['Won','Lost'].includes(l.stage))
      .filter(l=>l.nextActionDate && l.nextActionDate<=today)
      .sort((a,b)=>(a.nextActionDate||'').localeCompare(b.nextActionDate||''));
  }
  function futureActions(){
    const today=TODAY();
    return sales().leads
      .filter(l=>!['Won','Lost'].includes(l.stage))
      .filter(l=>l.nextActionDate && l.nextActionDate>today)
      .sort((a,b)=>a.nextActionDate.localeCompare(b.nextActionDate))
      .slice(0,8);
  }
  function contactFor(l){
    if(l.nextActionMethod==='research')return l.website||l.address||'Research source not recorded';
    if(l.nextActionMethod==='email')return l.email||'Email not recorded';
    if(l.nextActionMethod==='call')return l.phone||'Phone not recorded';
    return l.address||'Address not recorded';
  }
  function mapsUrlFor(l){
    const destination=[l.businessName,l.address].filter(Boolean).join(', ');
    return destination?'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination):'';
  }
  function contactHtml(l){
    if(l.nextActionMethod==='visit'&&l.address){
      return `<a class="sales-map-link" href="${mapsUrlFor(l)}" target="_blank" rel="noopener" aria-label="Open ${esc(l.businessName||'this address')} in Google Maps">${esc(l.address)} <span aria-hidden="true">↗</span></a>`;
    }
    return esc(contactFor(l));
  }
  function reasonFor(l){
    if(l.nextActionReason)return l.nextActionReason;
    if(l.stage==='Found')return 'New prospect ready to research or contact.';
    if(l.stage==='Research')return 'Research the business and identify a genuine opportunity before contacting them.';
    if(l.stage==='Contact')return 'Initial contact is due.';
    if(l.stage==='Follow-up')return 'Follow up the previous contact.';
    if(l.stage==='Interested')return 'Keep the conversation moving.';
    if(l.stage==='Quote')return 'Check whether they have reviewed the quote.';
    return 'Next sales action is due.';
  }
  function deterministicScript(l){
    const name=l.contactName?l.contactName:l.businessName;
    const service=l.service||'help with the business';
    const previous=(l.lastContactSummary||'').trim();
    if(l.nextActionMethod==='research')return `Check ${l.businessName}${l.website?' at '+l.website:''}. Confirm the decision-maker/contact details, what they currently have, and one genuine problem or opportunity Chip In could help with. Record only verified facts before moving this lead to Contact.`;
    if(l.nextActionMethod==='email'){
      if(previous)return `Hi ${name}, it’s Chip from Chip In. I’m following up on ${previous.replace(/[.!?]+$/,'')}. I just wanted to see whether ${service.toLowerCase()} is still something you’d like to discuss. No pressure at all — happy to help if the timing is right.`;
      return `Hi ${name}, I’m Chip from Chip In. I came across ${l.businessName} and thought I might be able to help with ${service.toLowerCase()}. I’m local and happy to have a quick chat if it would be useful.`;
    }
    if(l.nextActionMethod==='call'){
      if(previous)return `Hi ${name}, it’s Chip from Chip In. We spoke about ${service.toLowerCase()} and I said I’d follow up. I just wanted to see where things had got to and whether it would be useful to take the next step.`;
      return `Hi, it’s Chip from Chip In. I’m local and I help small businesses with practical and creative jobs. I wanted to ask whether ${service.toLowerCase()} is something you might need a hand with.`;
    }
    if(previous)return `Hi ${name}, I’m Chip from Chip In. We spoke about ${service.toLowerCase()} recently, so I thought I’d pop in rather than send another message and see what you thought.`;
    return `Hi, I’m Chip. I run a local business called Chip In. I noticed ${l.problem||'there may be something I can help with'} and thought it would be better to pop in and introduce myself than send a random email.`;
  }
  function actionCard(l){
    const overdue=l.nextActionDate<TODAY();
    const isResearch=l.nextActionMethod==='research';
    const script=l.aiReply||deterministicScript(l);
    return `<article class="sales-action-card ${overdue?'overdue':''}">
      <div class="sales-action-head"><span class="sales-method">${methodIcon[l.nextActionMethod]||'•'} ${methodLabels[l.nextActionMethod]||'CONTACT'}</span><span class="badge ${overdue?'bad':'warn'}">${overdue?'Overdue':fmtDate(l.nextActionDate)+(l.nextActionTime?' · '+esc(l.nextActionTime):'')}</span></div>
      <h3>Chip, you need to ${isResearch?'RESEARCH':' '+(methodLabels[l.nextActionMethod]||'CONTACT')} <strong>${esc(l.businessName)}</strong></h3>
      <div class="sales-contact">${contactHtml(l)}</div>
      <p><strong>Why:</strong> ${esc(reasonFor(l))}</p>
      ${isResearch
        ? `<div class="sales-script"><div class="sales-script-label">Research required</div><p>${esc(script)}</p></div>`
        : `<div class="sales-script"><div class="sales-script-label">You should say</div><p>“${esc(script)}”</p></div>`
      }
      ${l.aiReply?'<div class="sales-ai-flag">AI research/wording saved for this action</div>':''}
      ${!isResearch&&l.websiteStatus==='no_functioning_site'?`<div class="hint-box" style="margin-top:10px"><strong>Website opportunity</strong><div style="margin-top:4px">${esc(l.websiteEvidence||'Research did not verify a functioning standalone website.')}</div><div class="row-actions" style="margin-top:8px;justify-content:flex-start;flex-wrap:wrap">${l.demoUrl?`<button class="btn small gold" data-sales-action="open-demo" data-id="${l.id}">Open demo website</button>`:l.demoStatus==='queued'?'<span class="badge warn">Demo website queued</span>':`<button class="btn small gold" data-sales-action="generate-demo" data-id="${l.id}">Generate Demo Website</button>`}</div></div>`:''}
      <div class="row-actions sales-card-actions">
        ${isResearch
          ? (l.researchStatus==='queued'
              ? `<span class="badge warn">Queued for automatic research</span><button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Edit</button>`
              : `<button class="btn small secondary" data-sales-action="copy-research" data-id="${l.id}">Copy research brief</button>
                 <button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Edit</button>
                 <button class="btn small" data-sales-action="done" data-id="${l.id}">Mark researched</button>`)
          : `${['call','visit'].includes(l.nextActionMethod)?`<button class="btn small gold" data-sales-action="schedule-contact" data-id="${l.id}">${l.nextActionTime?'Reschedule':'Schedule'} ${l.nextActionMethod==='visit'?'visit':'call'}</button>`:''}
             <button class="btn small secondary" data-sales-action="copy-script" data-id="${l.id}">Copy wording</button>
             <button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Edit</button>
             <button class="btn small" data-sales-action="done" data-id="${l.id}">Mark done</button>`
        }
      </div>
    </article>`;
  }

  function demoPayload(l){
    return {
      businessName:l.businessName||'Business',
      category:l.category||l.demoProfile?.businessType||'',
      service:l.service||'',
      address:l.address||'',
      phone:l.phone||'',
      email:l.email||'',
      researchSummary:l.researchSummary||'',
      opportunity:l.problem||'',
      websiteEvidence:l.websiteEvidence||'',
      demoProfile:l.demoProfile||null,
      images:Array.isArray(l.demoImages)?l.demoImages:[],
      openingHours:Array.isArray(l.openingHours)?l.openingHours:[],
      openingHoursSource:l.openingHoursSource||'',
      openingHoursVerified:l.openingHoursVerified===true,
      generatedAt:new Date().toISOString()
    };
  }
  function encodeDemoPayload(payload){
    const bytes=new TextEncoder().encode(JSON.stringify(payload));
    let raw='';for(let i=0;i<bytes.length;i++)raw+=String.fromCharCode(bytes[i]);
    return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function buildLocalDemo(l){
    if(l.demoRenderer==='hospolp-published'&&/^https:\/\/chipbutt\.github\.io\/HospoLP\/samples\//.test(l.demoUrl||''))return l.demoUrl;
    l.demoStatus='ready';
    l.demoBuiltAt=new Date().toISOString();
    l.demoSlug=l.demoSlug&&l.demoSlug!=='hq-concept-preview'&&l.demoSlug!=='hq-multipage-demo'?l.demoSlug:'hq-multipage-demo';
    l.demoRenderer='hq-multipage-draft';
    l.demoUrl=new URL('demo-site/',location.href).href+'#'+encodeDemoPayload(demoPayload(l));
    l.updatedAt=new Date().toISOString();
    return l.demoUrl;
  }
  async function syncLocalDemoRecord(l){
    if(typeof ghUnlocked==='undefined'||!ghUnlocked||typeof getFile!=='function'||typeof putFile!=='function')return;
    try{
      const path='sales-assistant/demo-website-queue.json';
      const qf=await getFile(path);
      const q=qf?JSON.parse(qf.text):{version:1,requests:[]};
      q.requests=Array.isArray(q.requests)?q.requests:[];
      let req=q.requests.find(x=>x.leadId===l.id);
      if(!req){
        req={leadId:l.id,businessName:l.businessName||'',websiteStatus:l.websiteStatus||'',queuedAt:l.demoBuiltAt,status:'built_local'};
        q.requests.push(req);
      }
      Object.assign(req,{status:'built_local',builtAt:l.demoBuiltAt,demoUrl:l.demoUrl,renderer:'hq-multipage-demo'});
      await putFile(path,JSON.stringify(q,null,2),'Record HQ-generated demo website',qf?.sha||'');

      const resultPath='sales-assistant/demo-website-results.json';
      const rf=await getFile(resultPath);
      const data=rf?JSON.parse(rf.text):{version:1,results:[]};
      data.results=Array.isArray(data.results)?data.results:[];
      const result={leadId:l.id,businessName:l.businessName||'',slug:l.demoSlug||'',demoUrl:l.demoUrl,builtAt:l.demoBuiltAt,summary:'Multi-page HospoLP-style concept website generated directly by Chip In HQ from verified research data.',renderer:'hq-multipage-demo',status:'ready'};
      const i=data.results.findIndex(x=>x.leadId===l.id);
      if(i>=0)data.results[i]={...data.results[i],...result};else data.results.push(result);
      await putFile(resultPath,JSON.stringify(data,null,2),'Record HQ demo website result',rf?.sha||'');
    }catch(e){console.warn('Demo record sync failed; local demo remains available',e)}
  }
  async function processLocalDemoQueue(){
    if(typeof ghUnlocked==='undefined'||!ghUnlocked||typeof getFile!=='function'||typeof putFile!=='function')return false;
    const path='sales-assistant/demo-website-queue.json';
    const qf=await getFile(path);if(!qf)return false;
    const q=JSON.parse(qf.text);q.requests=Array.isArray(q.requests)?q.requests:[];
    const pending=q.requests.filter(x=>['queued','building'].includes(x.status));
    if(!pending.length)return false;
    let changed=false,stateChanged=false;
    const built=[];
    for(const req of pending){
      let l=leadById(req.leadId)||sales().leads.find(x=>(x.businessName||'').toLowerCase()===(req.businessName||'').toLowerCase());
      if(!l&&req.leadId){
        l={id:req.leadId,createdAt:req.queuedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),businessName:req.businessName||'',contactName:req.contactName||'',email:req.email||'',phone:req.phone||'',website:req.website||'',address:req.address||'',service:req.service||'Website Design',problem:req.opportunity||'',researchSummary:req.researchSummary||'',websiteStatus:req.websiteStatus||'',websiteEvidence:req.websiteEvidence||'',researchSources:req.sources||[],estimatedValue:'',stage:'Contact',nextActionMethod:req.email?'email':req.phone?'call':req.address?'visit':'research',nextActionDate:TODAY(),nextActionReason:req.opportunity||'Demo website ready; make contact.',notes:'',researchStatus:'complete'};
        sales().leads.push(l);stateChanged=true;
      }
      if(!l)continue;
      if((l.websiteStatus||req.websiteStatus)!=='no_functioning_site'){
        req.status='needs_review';req.reason='HQ will only generate a prospect demo after Research confirms no functioning standalone website.';changed=true;continue;
      }
      if(!l.websiteStatus)l.websiteStatus=req.websiteStatus;
      if(!l.websiteEvidence)l.websiteEvidence=req.websiteEvidence||'';
      buildLocalDemo(l);
      Object.assign(req,{status:'built_local',builtAt:l.demoBuiltAt,demoUrl:l.demoUrl,renderer:'hq-multipage-demo'});
      built.push(l);changed=true;stateChanged=true;
    }
    if(stateChanged)await saveState();
    if(changed){
      try{await putFile(path,JSON.stringify(q,null,2),'Convert queued demos to HQ concept previews',qf.sha)}catch(e){console.warn('Demo queue status sync failed',e)}
      for(const l of built)await syncLocalDemoRecord(l);
    }
    return stateChanged||changed;
  }

  async function applyResearchResults(){
    if(typeof ghUnlocked==='undefined'||!ghUnlocked||typeof getFile!=='function')return false;
    const rf=await getFile('sales-assistant/research-results.json');
    if(!rf)return false;
    const data=JSON.parse(rf.text),results=Array.isArray(data.results)?data.results:[];
    let qf=null,q={version:1,requests:[]},inboxFile=null,inbox=null;
    try{qf=await getFile('sales-assistant/research-queue.json');if(qf){q=JSON.parse(qf.text);q.requests=Array.isArray(q.requests)?q.requests:[]}}catch(e){console.warn('Research queue read failed',e)}
    try{inboxFile=await getFile('sales-assistant/prospect-inbox.json');if(inboxFile)inbox=JSON.parse(inboxFile.text)}catch(e){console.warn('Prospect inbox read failed',e)}
    let stateChanged=false,queueChanged=false,inboxChanged=false;
    for(const r of results){
      if(!r||!r.id||!['ready','applied'].includes(r.status||'ready'))continue;
      const req=(q.requests||[]).find(x=>x.id===r.id);
      let l=leadById(r.id)||sales().leads.find(x=>(x.businessName||'').toLowerCase()===(r.businessName||'').toLowerCase());
      if(!l&&req){
        l={
          id:r.id,createdAt:req.queuedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
          businessName:r.businessName||req.businessName||'',contactName:r.contactName||'',email:r.email||req.email||'',phone:r.phone||req.phone||'',
          website:r.website||req.website||'',address:r.address||req.address||'',service:r.suggestedService||req.suggestedService||'',
          problem:r.opportunity||req.discoveryReason||'',estimatedValue:'',stage:'Research',nextActionMethod:'research',nextActionDate:TODAY(),
          nextActionReason:req.discoveryReason||r.contactReason||r.opportunity||'Research this prospect.',notes:'',
          source:req.source||{},researchStatus:'queued'
        };
        sales().leads.push(l);stateChanged=true;
      }
      if(!l)continue;
      const stamp=[r.verifiedAt||'',r.businessName||'',r.websiteStatus||'',r.websiteEvidence||''].join('|');
      const needsBackfill=!l.websiteStatus&&!!r.websiteStatus || !l.websiteEvidence&&!!r.websiteEvidence || (!l.researchSources?.length&&Array.isArray(r.sources)&&r.sources.length) || (!l.openingHours?.length&&Array.isArray(r.openingHours)&&r.openingHours.length) || (!l.demoProfile&&r.demoProfile) || (!l.demoImages?.length&&Array.isArray(r.images)&&r.images.length);
      if(l.researchResultStamp===stamp&&!needsBackfill){
        if(req?.status==='queued'){req.status='researched';req.researchedAt=req.researchedAt||new Date().toISOString();queueChanged=true}
        continue;
      }
      l.researchSummary=r.researchSummary||l.researchSummary||'';
      l.problem=r.opportunity||l.problem||'';
      l.contactName=r.contactName||l.contactName||'';
      l.email=r.email||l.email||'';
      l.phone=r.phone||l.phone||'';
      l.website=r.website||l.website||'';
      l.address=r.address||l.address||'';
      l.service=r.suggestedService||l.service||'';
      l.websiteStatus=r.websiteStatus||l.websiteStatus||'';
      l.websiteEvidence=r.websiteEvidence||l.websiteEvidence||'';
      l.researchSources=Array.isArray(r.sources)?r.sources:(l.researchSources||[]);
      if(r.category)l.category=r.category;
      if(r.demoProfile&&typeof r.demoProfile==='object')l.demoProfile=r.demoProfile;
      if(Array.isArray(r.openingHours))l.openingHours=r.openingHours;
      if(r.openingHoursSource)l.openingHoursSource=r.openingHoursSource;
      if(typeof r.openingHoursVerified==='boolean')l.openingHoursVerified=r.openingHoursVerified;
      if(Array.isArray(r.images))l.demoImages=r.images;
      l.researchStatus='complete';
      l.stage='Contact';
      const preferred=r.recommendedContactMethod;
      l.nextActionMethod=['email','call','visit'].includes(preferred)?preferred:(l.email?'email':l.phone?'call':l.address?'visit':'research');
      l.nextActionDate=TODAY();l.nextActionTime='';l.nextActionDuration='';
      l.nextActionReason=r.contactReason||r.opportunity||'Research completed; make first contact.';
      if(r.suggestedOpening)l.aiReply=r.suggestedOpening;
      l.researchResultStamp=stamp;
      l.updatedAt=new Date().toISOString();
      if(req?.status==='queued'){req.status='researched';req.researchedAt=req.researchedAt||new Date().toISOString();queueChanged=true}
      const candidate=(inbox?.candidates||[]).find(x=>(x.businessName||'').toLowerCase()===(l.businessName||'').toLowerCase());
      if(candidate&&(candidate.status||'new')==='new'&&req){candidate.status='accepted';candidate.reviewedAt=candidate.reviewedAt||new Date().toISOString();inboxChanged=true}
      stateChanged=true;
    }
    if(stateChanged)await saveState();
    if(queueChanged&&qf&&typeof putFile==='function'){
      try{await putFile('sales-assistant/research-queue.json',JSON.stringify(q,null,2),'Reconcile completed prospect research',qf.sha)}catch(e){console.warn('Research queue reconcile write failed',e)}
    }
    if(inboxChanged&&inboxFile&&typeof putFile==='function'){
      try{await putFile('sales-assistant/prospect-inbox.json',JSON.stringify(inbox,null,2),'Reconcile accepted researched prospects',inboxFile.sha)}catch(e){console.warn('Prospect inbox reconcile write failed',e)}
    }
    return stateChanged||queueChanged||inboxChanged;
  }

  async function queueExistingResearchProspects(){
    if(typeof ghUnlocked==='undefined'||!ghUnlocked||typeof getFile!=='function'||typeof putFile!=='function')return false;
    const researchLeads=sales().leads.filter(l=>l.stage==='Research');
    if(!researchLeads.length)return false;
    const path='sales-assistant/research-queue.json';
    const qf=await getFile(path);
    const q=qf?JSON.parse(qf.text):{version:1,requests:[]};
    q.requests=Array.isArray(q.requests)?q.requests:[];
    const existing=new Set(q.requests.map(x=>x.id));
    let changed=false,stateChanged=false;
    for(const l of researchLeads){
      if(!existing.has(l.id)){
        q.requests.push({
          id:l.id,businessName:l.businessName||'',website:l.website||'',address:l.address||'',
          phone:l.phone||'',email:l.email||'',suggestedService:l.service||'',
          discoveryReason:l.nextActionReason||l.problem||'Research this prospect and confirm a genuine opportunity.',
          source:l.source||{},status:'queued',queuedAt:new Date().toISOString()
        });
        changed=true;
      }
      if(l.researchStatus!=='queued'){
        const req=q.requests.find(x=>x.id===l.id);
        if(req?.status==='queued'){l.researchStatus='queued';stateChanged=true;}
      }
    }
    if(changed)await putFile(path,JSON.stringify(q,null,2),'Backfill automatic prospect research queue',qf?.sha||'');
    if(stateChanged)await saveState();
    return changed||stateChanged;
  }

  async function applyDemoResults(){
    if(typeof ghUnlocked==='undefined'||!ghUnlocked||typeof getFile!=='function'||typeof putFile!=='function')return false;
    const rf=await getFile('sales-assistant/demo-website-results.json');
    if(!rf)return false;
    const data=JSON.parse(rf.text),results=Array.isArray(data.results)?data.results:[];
    let changed=false;
    for(const r of results){
      if(r.status==='applied')continue;
      const l=leadById(r.leadId)||sales().leads.find(x=>(x.businessName||'').toLowerCase()===(r.businessName||'').toLowerCase());
      if(!l)continue;
      if(r.demoUrl)l.demoUrl=r.demoUrl;
      l.demoStatus=r.demoUrl?'ready':(r.status||l.demoStatus||'');
      l.demoSlug=r.slug||l.demoSlug||'';
      l.demoBuiltAt=r.builtAt||l.demoBuiltAt||'';
      l.demoRenderer=r.renderer||l.demoRenderer||'';
      r.status='applied';r.appliedAt=new Date().toISOString();
      changed=true;
    }
    if(changed){
      await saveState();
      await putFile('sales-assistant/demo-website-results.json',JSON.stringify(data,null,2),'Apply demo website results to HQ',rf.sha);
    }
    return changed;
  }

  async function reconcileAutomaticResearch(){
    const applied=await applyResearchResults();
    const demos=await applyDemoResults();
    const localDemos=await processLocalDemoQueue();
    const queued=await queueExistingResearchProspects();
    return applied||demos||localDemos||queued;
  }

  window.renderSales = function(){
    const s=sales(), st=prospectStats(), due=dueActions(), upcoming=futureActions();
    $('#content').innerHTML=`
      <div class="sales-hero">
        <div>
          <div class="sales-kicker">SALES ASSISTANT</div>
          <h2>What you need to do next</h2>
          <p class="muted">Chip In HQ remembers the prospects, dates and follow-ups. You only have to make the contact.</p>
        </div>
        <button class="btn gold" data-sales-action="new-lead">+ Add prospect</button>
      </div>

      <div class="grid cards sales-target-grid">
        ${targetCard('New clients',st.won,s.targets.monthlyClients)}
        ${targetCard('Prospects',st.prospects,s.targets.prospects)}
        ${targetCard('Conversations',st.conversations,s.targets.conversations)}
        ${targetCard('Quotes',st.quotes,s.targets.quotes)}
      </div>

      <div class="section-title"><div><h2>Today</h2><p>${due.length?due.length+' action'+(due.length===1?'':'s')+' need your attention.':'Nothing is overdue.'}</p></div>
        <button class="btn secondary small" data-sales-action="chatgpt-pack">Copy ChatGPT briefing</button>
      </div>
      <div class="sales-action-list">${due.length?renderTodayGroups(due):`<div class="card"><div class="empty-state"><div class="empty-icon">✓</div><h3>You’re clear for now</h3><p>Add prospects or set follow-up dates and they will appear here automatically.</p></div></div>`}</div>

      <div class="section-title"><div><h2>Sourced prospects</h2><p>Prospects researched by ChatGPT appear here before they enter your live pipeline.</p></div><div class="row-actions"><button class="btn gold small" data-sales-action="sales-now">NOW</button><button class="btn secondary small" data-sales-action="refresh-inbox">Refresh</button></div></div>
      <div id="salesProspectInbox" class="card"><p class="muted">Loading sourced prospects…</p></div>

      <div class="section-title"><div><h2>Pipeline</h2><p>Move every prospect forward or deliberately close it.</p></div><button class="btn secondary small" data-sales-action="targets">Targets</button></div>
      <div class="sales-pipeline">${stageOrder.map(stage=>pipelineColumn(stage)).join('')}</div>

      <div class="section-title"><div><h2>Coming up</h2></div></div>
      <div class="card">${upcoming.length?`<div class="action-list">${upcoming.map(l=>`<div class="action-item"><div><div class="title">${methodLabels[l.nextActionMethod]||'CONTACT'} · ${esc(l.businessName)}</div><div class="meta">${fmtDate(l.nextActionDate)}${l.nextActionTime?' · '+esc(l.nextActionTime):''} · ${l.nextActionMethod==='visit'&&l.address?contactHtml(l):esc(contactFor(l))}</div></div><button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Open</button></div>`).join('')}</div>`:'<p class="muted">No future follow-ups scheduled.</p>'}</div>

      <div class="section-title"><div><h2>ChatGPT connection</h2><p>Firebase is the verified sales-data source ChatGPT will read.</p></div></div>
      <div class="card sales-api-card">
        <div><strong>Current mode:</strong> Firebase Spark sales feed</div>
        <p class="muted">HQ publishes only Sales Assistant data to Firestore. ChatGPT will be connected read-only to that Firestore feed; the rest of Chip In HQ remains separate.</p>
        <div class="hint-box"><strong>End result:</strong> ask “What do I need to do today?” and ChatGPT reads the verified Firestore feed, then returns EMAIL / CALL / VISIT, the exact contact detail, the factual reason and suggested wording.</div>
      </div>`;
    wireSalesActions();
    loadProspectInbox().catch(e=>{const el=document.getElementById('salesProspectInbox');if(el)el.innerHTML=`<p class="muted">${esc(e.message)}</p>`;});
    reconcileAutomaticResearch().then(changed=>{if(changed)setTimeout(()=>render(),0)}).catch(e=>console.warn('Automatic research reconcile failed',e));
  };

  function renderTodayGroups(due){
    const groups=[
      ['VISIT',due.filter(l=>l.nextActionMethod==='visit')],
      ['FOLLOW UP',due.filter(l=>['email','call'].includes(l.nextActionMethod))],
      ['RESEARCH',due.filter(l=>l.nextActionMethod==='research')]
    ];
    return groups.filter(([,items])=>items.length).map(([title,items])=>`<div class="sales-task-group"><h3 style="margin:4px 0 10px">${title}</h3>${items.map(actionCard).join('')}</div>`).join('');
  }

  function targetCard(label,value,target){
    return `<div class="card stat"><div class="label">${esc(label)}</div><div class="value">${value} / ${target}</div><div class="progress"><div style="width:${targetPct(value,target)}%"></div></div></div>`;
  }
  function pipelineColumn(stage){
    const ls=sales().leads.filter(l=>l.stage===stage);
    return `<div class="sales-pipeline-col"><div class="sales-pipeline-title"><span>${stage}</span><span>${ls.length}</span></div><div class="sales-pipeline-cards">${ls.map(l=>`<button class="sales-lead-card" data-sales-action="edit-lead" data-id="${l.id}"><strong>${esc(l.businessName)}</strong><span>${esc(l.service||'No service set')}</span><small>${l.nextActionDate?'Next: '+fmtDate(l.nextActionDate):'No next action'}</small></button>`).join('')||'<div class="sales-empty-col">—</div>'}</div></div>`;
  }

  function wireSalesActions(){
    $$('[data-sales-action]').forEach(b=>b.onclick=()=>salesAction(b.dataset.salesAction,b.dataset.id));
  }

  async function salesAction(action,id){
    if(action==='new-lead')return openLeadForm();
    if(action==='edit-lead')return openLeadForm(id);
    if(action==='done')return completeSalesAction(id);
    if(action==='schedule-contact')return openContactSchedule(id);
    if(action==='copy-script'){
      const l=leadById(id); if(!l)return;
      await navigator.clipboard.writeText(l.aiReply||deterministicScript(l));
      return toast('Wording copied');
    }
    if(action==='copy-research'){
      const l=leadById(id); if(!l)return;
      const brief=[
        'RESEARCH THIS CHIP IN PROSPECT',
        '',
        'Business: '+(l.businessName||''),
        'Website/source: '+(l.website||l.address||'Not recorded'),
        'Why sourced: '+reasonFor(l),
        'Suggested service: '+(l.service||'Not set'),
        '',
        'Please verify current website/online presence, public contact details, decision-maker if publicly available, what they already offer, one genuine opportunity Chip In could help with, the best contact method, and a concise factual opening reason. Do not invent facts.'
      ].join('\n');
      await navigator.clipboard.writeText(brief);
      return toast('Research brief copied');
    }
    if(action==='targets')return openTargets();
    if(action==='chatgpt-pack')return copyChatGPTPack();
    if(action==='refresh-inbox')return loadProspectInbox(true);
    if(action==='generate-demo')return generateDemoWebsite(id);
    if(action==='open-demo'){
      const l=leadById(id);if(!l)return;
      const url=buildLocalDemo(l);
      saveState().catch(()=>{});
      window.open(url,'_blank','noopener');
      return;
    }
    if(action==='sales-now'){
      try{await reconcileAutomaticResearch();await processLocalDemoQueue()}catch(e){console.warn('NOW local reconcile failed',e)}
      const prompt='Do the Chip In Sales Assistant NOW actions. HQ has already handled website-demo generation locally. Please immediately: (1) research every prospect still genuinely queued/in Research and write verified results back to sales-assistant/research-results.json, marking those research queue entries researched; and (2) check Sourced Prospects and top the pool back up to exactly 10 fresh verified prospects, avoiding anything already in the pipeline or inbox with any status. Use current web/local-business sources and do not invent facts. Do not build or publish prospect websites: HQ now generates those previews itself.';
      let copied=false;
      try{await navigator.clipboard.writeText(prompt);copied=true;}catch(e){console.warn('Clipboard copy failed',e);}
      const w=window.open('https://chatgpt.com/','_blank','noopener');
      if(copied)toast('Website demos processed · NOW prompt copied for Research + prospect refill');
      else toast('Website demos processed · ChatGPT opened');
      return w;
    }
    if(action==='accept-sourced')return acceptSourcedProspect(id);
    if(action==='reject-sourced')return rejectSourcedProspect(id);
  }

  async function generateDemoWebsite(id){
    const l=leadById(id);if(!l)return;
    if(l.websiteStatus!=='no_functioning_site')return toast('A demo is only offered when Research confirms no functioning website.');
    const url=buildLocalDemo(l);
    await saveState();
    syncLocalDemoRecord(l).catch(e=>console.warn('Demo record sync failed',e));
    render();
    window.open(url,'_blank','noopener');
    toast('Demo website generated immediately');
  }
  let sourcedInboxCache=null, sourcedInboxSha='';
  async function loadProspectInbox(showToast=false){
    const host=document.getElementById('salesProspectInbox');if(!host)return;
    if(typeof ghUnlocked==='undefined'||!ghUnlocked||typeof getFile!=='function'){
      host.innerHTML='<p class="muted">Unlock private storage to load ChatGPT-sourced prospects.</p>';
      return;
    }
    const f=await getFile('sales-assistant/prospect-inbox.json');
    if(!f){
      sourcedInboxCache={version:1,candidates:[]};sourcedInboxSha='';
      host.innerHTML='<p class="muted">No sourced prospects waiting.</p>';
      return;
    }
    sourcedInboxSha=f.sha;
    sourcedInboxCache=JSON.parse(f.text);
    const pipelineNames=new Set(sales().leads.map(l=>(l.businessName||'').toLowerCase()));
    const candidates=(sourcedInboxCache.candidates||[]).filter(x=>(x.status||'new')==='new'&&!pipelineNames.has((x.businessName||'').toLowerCase()));
    if(!candidates.length){
      host.innerHTML='<p class="muted">No sourced prospects waiting.</p>';
      if(showToast)toast('Prospect inbox is up to date');
      return;
    }
    host.innerHTML=`<div class="stack">${candidates.map(x=>`
      <div class="action-item sourced-prospect-card">
        <div style="min-width:0;flex:1">
          <div class="title">${esc(x.businessName||'Unnamed business')}</div>
          <div class="meta">${esc(x.category||'Local business')}${x.address?' · '+esc(x.address):''}</div>
          ${x.website?`<div class="meta" style="overflow-wrap:anywhere">${esc(x.website)}</div>`:''}
          ${x.phone?`<div class="meta">${esc(x.phone)}</div>`:''}
          ${x.email?`<div class="meta">${esc(x.email)}</div>`:''}
          <div style="margin-top:8px;font-size:12px;line-height:1.5"><strong>Why it was sourced:</strong> ${esc(x.discoveryReason||'Local prospect worth researching.')}</div>
          ${x.sourceLabel?`<div class="meta" style="margin-top:5px">Source: ${esc(x.sourceLabel)} · verified ${esc(x.verifiedAt||'')}</div>`:''}
        </div>
        <div class="row-actions" style="align-self:flex-start;flex-wrap:wrap">
          <button class="btn small" data-sales-action="accept-sourced" data-id="${esc(x.id)}">Add to Research</button>
          <button class="btn small secondary" data-sales-action="reject-sourced" data-id="${esc(x.id)}">Reject</button>
        </div>
      </div>`).join('')}</div>`;
    wireSalesActions();
    if(showToast)toast('Prospect inbox refreshed');
  }
  async function updateSourcedInbox(){
    if(!sourcedInboxCache||typeof putFile!=='function')return;
    const r=await putFile('sales-assistant/prospect-inbox.json',JSON.stringify(sourcedInboxCache,null,2),'Update sourced prospect inbox',sourcedInboxSha||'');
    sourcedInboxSha=r?.content?.sha||sourcedInboxSha;
  }
  async function acceptSourcedProspect(id){
    const x=(sourcedInboxCache?.candidates||[]).find(y=>y.id===id);if(!x)return;
    const duplicate=sales().leads.some(l=>(l.businessName||'').toLowerCase()===(x.businessName||'').toLowerCase());
    if(duplicate){x.status='duplicate';x.reviewedAt=new Date().toISOString();await updateSourcedInbox();await loadProspectInbox();return toast('Already in pipeline');}
    const lead={
      id:uid('lead'),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
      businessName:x.businessName||'',contactName:x.contactName||'',email:x.email||'',phone:x.phone||'',
      website:x.website||'',address:x.address||'',service:x.suggestedService||'',problem:'',
      estimatedValue:'',stage:'Research',nextActionMethod:'research',nextActionDate:TODAY(),
      nextActionReason:x.discoveryReason||'Research this prospect and confirm a genuine opportunity.',
      notes:x.notes||'',category:x.category||'',sourceCandidateId:x.id||'',source:{type:'chatgpt-sourced',sourceLabel:x.sourceLabel||'',sourceUrl:x.sourceUrl||'',verifiedAt:x.verifiedAt||''},
      researchStatus:'queued'
    };
    sales().leads.push(lead);
    x.status='accepted';x.reviewedAt=new Date().toISOString();
    await saveState();await updateSourcedInbox();
    const inboxHost=document.getElementById('salesProspectInbox');
    if(inboxHost){
      const card=[...inboxHost.querySelectorAll('[data-sales-action="accept-sourced"]')].find(b=>b.dataset.id===id)?.closest('.sourced-prospect-card');
      if(card)card.remove();
      if(!inboxHost.querySelector('.sourced-prospect-card'))inboxHost.innerHTML='<p class="muted">No sourced prospects waiting.</p>';
    }
    try{
      const path='sales-assistant/research-queue.json';
      const qf=await getFile(path);
      const q=qf?JSON.parse(qf.text):{version:1,requests:[]};
      q.requests=Array.isArray(q.requests)?q.requests:[];
      q.requests.push({
        id:lead.id,
        businessName:lead.businessName,
        website:lead.website,
        address:lead.address,
        phone:lead.phone,
        email:lead.email,
        suggestedService:lead.service,
        discoveryReason:lead.nextActionReason,
        source:lead.source,
        status:'queued',
        queuedAt:new Date().toISOString()
      });
      await putFile(path,JSON.stringify(q,null,2),'Queue prospect research',qf?.sha||'');
    }catch(e){console.warn('Could not queue research request',e);}
    render();toast('Moved to Research and removed from Sourced Prospects');
  }
  async function rejectSourcedProspect(id){
    const x=(sourcedInboxCache?.candidates||[]).find(y=>y.id===id);if(!x)return;
    x.status='rejected';x.reviewedAt=new Date().toISOString();
    await updateSourcedInbox();await loadProspectInbox();toast('Prospect rejected');
  }

  function openContactSchedule(id){
    const l=leadById(id);if(!l)return;
    const suggested=['call','visit'].includes(l.nextActionMethod)?l.nextActionMethod:(l.phone?'call':'visit');
    openModal(`<h2>Schedule contact</h2><p class="sub">Put this sales action into your Work calendar so you can plan exactly when you will do it.</p>
    <form id="salesScheduleForm"><div class="form-grid">
      <div class="field"><label>Action</label><select name="method"><option value="call" ${suggested==='call'?'selected':''}>CALL</option><option value="visit" ${suggested==='visit'?'selected':''}>VISIT</option></select></div>
      <div class="field"><label>Date</label><input type="date" name="date" required value="${l.nextActionDate||TODAY()}"></div>
      <div class="field"><label>Start time</label><input type="time" name="time" required value="${l.nextActionTime||'10:00'}"></div>
      <div class="field"><label>Planned duration</label><select name="duration">
        ${[15,30,45,60,90,120].map(n=>`<option value="${n}" ${Number(l.nextActionDuration||30)===n?'selected':''}>${n<60?n+' minutes':n===60?'1 hour':n===90?'1½ hours':'2 hours'}</option>`).join('')}
      </select></div>
      <div class="field full"><label>Reason / plan</label><input name="reason" value="${esc(l.nextActionReason||'')}" placeholder="What are you planning to discuss or do?"></div>
      ${suggested==='visit'&&l.address?`<div class="field full"><div class="hint-box"><strong>Visit:</strong> <a class="sales-map-link" href="${mapsUrlFor(l)}" target="_blank" rel="noopener">${esc(l.address)} <span aria-hidden="true">↗</span></a></div></div>`:''}
      ${suggested==='call'&&l.phone?`<div class="field full"><div class="hint-box"><strong>Call:</strong> ${esc(l.phone)}</div></div>`:''}
    </div><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Add to calendar</button></div></form>`,true);
    $('#salesScheduleForm').onsubmit=async e=>{
      e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());
      l.nextActionMethod=v.method;l.nextActionDate=v.date;l.nextActionTime=v.time;l.nextActionDuration=Number(v.duration||30);
      if(v.reason)l.nextActionReason=v.reason;
      if(l.stage==='Research')l.stage='Contact';
      l.updatedAt=new Date().toISOString();
      await saveState();closeModal();render();toast((v.method==='visit'?'Visit':'Call')+' added to calendar');
    };
  }

  function openLeadForm(id){
    const l=id?leadById(id):{};
    openModal(`<h2>${l.id?'Edit prospect':'Add prospect'}</h2><p class="sub">Record enough information for HQ to tell you exactly who to contact, how, why and when.</p>
    <form id="salesLeadForm"><div class="form-grid">
      <div class="field"><label>Business / prospect</label><input name="businessName" value="${esc(l.businessName||'')}" required></div>
      <div class="field"><label>Contact name</label><input name="contactName" value="${esc(l.contactName||'')}"></div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${esc(l.email||'')}"></div>
      <div class="field"><label>Phone</label><input name="phone" value="${esc(l.phone||'')}"></div>
      <div class="field"><label>Website</label><input name="website" value="${esc(l.website||'')}" placeholder="https://…"></div>
      <div class="field"><label>Estimated value (£)</label><input name="estimatedValue" type="number" min="0" step="0.01" value="${esc(l.estimatedValue||'')}"></div>
      <div class="field full"><label>Address / location</label><input name="address" value="${esc(l.address||'')}"></div>
      <div class="field"><label>Services they might need</label><input name="service" value="${esc(l.service||'')}" placeholder="Website Design, Pub Quiz, Hospitality…"></div>
      <div class="field"><label>Pipeline stage</label><select name="stage">${stageOrder.map(x=>`<option ${(l.stage||'Found')===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field full"><label>Problem / opportunity noticed</label><textarea name="problem" placeholder="What have you actually noticed that Chip In could solve?">${esc(l.problem||'')}</textarea></div>
      <div class="field full"><label>Last contact summary</label><textarea name="lastContactSummary" placeholder="Only factual notes. What actually happened last time?">${esc(l.lastContactSummary||'')}</textarea></div>
      <div class="field"><label>Next action</label><select name="nextActionMethod">${['research','email','call','visit'].map(x=>`<option value="${x}" ${(l.nextActionMethod||'research')===x?'selected':''}>${methodLabels[x]}</option>`).join('')}</select></div>
      <div class="field"><label>Next action date</label><input type="date" name="nextActionDate" value="${l.nextActionDate||TODAY()}"></div>
      <div class="field"><label>Next action time (optional)</label><input type="time" name="nextActionTime" value="${esc(l.nextActionTime||'')}"></div>
      <div class="field"><label>Planned duration (minutes)</label><input type="number" min="5" step="5" name="nextActionDuration" value="${esc(l.nextActionDuration||'')}"></div>
      <div class="field full"><label>Why are you contacting them?</label><input name="nextActionReason" value="${esc(l.nextActionReason||'')}"></div>
      <div class="field full"><label>AI-approved wording (optional)</label><textarea name="aiReply" placeholder="Paste wording supplied by ChatGPT here if you want this exact wording shown on the action card.">${esc(l.aiReply||'')}</textarea></div>
      <div class="field full"><label>General notes</label><textarea name="notes">${esc(l.notes||'')}</textarea></div>
    </div><div class="form-actions">${l.id?'<button class="btn danger" type="button" id="deleteSalesLead">Delete</button>':''}<button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Save prospect</button></div></form>`,true);
    $('#salesLeadForm').onsubmit=async e=>{
      e.preventDefault();
      const v=Object.fromEntries(new FormData(e.target).entries());
      v.estimatedValue=v.estimatedValue===''?'':Number(v.estimatedValue);
      v.nextActionDuration=v.nextActionDuration===''?'':Number(v.nextActionDuration);
      const target=l.id?l:{id:uid('lead'),createdAt:new Date().toISOString()};
      Object.assign(target,v,{updatedAt:new Date().toISOString()});
      if(!l.id)sales().leads.push(target);
      await saveState(); closeModal(); render(); toast('Prospect saved');
    };
    $('#deleteSalesLead')?.addEventListener('click',()=>confirmAction('Delete this prospect and its sales history?',async()=>{
      sales().leads=sales().leads.filter(x=>x.id!==l.id);
      sales().activity=sales().activity.filter(x=>x.leadId!==l.id);
      await saveState();
    }));
  }

  async function completeSalesAction(id){
    const l=leadById(id); if(!l)return;
    openModal(`<h2>${l.nextActionMethod==='research'?'Research result':'What happened?'}</h2><p class="sub">${l.nextActionMethod==='research'?'Record the verified research so this lead can move into Contact with the right method and wording.':'This keeps the assistant accurate and decides when the prospect should come back to you.'}</p>
    <form id="salesDoneForm"><div class="form-grid">
      <div class="field"><label>Outcome</label><select name="outcome">
        ${l.nextActionMethod==='research'?'<option value="researched">Research completed</option>':''}
        <option value="conversation">Spoke / exchanged messages</option>
        <option value="no_reply">No reply</option>
        <option value="quote">Quote sent</option>
        <option value="won">Won client</option>
        <option value="lost">Not interested / lost</option>
      </select></div>
      <div class="field"><label>Next follow-up</label><input type="date" name="nextDate" value="${addDays(TODAY(),sales().settings.defaultFollowUpDays)}"></div>
      <div class="field full"><label>${l.nextActionMethod==='research'?'Verified research':'What happened?'}</label><textarea name="summary" required placeholder="${l.nextActionMethod==='research'?'Record verified facts only: current website/presence, useful contact, opportunity and best next approach.':'Record the facts so the next instruction is based on what really happened.'}"></textarea></div>
    </div><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Save outcome</button></div></form>`);
    $('#salesDoneForm').onsubmit=async e=>{
      e.preventDefault(); const v=Object.fromEntries(new FormData(e.target).entries());
      sales().activity.push({id:uid('saleact'),leadId:l.id,date:TODAY(),type:v.outcome,summary:v.summary,method:l.nextActionMethod,createdAt:new Date().toISOString()});
      l.lastContactDate=TODAY(); l.lastContactSummary=v.summary; l.aiReply='';
      l.nextActionTime='';l.nextActionDuration='';
      if(v.outcome==='won'){l.stage='Won';l.nextActionDate='';}
      else if(v.outcome==='lost'){l.stage='Lost';l.nextActionDate='';}
      else {
        if(v.outcome==='researched'){l.stage='Contact';l.researchSummary=v.summary;l.nextActionMethod=l.email?'email':l.phone?'call':l.address?'visit':'research';}
        else if(v.outcome==='quote'){l.stage='Quote';}
        else if(v.outcome==='conversation')l.stage='Follow-up';
        else if(v.outcome==='no_reply')l.stage='Follow-up';
        l.nextActionDate=v.nextDate||addDays(TODAY(),sales().settings.defaultFollowUpDays);
        l.nextActionReason=v.outcome==='researched'?'Research complete; make first contact.':v.outcome==='quote'?'Follow up the quote.':v.outcome==='no_reply'?'No reply last time; try again.':'Continue the conversation.';
      }
      await saveState(); closeModal(); render(); toast('Sales action recorded');
    };
  }

  function openTargets(){
    const t=sales().targets;
    openModal(`<h2>Monthly sales targets</h2><form id="salesTargetsForm"><div class="form-grid">
      <div class="field"><label>New clients</label><input type="number" min="1" name="monthlyClients" value="${t.monthlyClients}"></div>
      <div class="field"><label>Total prospects</label><input type="number" min="1" name="prospects" value="${t.prospects}"></div>
      <div class="field"><label>Conversations</label><input type="number" min="1" name="conversations" value="${t.conversations}"></div>
      <div class="field"><label>Quotes</label><input type="number" min="1" name="quotes" value="${t.quotes}"></div>
      <div class="field"><label>Default follow-up days</label><input type="number" min="1" name="defaultFollowUpDays" value="${sales().settings.defaultFollowUpDays}"></div>
    </div><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Save targets</button></div></form>`);
    $('#salesTargetsForm').onsubmit=async e=>{
      e.preventDefault(); const v=Object.fromEntries(new FormData(e.target).entries());
      ['monthlyClients','prospects','conversations','quotes'].forEach(k=>sales().targets[k]=Number(v[k]));
      sales().settings.defaultFollowUpDays=Number(v.defaultFollowUpDays)||5;
      await saveState();closeModal();render();
    };
  }

  function assistantPayload(){
    return {
      generatedAt:new Date().toISOString(),
      instruction:'Using only these verified Chip In HQ records, return a numbered action list. For each item use ACTION, CLIENT, CONTACT, WHY, YOU SHOULD SAY. Never invent facts. Keep wording friendly, local and concise.',
      targets:sales().targets,
      stats:prospectStats(),
      actions:dueActions().map(l=>({
        id:l.id,
        action:l.nextActionMethod,
        business:l.businessName,
        contactName:l.contactName||'',
        contact:contactFor(l),
        service:l.service||'',
        website:l.website||'',
        estimatedValue:l.estimatedValue||'',
        problem:l.problem||'',
        lastContactDate:l.lastContactDate||'',
        lastContactSummary:l.lastContactSummary||'',
        reason:reasonFor(l),
        dueDate:l.nextActionDate,
        dueTime:l.nextActionTime||''
      }))
    };
  }
  async function copyChatGPTPack(){
    const p=assistantPayload();
    const text='CHIP IN SALES ASSISTANT — VERIFIED HQ DATA\n\n'+JSON.stringify(p,null,2);
    await navigator.clipboard.writeText(text);
    toast('ChatGPT briefing copied');
  }

  let salesLiveRefreshBusy=false;
  async function liveRefreshSales(){
    if(salesLiveRefreshBusy||document.hidden||typeof page==='undefined'||page!=='sales')return;
    salesLiveRefreshBusy=true;
    try{
      const changed=await reconcileAutomaticResearch();
      if(changed){render();return;}
      await loadProspectInbox(false);
    }catch(e){
      console.warn('Sales Assistant live refresh failed',e);
    }finally{
      salesLiveRefreshBusy=false;
    }
  }

  setInterval(liveRefreshSales,60000);
  window.addEventListener('focus',liveRefreshSales);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)liveRefreshSales();});

  const salesMapStyle=document.createElement('style');
  salesMapStyle.textContent='.sales-map-link{color:#2f69d8;text-decoration:underline;text-underline-offset:2px;font-weight:600;overflow-wrap:anywhere}.sales-map-link:active{opacity:.72}';
  document.head.appendChild(salesMapStyle);

  window.ChipInSalesAssistant = {
    getToday:()=>assistantPayload(),
    getLead:id=>{const l=leadById(id);return l?structuredClone(l):null},
    getPipeline:()=>structuredClone(sales().leads),
    openLead:id=>openLeadForm(id),
    schedule:id=>openContactSchedule(id),
    saveAIReply:async(id,text)=>{const l=leadById(id);if(!l)throw Error('Lead not found');l.aiReply=String(text||'');await saveState();return true;}
  };
})();
