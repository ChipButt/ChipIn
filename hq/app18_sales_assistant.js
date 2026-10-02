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
  const stageOrder=['Found','Contact','Follow-up','Interested','Quote','Won','Lost'];
  const methodLabels={email:'EMAIL',call:'CALL',visit:'VISIT'};
  const methodIcon={email:'✉',call:'☎',visit:'⌖'};
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
    if(l.nextActionMethod==='email')return l.email||'Email not recorded';
    if(l.nextActionMethod==='call')return l.phone||'Phone not recorded';
    return l.address||'Address not recorded';
  }
  function reasonFor(l){
    if(l.nextActionReason)return l.nextActionReason;
    if(l.stage==='Found')return 'New prospect ready for first contact.';
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
    const script=l.aiReply||deterministicScript(l);
    return `<article class="sales-action-card ${overdue?'overdue':''}">
      <div class="sales-action-head"><span class="sales-method">${methodIcon[l.nextActionMethod]||'•'} ${methodLabels[l.nextActionMethod]||'CONTACT'}</span><span class="badge ${overdue?'bad':'warn'}">${overdue?'Overdue':fmtDate(l.nextActionDate)}</span></div>
      <h3>Chip, you need to ${methodLabels[l.nextActionMethod]||'CONTACT'} <strong>${esc(l.businessName)}</strong></h3>
      <div class="sales-contact">${esc(contactFor(l))}</div>
      <p><strong>Why:</strong> ${esc(reasonFor(l))}</p>
      <div class="sales-script"><div class="sales-script-label">You should say</div><p>“${esc(script)}”</p></div>
      ${l.aiReply?'<div class="sales-ai-flag">AI wording saved for this action</div>':''}
      <div class="row-actions sales-card-actions">
        <button class="btn small secondary" data-sales-action="copy-script" data-id="${l.id}">Copy wording</button>
        <button class="btn small secondary" data-sales-action="edit-lead" data-id="${l.id}">Edit</button>
        <button class="btn small" data-sales-action="done" data-id="${l.id}">Mark done</button>
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
      <div class="sales-action-list">${due.length?due.map(actionCard).join(''):`<div class="card"><div class="empty-state"><div class="empty-icon">✓</div><h3>You’re clear for now</h3><p>Add prospects or set follow-up dates and they will appear here automatically.</p></div></div>`}</div>

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
  };

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
    if(action==='targets')return openTargets();
    if(action==='chatgpt-pack')return copyChatGPTPack();
  }

  function openLeadForm(id){
    const l=id?leadById(id):{};
    openModal(`<h2>${l.id?'Edit prospect':'Add prospect'}</h2><p class="sub">Record enough information for HQ to tell you exactly who to contact, how, why and when.</p>
    <form id="salesLeadForm"><div class="form-grid">
      <div class="field"><label>Business / prospect</label><input name="businessName" value="${esc(l.businessName||'')}" required></div>
      <div class="field"><label>Contact name</label><input name="contactName" value="${esc(l.contactName||'')}"></div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${esc(l.email||'')}"></div>
      <div class="field"><label>Phone</label><input name="phone" value="${esc(l.phone||'')}"></div>
      <div class="field full"><label>Address</label><input name="address" value="${esc(l.address||'')}"></div>
      <div class="field"><label>Service to pitch</label><input name="service" value="${esc(l.service||'')}" placeholder="Website Design, Pub Quiz, Hospitality…"></div>
      <div class="field"><label>Pipeline stage</label><select name="stage">${stageOrder.map(x=>`<option ${(l.stage||'Found')===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field full"><label>Problem / opportunity noticed</label><textarea name="problem" placeholder="What have you actually noticed that Chip In could solve?">${esc(l.problem||'')}</textarea></div>
      <div class="field full"><label>Last contact summary</label><textarea name="lastContactSummary" placeholder="Only factual notes. What actually happened last time?">${esc(l.lastContactSummary||'')}</textarea></div>
      <div class="field"><label>Next action</label><select name="nextActionMethod">${['email','call','visit'].map(x=>`<option value="${x}" ${(l.nextActionMethod||'email')===x?'selected':''}>${methodLabels[x]}</option>`).join('')}</select></div>
      <div class="field"><label>Next action date</label><input type="date" name="nextActionDate" value="${l.nextActionDate||TODAY()}"></div>
      <div class="field full"><label>Why are you contacting them?</label><input name="nextActionReason" value="${esc(l.nextActionReason||'')}"></div>
      <div class="field full"><label>AI-approved wording (optional)</label><textarea name="aiReply" placeholder="Paste wording supplied by ChatGPT here if you want this exact wording shown on the action card.">${esc(l.aiReply||'')}</textarea></div>
      <div class="field full"><label>General notes</label><textarea name="notes">${esc(l.notes||'')}</textarea></div>
    </div><div class="form-actions">${l.id?'<button class="btn danger" type="button" id="deleteSalesLead">Delete</button>':''}<button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Save prospect</button></div></form>`,true);
    $('#salesLeadForm').onsubmit=async e=>{
      e.preventDefault();
      const v=Object.fromEntries(new FormData(e.target).entries());
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
    openModal(`<h2>What happened?</h2><p class="sub">This keeps the assistant accurate and decides when the prospect should come back to you.</p>
    <form id="salesDoneForm"><div class="form-grid">
      <div class="field"><label>Outcome</label><select name="outcome">
        <option value="conversation">Spoke / exchanged messages</option>
        <option value="no_reply">No reply</option>
        <option value="quote">Quote sent</option>
        <option value="won">Won client</option>
        <option value="lost">Not interested / lost</option>
      </select></div>
      <div class="field"><label>Next follow-up</label><input type="date" name="nextDate" value="${addDays(TODAY(),sales().settings.defaultFollowUpDays)}"></div>
      <div class="field full"><label>What happened?</label><textarea name="summary" required placeholder="Record the facts so the next instruction is based on what really happened."></textarea></div>
    </div><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">Save outcome</button></div></form>`);
    $('#salesDoneForm').onsubmit=async e=>{
      e.preventDefault(); const v=Object.fromEntries(new FormData(e.target).entries());
      sales().activity.push({id:uid('saleact'),leadId:l.id,date:TODAY(),type:v.outcome,summary:v.summary,method:l.nextActionMethod,createdAt:new Date().toISOString()});
      l.lastContactDate=TODAY(); l.lastContactSummary=v.summary; l.aiReply='';
      if(v.outcome==='won'){l.stage='Won';l.nextActionDate='';}
      else if(v.outcome==='lost'){l.stage='Lost';l.nextActionDate='';}
      else {
        if(v.outcome==='quote'){l.stage='Quote';}
        else if(v.outcome==='conversation')l.stage='Follow-up';
        else if(v.outcome==='no_reply')l.stage='Follow-up';
        l.nextActionDate=v.nextDate||addDays(TODAY(),sales().settings.defaultFollowUpDays);
        l.nextActionReason=v.outcome==='quote'?'Follow up the quote.':v.outcome==='no_reply'?'No reply last time; try again.':'Continue the conversation.';
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
