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
      <div class="sales-action-head"><span class="sales-method">${methodIcon[l.nextActionMethod]||'•'} ${methodLabels[l.nextActionMethod]||'CONTACT'}</span><span class="badge ${overdue?'bad':'warn'}">${overdue?'Overdue':fmtDate(l.nextActionDate)}</span></div>
      <h3>Chip, you need to ${isResearch?'RESEARCH':' '+(methodLabels[l.nextActionMethod]||'CONTACT')} <strong>${esc(l.businessName)}</strong></h3>
      <div class="sales-contact">${esc(contactFor(l))}</div>
      <p><strong>Why:</strong> ${esc(reasonFor(l))}</p>
      ${isResearch
        ? `<div class="sales-script"><div class="sales-script-label">Research required</div><p>${esc(script)}</p></div>`
        : `<div class="sales-script"><div class="sales-script-label">You should say</div><p>“${esc(script)}”</p></div>`
      }
      ${l.aiReply?'<div class="sales-ai-flag">AI research/wording saved for this action</div>':''}
      <div class="row-actions sales-card-actions">
        ${isResearch
          ? (l.researchStatus==='queued'
              ? `<span class="badge warn">Queued for automatic research</span><button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Edit</button>`
              : `<button class="btn small secondary" data-sales-action="copy-research" data-id="${l.id}">Copy research brief</button>
                 <button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Edit</button>
                 <button class="btn small" data-sales-action="done" data-id="${l.id}">Mark researched</button>`)
          : `<button class="btn small secondary" data-sales-action="copy-script" data-id="${l.id}">Copy wording</button>
             <button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Edit</button>
             <button class="btn small" data-sales-action="done" data-id="${l.id}">Mark done</button>`
        }
      </div>
    </article>`;
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

      <div class="section-title"><div><h2>Sourced prospects</h2><p>Prospects researched by ChatGPT appear here before they enter your live pipeline.</p></div><button class="btn secondary small" data-sales-action="refresh-inbox">Refresh</button></div>
      <div id="salesProspectInbox" class="card"><p class="muted">Loading sourced prospects…</p></div>

      <div class="section-title"><div><h2>Pipeline</h2><p>Move every prospect forward or deliberately close it.</p></div><button class="btn secondary small" data-sales-action="targets">Targets</button></div>
      <div class="sales-pipeline">${stageOrder.map(stage=>pipelineColumn(stage)).join('')}</div>

      <div class="section-title"><div><h2>Coming up</h2></div></div>
      <div class="card">${upcoming.length?`<div class="action-list">${upcoming.map(l=>`<div class="action-item"><div><div class="title">${methodLabels[l.nextActionMethod]||'CONTACT'} · ${esc(l.businessName)}</div><div class="meta">${fmtDate(l.nextActionDate)} · ${esc(contactFor(l))}</div></div><button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Open</button></div>`).join('')}</div>`:'<p class="muted">No future follow-ups scheduled.</p>'}</div>

      <div class="section-title"><div><h2>ChatGPT connection</h2><p>Firebase is the verified sales-data source ChatGPT will read.</p></div></div>
      <div class="card sales-api-card">
        <div><strong>Current mode:</strong> Firebase Spark sales feed</div>
        <p class="muted">HQ publishes only Sales Assistant data to Firestore. ChatGPT will be connected read-only to that Firestore feed; the rest of Chip In HQ remains separate.</p>
        <div class="hint-box"><strong>End result:</strong> ask “What do I need to do today?” and ChatGPT reads the verified Firestore feed, then returns EMAIL / CALL / VISIT, the exact contact detail, the factual reason and suggested wording.</div>
      </div>`;
    wireSalesActions();
    loadProspectInbox().catch(e=>{const el=document.getElementById('salesProspectInbox');if(el)el.innerHTML=`<p class="muted">${esc(e.message)}</p>`;});
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
    if(action==='accept-sourced')return acceptSourcedProspect(id);
    if(action==='reject-sourced')return rejectSourcedProspect(id);
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
    const candidates=(sourcedInboxCache.candidates||[]).filter(x=>(x.status||'new')==='new');
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
      notes:x.notes||'',source:{type:'chatgpt-sourced',sourceLabel:x.sourceLabel||'',sourceUrl:x.sourceUrl||'',verifiedAt:x.verifiedAt||''},
      researchStatus:'queued'
    };
    sales().leads.push(lead);
    x.status='accepted';x.reviewedAt=new Date().toISOString();
    await saveState();await updateSourcedInbox();
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
    render();toast('Prospect queued for automatic research');
  }
  async function rejectSourcedProspect(id){
    const x=(sourcedInboxCache?.candidates||[]).find(y=>y.id===id);if(!x)return;
    x.status='rejected';x.reviewedAt=new Date().toISOString();
    await updateSourcedInbox();await loadProspectInbox();toast('Prospect rejected');
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
      <div class="field full"><label>Why are you contacting them?</label><input name="nextActionReason" value="${esc(l.nextActionReason||'')}"></div>
      <div class="field full"><label>AI-approved wording (optional)</label><textarea name="aiReply" placeholder="Paste wording supplied by ChatGPT here if you want this exact wording shown on the action card.">${esc(l.aiReply||'')}</textarea></div>
      <div class="field full"><label>General notes</label><textarea name="notes">${esc(l.notes||'')}</textarea></div>
    </div><div class="form-actions">${l.id?'<button class="btn danger" type="button" id="deleteSalesLead">Delete</button>':''}<button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Save prospect</button></div></form>`,true);
    $('#salesLeadForm').onsubmit=async e=>{
      e.preventDefault();
      const v=Object.fromEntries(new FormData(e.target).entries());
      v.estimatedValue=v.estimatedValue===''?'':Number(v.estimatedValue);
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
        dueDate:l.nextActionDate
      }))
    };
  }
  async function copyChatGPTPack(){
    const p=assistantPayload();
    const text='CHIP IN SALES ASSISTANT — VERIFIED HQ DATA\n\n'+JSON.stringify(p,null,2);
    await navigator.clipboard.writeText(text);
    toast('ChatGPT briefing copied');
  }

  window.ChipInSalesAssistant = {
    getToday:()=>assistantPayload(),
    getLead:id=>{const l=leadById(id);return l?structuredClone(l):null},
    getPipeline:()=>structuredClone(sales().leads),
    saveAIReply:async(id,text)=>{const l=leadById(id);if(!l)throw Error('Lead not found');l.aiReply=String(text||'');await saveState();return true;}
  };
})();
