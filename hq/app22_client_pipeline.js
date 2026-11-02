// Chip In HQ — one client directory, from first contact to archived "No".
// Sales Assistant lead records remain intact for research, reminders and history.
(function () {
  'use strict';

  const STAGES = [
    ['Research', 'Research'],
    ['Found', 'To Contact'],
    ['Contact', 'Contacted'],
    ['Follow-up', 'Following up'],
    ['Interested', 'Interested'],
    ['Quote', 'Quote sent'],
    ['Won', 'Won / working'],
    ['Client', 'Existing client'],
    ['Lost', 'No — archived']
  ];
  let archiveView = false;
  let clientSearch = '';
  let stageFilter = '';

  const clean = value => String(value == null ? '' : value).trim();
  const normal = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const leads = () => Array.isArray(state.salesAssistant?.leads) ? state.salesAssistant.leads : [];
  const dateTime = () => new Date().toISOString();
  const leadFor = client => client && client.id ? leads().find(l => l.id === client.sourceLeadId || l.clientRecordId === client.id || l.convertedClientId === client.id) : null;
  const stageOf = client => leadFor(client)?.stage || client.pipelineStage || (client.archivedAt ? 'Lost' : 'Client');
  const isArchived = client => stageOf(client) === 'Lost';
  const label = stage => STAGES.find(s => s[0] === stage)?.[1] || stage;
  const options = (selected, includeClient = true) => STAGES.filter(s => includeClient || s[0] !== 'Client').map(s =>
    '<option value="' + esc(s[0]) + '"' + (s[0] === selected ? ' selected' : '') + '>' + esc(s[1]) + '</option>').join('');

  // Link only unambiguous records. Never merge two distinct leads just because
  // they happen to have similar names or share a generic email address.
  function matchingClient(lead) {
    const exact = state.clients.find(c => c.id === lead.clientRecordId || c.id === lead.convertedClientId);
    if (exact) return exact;
    const linked = state.clients.find(c => c.sourceLeadId === lead.id);
    if (linked) return linked;
    const business = normal(lead.businessName);
    if (!business) return null;
    const matches = state.clients.filter(c => normal(c.name) === business
      && (!c.sourceLeadId || c.sourceLeadId === lead.id)
      && (!c.email || !lead.email || clean(c.email).toLowerCase() === clean(lead.email).toLowerCase()));
    return matches.length === 1 ? matches[0] : null;
  }

  function synchroniseClients() {
    state.clients = Array.isArray(state.clients) ? state.clients : [];
    let changed = false;
    for (const lead of leads()) {
      if (!clean(lead.businessName)) continue;
      let client = matchingClient(lead);
      if (!client) {
        client = {
          id: uid('cli'), name: clean(lead.businessName), contact: clean(lead.contactName),
          email: clean(lead.email), phone: clean(lead.phone), website: clean(lead.website),
          address: clean(lead.address), notes: clean(lead.notes),
          businessType: clean(lead.businessType || lead.category),
          businessOverview: clean(lead.businessOverview),
          businessKeyDetails: clean(lead.businessKeyDetails || lead.researchSummary),
          createdAt: lead.createdAt || dateTime(), updatedAt: lead.updatedAt || dateTime(),
          sourceLeadId: lead.id, pipelineStage: lead.stage || 'Found',
          lastLeadSyncedAt: lead.updatedAt || lead.createdAt || ''
        };
        state.clients.push(client);
        changed = true;
      }
      if (client.sourceLeadId !== lead.id) { client.sourceLeadId = lead.id; changed = true; }
      // Fill only missing profile fields from verified lead research. Never
      // replace business information already edited in Clients.
      const profileSources = {
        businessType: lead.businessType || lead.category,
        businessOverview: lead.businessOverview,
        businessKeyDetails: lead.businessKeyDetails || lead.researchSummary
      };
      for (const [key, raw] of Object.entries(profileSources)) {
        if (!client.businessProfileEditedAt && !clean(client[key]) && clean(raw)) { client[key] = clean(raw); changed = true; }
      }
      if (lead.clientRecordId !== client.id) { lead.clientRecordId = client.id; changed = true; }

      const stamp = lead.updatedAt || lead.createdAt || '';
      if (stamp && stamp !== client.lastLeadSyncedAt && (!client.lastLeadSyncedAt || stamp > client.lastLeadSyncedAt)) {
        const leadIsNewer = !client.updatedAt || stamp > client.updatedAt;
        const map = {businessName:'name', contactName:'contact', email:'email',
          phone:'phone', website:'website', address:'address', notes:'notes'};
        for (const [from, to] of Object.entries(map)) {
          // A blank research result must never erase verified client details.
          const value = clean(lead[from]);
          if (value && (leadIsNewer || !clean(client[to])) && value !== client[to]) { client[to] = value; changed = true; }
        }
        client.lastLeadSyncedAt = stamp;
        changed = true;
      }
      const stage = lead.stage || 'Found';
      if (client.pipelineStage !== stage) { client.pipelineStage = stage; changed = true; }
      if (stage === 'Lost' && !client.archivedAt) { client.archivedAt = lead.updatedAt || dateTime(); changed = true; }
      if (stage !== 'Lost' && client.archivedAt) { client.archivedAt = ''; changed = true; }
    }
    for (const client of state.clients) {
      if (!client.pipelineStage) {
        client.pipelineStage = client.archivedAt ? 'Lost' : 'Client';
        changed = true;
      }
    }
    return changed;
  }

  // This includes existing records AND any new prospect imported by the
  // research worker, without triggering a "won job" conversion.
  const previousSaveState = saveState;
  saveState = async function () {
    synchroniseClients();
    return previousSaveState();
  };
  const previousLoadState = loadState;
  loadState = async function () {
    await previousLoadState();
    if (synchroniseClients()) await saveState();
  };

  function ensureAfterRemoteLoad() {
    // Private storage can replace state after initial page load. Reconcile
    // lazily whenever a client or sales page is opened as well.
    if (synchroniseClients()) {
      saveState().catch(error => console.warn('Client directory sync not saved', error));
    }
  }

  function stagesSummary() {
    return state.clients.filter(c => !isArchived(c));
  }

  function renderClientCards() {
    const container = document.getElementById('clientDirectoryRows');
    if (!container) return;
    const query = clientSearch.toLowerCase();
    const rows = state.clients.filter(c => isArchived(c) === archiveView)
      .filter(c => !stageFilter || stageOf(c) === stageFilter)
      .filter(c => [c.name, c.contact, c.email, c.phone, c.address, c.website, c.notes, c.businessType, c.businessOverview, c.businessKeyDetails].some(v =>
        clean(v).toLowerCase().includes(query)))
      .sort((a,b) => clean(a.name).localeCompare(clean(b.name), 'en-GB'));
    const count = document.getElementById('clientMatchCount');
    if (count) count.textContent = rows.length + ' shown';
    container.innerHTML = rows.length ? rows.map(c => {
      const jobs = state.jobs.filter(j => j.clientId === c.id).length;
      const stage = stageOf(c);
      return '<article class="hq-client-item">' +
        '<div class="hq-client-heading"><div><h3>' + esc(c.name) + '</h3>' +
        '<p>' + esc(c.contact || 'Contact name not yet recorded') + '</p></div>' +
        '<span class="badge ' + (stage === 'Lost' ? 'bad' : stage === 'Won' ? 'ok' : 'blue') + '">' +
        esc(label(stage)) + '</span></div>' +
        '<div class="hq-client-details">' +
        '<div><span>Email</span>' + (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '<em>Not recorded</em>') + '</div>' +
        '<div><span>Phone</span>' + (c.phone ? '<a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a>' : '<em>Not recorded</em>') + '</div>' +
        '<div><span>Jobs</span><strong>' + jobs + '</strong></div></div>' +
        '<section class="hq-business-profile" aria-label="Business profile">' +
        '<div class="hq-business-profile-head"><strong>Business profile</strong>' +
        '<span>' + esc(c.businessType || 'Business type not recorded') + '</span></div>' +
        (c.businessOverview ? '<p class="hq-business-overview">' + esc(c.businessOverview) + '</p>' : '') +
        (c.businessKeyDetails ? '<div class="hq-business-facts"><strong>Key information</strong><p>' + esc(c.businessKeyDetails) + '</p></div>' : '') +
        (!c.businessOverview && !c.businessKeyDetails ? '<p class="hq-business-empty">Add a description and useful business facts using Edit details.</p>' : '') +
        '</section>' +
        (archiveView && (c.noReason || leadFor(c)?.closedReason) ?
          '<p class="hq-no-reason">' + esc(c.noReason || leadFor(c)?.closedReason) + '</p>' : '') +
        '<div class="hq-client-controls">' +
        (archiveView ?
          '<button type="button" class="btn small" data-client-restore="' + esc(c.id) + '">Restore</button>' :
          '<label>Stage<select aria-label="Stage for ' + esc(c.name) + '" data-client-stage="' + esc(c.id) + '">' +
          options(stage, !leadFor(c)) + '</select></label>') +
        (!archiveView && stage === 'Won' ? '<button class="btn small gold" type="button" data-client-job="' + esc(c.id) + '">' +
          (state.jobs.some(j => j.clientId === c.id && (j.sourceLeadId === leadFor(c)?.id || j.id === leadFor(c)?.convertedJobId)) ? '+ Another Job' : 'Convert to Job') + '</button>' : '') +
        '<button class="btn small secondary" type="button" data-client-edit="' + esc(c.id) + '">Edit details</button>' +
        (!archiveView ? '<button class="btn small secondary hq-no-button" type="button" data-client-no="' + esc(c.id) + '">No</button>' : '') +
        '</div></article>';
    }).join('') : empty(archiveView ? 'No archived contacts match your search.' : 'No active clients match your search.');
    container.querySelectorAll('[data-client-edit]').forEach(b => b.onclick = () => openClientForm(b.dataset.clientEdit));
    container.querySelectorAll('[data-client-job]').forEach(b => b.onclick = () => window.ChipInClientToJob?.start(b.dataset.clientJob));
    container.querySelectorAll('[data-client-no]').forEach(b => b.onclick = () => openNoForm(b.dataset.clientNo));
    container.querySelectorAll('[data-client-restore]').forEach(b => b.onclick = () => restoreClient(b.dataset.clientRestore));
    container.querySelectorAll('[data-client-stage]').forEach(sel => sel.onchange = () => {
      const client = clientById(sel.dataset.clientStage);
      if (!client) return;
      const next = sel.value;
      if (next === 'Lost') {
        sel.value = stageOf(client);
        openNoForm(client.id);
      } else updateStage(client, next);
    });
  }

  renderClients = function () {
    ensureAfterRemoteLoad();
    const active = stagesSummary().length;
    const archived = state.clients.length - active;
    const counts = new Map();
    for (const c of state.clients.filter(c => isArchived(c) === archiveView)) {
      const s = stageOf(c); counts.set(s, (counts.get(s) || 0) + 1);
    }
    document.getElementById('content').innerHTML =
      '<div class="hq-directory-intro"><div><h2>Client directory</h2><p>Every contact in one place — from the first approach to an agreed job.</p></div>' +
      '<div class="hq-client-tabs">' +
      '<button type="button" class="btn small ' + (archiveView ? 'secondary' : '') + '" id="hqActiveClients">Active (' + active + ')</button>' +
      '<button type="button" class="btn small ' + (!archiveView ? 'secondary' : '') + '" id="hqArchivedClients">Archived (' + archived + ')</button>' +
      '</div></div>' +
      '<div class="toolbar hq-directory-toolbar"><input id="clientSearch" class="search field-input" type="search" placeholder="Search name, business, phone or email" value="' + esc(clientSearch) + '">' +
      '<select id="clientStageFilter" aria-label="Filter clients by stage"><option value="">All stages</option>' +
      STAGES.filter(s => counts.has(s[0])).map(s => '<option value="' + esc(s[0]) + '"' +
        (stageFilter === s[0] ? ' selected' : '') + '>' + esc(s[1]) + ' (' + counts.get(s[0]) + ')</option>').join('') +
      '</select><span class="muted" id="clientMatchCount"></span></div>' +
      '<div id="clientDirectoryRows" class="hq-client-grid"></div>';
    document.getElementById('hqActiveClients').onclick = () => { archiveView = false; stageFilter = ''; renderClients(); };
    document.getElementById('hqArchivedClients').onclick = () => { archiveView = true; stageFilter = ''; renderClients(); };
    document.getElementById('clientSearch').oninput = event => { clientSearch = event.target.value; renderClientCards(); };
    document.getElementById('clientStageFilter').onchange = event => { stageFilter = event.target.value; renderClientCards(); };
    renderClientCards();
  };

  function applyStage(client, next) {
    const current = stageOf(client);
    if (current === next) return;
    if (current !== 'Lost') client.previousPipelineStage = current;
    client.pipelineStage = next;
    client.archivedAt = next === 'Lost' ? dateTime() : '';
    client.updatedAt = dateTime();
    const lead = leadFor(client);
    if (lead) {
      lead.stage = next;
      lead.updatedAt = client.updatedAt;
      if (next === 'Lost' || next === 'Won') {
        lead.nextActionDate = '';
        lead.nextActionTime = '';
      }
      client.lastLeadSyncedAt = lead.updatedAt;
    }
  }

  async function updateStage(client, next) {
    applyStage(client, next);
    await saveState();
    render();
    toast('Client stage updated');
  }

  function openNoForm(id) {
    const client = clientById(id);
    if (!client) return;
    openModal('<h2>Mark as No?</h2><p class="sub">' + esc(client.name) +
      ' will leave your active clients and Sales Assistant follow-ups. Their details and history will be kept in Archived.</p>' +
      '<form id="hqNoForm"><div class="field"><label>Reason / notes (optional)</label>' +
      '<textarea name="reason" placeholder="For example: Not proceeding, timing not right, or chose another supplier">' +
      esc(client.noReason || '') + '</textarea></div>' +
      '<div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button>' +
      '<button type="submit" class="btn danger">Mark No & archive</button></div></form>');
    document.getElementById('hqNoForm').onsubmit = async event => {
      event.preventDefault();
      const reason = clean(new FormData(event.target).get('reason'));
      applyStage(client, 'Lost');
      client.noReason = reason;
      const lead = leadFor(client);
      if (lead) {
        lead.closedReason = reason;
        if (!Array.isArray(state.salesAssistant.activity)) state.salesAssistant.activity = [];
        state.salesAssistant.activity.push({id:uid('saleact'),leadId:lead.id,date:TODAY(),
          type:'lost',summary:reason || 'Marked No and archived in Clients',createdAt:dateTime()});
      }
      await saveState();
      closeModal();
      render();
      toast('Moved to archive');
    };
  }

  async function restoreClient(id) {
    const client = clientById(id);
    if (!client) return;
    const prior = client.previousPipelineStage;
    applyStage(client, prior && prior !== 'Lost' ? prior : 'Found');
    await saveState();
    render();
    toast('Client restored to active list');
  }

  // The client form edits the same underlying lead, preserving Sales
  // Assistant actions, research data, Firebase sync and the original lead ID.
  openClientForm = function (id) {
    ensureAfterRemoteLoad();
    const existing = id ? clientById(id) : null;
    const c = existing || {};
    const initialStage = existing ? stageOf(existing) : 'Research';
    openModal('<h2>' + (existing ? 'Edit client' : 'Add client') + '</h2>' +
      '<p class="sub">Contact details and sales progress are saved together. A job is only added when you choose to create one.</p>' +
      '<form id="hqUnifiedClientForm"><div class="form-grid">' +
      '<div class="field"><label>Business / client name</label><input name="name" required value="' + esc(c.name || '') + '"></div>' +
      '<div class="field"><label>Contact name</label><input name="contact" value="' + esc(c.contact || '') + '"></div>' +
      '<div class="field"><label>Email</label><input type="email" name="email" value="' + esc(c.email || '') + '"></div>' +
      '<div class="field"><label>Phone</label><input name="phone" value="' + esc(c.phone || '') + '"></div>' +
      '<div class="field full"><label>Website</label><input name="website" value="' + esc(c.website || '') + '"></div>' +
      '<div class="field full"><label>Address</label><textarea name="address">' + esc(c.address || '') + '</textarea></div>' +
      '<div class="field"><label>Sales stage</label><select name="pipelineStage">' + options(initialStage, !leadFor(c)) + '</select></div>' +
      '<div class="field full"><label>Internal client notes</label><textarea name="notes">' + esc(c.notes || '') + '</textarea></div>' +
      '<div class="hq-form-section-heading full"><h3>Business profile</h3><p>Describe their business, not the services Chip In is offering them. Only enter information you have verified.</p></div>' +
      '<div class="field full"><label>Type of business</label><input name="businessType" placeholder="e.g. Village pub, florist, restaurant, local retailer" value="' + esc(c.businessType || '') + '"></div>' +
      '<div class="field full"><label>What the business does</label><textarea name="businessOverview" placeholder="A short description of the business, what it sells or the services it offers">' + esc(c.businessOverview || '') + '</textarea></div>' +
      '<div class="field full"><label>Key business information</label><textarea name="businessKeyDetails" placeholder="Important verified facts, such as opening hours, specialties, facilities or relevant background">' + esc(c.businessKeyDetails || '') + '</textarea></div>' +
      '</div><div class="form-actions"><button type="button" class="btn secondary" data-close-modal>Cancel</button>' +
      '<button type="submit" class="btn">Save client</button></div></form>', true);
    const form = document.getElementById('hqUnifiedClientForm');
    form.onsubmit = async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const next = values.pipelineStage;
      if (next === 'Lost' && initialStage !== 'Lost') {
        // Confirm archiving explicitly rather than silently hiding a record.
        if (existing) return openNoForm(existing.id);
        toast('Save the client first, then choose No to archive');
        return;
      }
      if (!clean(values.name)) return;
      const client = existing || {id:uid('cli'),createdAt:dateTime()};
      for (const field of ['name','contact','email','phone','website','address','notes','businessType','businessOverview','businessKeyDetails']) {
        client[field] = clean(values[field]);
      }
      if (!existing) {
        client.pipelineStage = next;
        state.clients.push(client);
        archiveView = false;
        stageFilter = '';
      }
      let lead = leadFor(client);
      if (!lead && !['Client','Lost'].includes(next)) {
        lead = {
          id:uid('lead'), createdAt:dateTime(), businessName:client.name,
          contactName:client.contact, email:client.email, phone:client.phone,
          website:client.website, address:client.address, notes:client.notes,
          category:client.businessType, businessType:client.businessType,
          businessOverview:client.businessOverview, businessKeyDetails:client.businessKeyDetails,
          stage:next, nextActionMethod:'research', nextActionDate:'',
          nextActionReason:'', service:'', problem:'', estimatedValue:''
        };
        state.salesAssistant = state.salesAssistant || {};
        state.salesAssistant.leads = Array.isArray(state.salesAssistant.leads) ? state.salesAssistant.leads : [];
        state.salesAssistant.leads.push(lead);
        client.sourceLeadId = lead.id;
        lead.clientRecordId = client.id;
      }
      if (existing && next !== initialStage) applyStage(client, next);
      if (lead) {
        Object.assign(lead, {
          businessName:client.name, contactName:client.contact, email:client.email,
          phone:client.phone, address:client.address, website:client.website,
          notes:client.notes, category:client.businessType, businessType:client.businessType,
          businessOverview:client.businessOverview, businessKeyDetails:client.businessKeyDetails,
          updatedAt:dateTime()
        });
        if (next !== 'Client') lead.stage = next;
        lead.clientRecordId = client.id;
        client.sourceLeadId = lead.id;
        client.lastLeadSyncedAt = lead.updatedAt;
      }
      client.pipelineStage = next;
      client.updatedAt = dateTime();
      client.businessProfileEditedAt = client.updatedAt;
      await saveState();
      closeModal();
      render();
      toast('Client saved');
    };
  };

  // On the Sales Assistant page keep the action planner, while ensuring
  // imported prospects immediately acquire one corresponding client record.
  const previousRenderSales = window.renderSales;
  window.renderSales = function () {
    ensureAfterRemoteLoad();
    previousRenderSales();
    const intro = document.querySelector('.sales-hero p');
    if (intro) intro.textContent = 'Your client contacts, scheduled approaches and follow-ups in one place.';
    const newButton = document.querySelector('[data-sales-action="new-lead"]');
    if (newButton) newButton.textContent = '+ Add contact';
    const lostSummary = document.querySelector('.hq-handover details');
    if (lostSummary) lostSummary.remove();
  };

  const style = document.createElement('style');
  style.textContent =
    '.hq-directory-intro{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px}' +
    '.hq-directory-intro h2{margin:0 0 5px;font-size:21px}.hq-directory-intro p{margin:0;color:var(--muted);font-size:13px}' +
    '.hq-client-tabs{display:flex;gap:7px}.hq-directory-toolbar select{border:1px solid var(--line);border-radius:10px;padding:10px;min-width:155px;background:#fff;color:var(--ink)}' +
    '.hq-client-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}' +
    '.hq-client-item{border:1px solid var(--line);background:#fff;border-radius:16px;padding:18px;min-width:0;box-shadow:var(--shadow)}' +
    '.hq-client-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}' +
    '.hq-client-heading h3{margin:0;font-size:17px;overflow-wrap:anywhere}.hq-client-heading p{font-size:12px;color:var(--muted);margin:6px 0 0}' +
    '.hq-client-heading .badge{flex-shrink:0}.hq-client-details{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;margin:18px 0}' +
    '.hq-client-details>div{min-width:0;font-size:13px;overflow-wrap:anywhere}.hq-client-details span{display:block;color:var(--muted);font-size:11px;margin-bottom:5px}' +
    '.hq-client-details a{color:var(--blue)}.hq-client-details em{font-style:normal;color:var(--muted)}' +
    '.hq-client-controls{display:flex;align-items:end;justify-content:flex-end;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:13px}' +
    '.hq-client-controls label{margin-right:auto;font-size:11px;font-weight:700;color:var(--muted)}' +
    '.hq-client-controls select{display:block;border:1px solid var(--line);border-radius:9px;padding:8px 9px;max-width:150px;color:var(--ink);background:#fff;margin-top:4px;font-size:12px}' +
    '.hq-client-controls .hq-no-button{color:var(--bad);border-color:#f3c8cc}' +
    '.hq-no-reason{font-size:12px;color:var(--muted);line-height:1.5;margin:4px 0 12px}' +
    '.hq-business-profile{background:#f7f9fc;border:1px solid var(--line);border-radius:12px;padding:13px 14px;margin:12px 0 16px;overflow-wrap:anywhere}' +
    '.hq-business-profile-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px}' +
    '.hq-business-profile-head strong{font-size:12px;color:var(--navy)}.hq-business-profile-head span{font-size:11px;color:#46576a;background:#e8edf4;border-radius:8px;padding:4px 8px}' +
    '.hq-business-overview,.hq-business-facts p,.hq-business-empty{font-size:12px;line-height:1.6;white-space:pre-line;color:#465061;margin:10px 0 0}' +
    '.hq-business-facts{margin-top:12px;padding-top:11px;border-top:1px solid #e0e6ed}.hq-business-facts strong{font-size:11px;color:var(--navy)}' +
    '.hq-form-section-heading{border-top:1px solid var(--line);margin-top:5px;padding-top:15px}.hq-form-section-heading h3{margin:0 0 5px;font-size:17px}.hq-form-section-heading p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}' +
    '@media(max-width:950px){.hq-client-grid{grid-template-columns:1fr}}' +
    '@media(max-width:500px){.hq-directory-intro{align-items:flex-start}.hq-client-tabs{width:100%}.hq-client-tabs button{flex:1}.hq-client-details{grid-template-columns:1fr 1fr}.hq-client-controls label{width:100%}.hq-client-controls select{width:100%;max-width:none}.hq-directory-toolbar select{width:100%}}';
  document.head.appendChild(style);
  window.ChipInClientDirectory = {synchronise:synchroniseClients};
})();