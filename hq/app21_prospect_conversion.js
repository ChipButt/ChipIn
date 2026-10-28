// Chip In HQ - confirmed prospect > client > job handover.
// Existing records are linked by IDs; meeting drafts remain local to this browser.
(function () {
  'use strict';
  const MEETINGS_KEY = 'chipin-client-meetings-v2';
  const INTENT_KEY = 'chipin-hq-meeting-intent-v1';
  const clean = v => String(v == null ? '' : v).trim();
  const norm = v => clean(v).toLowerCase().replace(/[^a-z0-9]/g, '');
  const fields = form => Object.fromEntries(new FormData(form).entries());
  const leadById = id => (state.salesAssistant?.leads || []).find(l => l.id === id);
  const allMeetings = () => {
    try {
      const data = JSON.parse(localStorage.getItem(MEETINGS_KEY) || '{}');
      return Object.entries(data.projects || {}).filter(([, m]) => m && m.fields).map(([id, m]) => ({
        id, business: clean(m.fields.business), contact: clean(m.fields.contact),
        date: clean(m.fields.meetingDate), projectId: clean(m.projectId),
        hqJobId: clean(m.hqJobId), hqClientId: clean(m.hqClientId),
        fields: m.fields
      }));
    } catch (error) { console.warn('Meeting library unavailable', error); return []; }
  };
  const isMatch = (m, name, clientId, leadId) =>
    (norm(name) && norm(m.business) === norm(name)) ||
    (clientId && m.hqClientId === clientId) ||
    (leadId && state.jobs.some(j => j.sourceLeadId === leadId && j.id === m.hqJobId));
  // Include other local meeting drafts as manual choices when names differ.
  // Only precise matches are ever auto-suggested.
  const matchingMeetings = (name, clientId, leadId) =>
    allMeetings().sort((a, b) => Number(!!isMatch(b, name, clientId, leadId)) -
      Number(!!isMatch(a, name, clientId, leadId)));

  function selectOptions(items, selected, labelFn) {
    return items.map(item => '<option value="' + esc(item.id) + '"' +
      (item.id === selected ? ' selected' : '') + '>' + esc(labelFn(item)) + '</option>').join('');
  }
  function clientDefaults(lead) {
    return {
      name: clean(lead.businessName), contact: clean(lead.contactName),
      email: clean(lead.email), phone: clean(lead.phone),
      address: clean(lead.address), website: clean(lead.website),
      notes: clean(lead.notes)
    };
  }
  function fill(form, values, keys) {
    keys.forEach(key => { if (form.elements.namedItem(key)) form.elements.namedItem(key).value = values[key] ?? ''; });
  }
  const clientKeys = ['name', 'contact', 'email', 'phone', 'address', 'website', 'notes'];

  function start(leadId, clientDraft) {
    const lead = leadById(leadId);
    if (!lead) { toast('Prospect not found'); return; }
    if (lead.convertedClientId && lead.convertedJobId &&
        clientById(lead.convertedClientId) && jobById(lead.convertedJobId)) {
      openModal('<h2>Already converted</h2><p class="sub">' + esc(lead.businessName) +
        ' is linked to a client and a job. No duplicate will be created.</p>' +
        '<div class="form-actions"><button class="btn secondary" data-close-modal>Close</button>' +
        '<button class="btn" id="viewConvertedJob">Open linked job</button></div>');
      $('#viewConvertedJob').onclick = () => { closeModal(); page = 'jobs'; render(); openJobForm(lead.convertedJobId); };
      return;
    }
    const existing = state.clients.filter(c => c.sourceLeadId === lead.id ||
      (norm(c.name) && norm(c.name) === norm(lead.businessName)) ||
      (lead.email && clean(c.email).toLowerCase() === clean(lead.email).toLowerCase()));
    const linked = existing.find(c => c.sourceLeadId === lead.id);
    const suggested = linked || (existing.length === 1 ? existing[0] : null);
    const initial = clientDraft || suggested || clientDefaults(lead);
    const chosenClientId = clientDraft ? clientDraft.existingClientId : (suggested?.id || '');
    openModal(
      '<div class="sales-kicker">WON CONTRACT · STEP 1 OF 2</div><h2>Confirm client details</h2>' +
      '<p class="sub">Check the details transferred from ' + esc(lead.businessName) +
      '. Use an existing client where appropriate; do not create another copy of the same business.</p>' +
      '<form id="hqConversionClient"><div class="form-grid">' +
      '<div class="field full"><label>Client record</label><select name="existingClientId" id="hqExistingClient">' +
      '<option value="">Create a new client</option>' +
      selectOptions(existing, chosenClientId, c => c.name + (c.email ? ' · ' + c.email : '')) +
      '</select>' + (existing.length ? '<div class="muted">Possible existing client found. Confirm which record to use.</div>' : '') + '</div>' +
      '<div class="field"><label>Business / client name</label><input name="name" required value="' + esc(initial.name) + '"></div>' +
      '<div class="field"><label>Contact</label><input name="contact" value="' + esc(initial.contact) + '"></div>' +
      '<div class="field"><label>Email</label><input type="email" name="email" value="' + esc(initial.email) + '"></div>' +
      '<div class="field"><label>Phone</label><input name="phone" value="' + esc(initial.phone) + '"></div>' +
      '<div class="field full"><label>Invoice address</label><textarea name="address">' + esc(initial.address) + '</textarea></div>' +
      '<div class="field full"><label>Website</label><input name="website" value="' + esc(initial.website) + '"></div>' +
      '<div class="field full"><label>Client notes</label><textarea name="notes">' + esc(initial.notes) + '</textarea></div>' +
      '<div class="field full"><label class="hq-check"><input name="confirmedClient" type="checkbox" required> I have checked these client details and the selected client record.</label></div>' +
      '</div><div class="form-actions"><button type="button" class="btn secondary" data-close-modal>Cancel</button>' +
      '<button class="btn" type="submit">Next · Confirm job</button></div></form>', true
    );
    const form = $('#hqConversionClient');
    $('#hqExistingClient').onchange = e => {
      const record = state.clients.find(c => c.id === e.target.value);
      fill(form, record || clientDefaults(lead), clientKeys);
      form.elements.confirmedClient.checked = false;
    };
    form.onsubmit = e => {
      e.preventDefault();
      const values = fields(form);
      if (values.existingClientId && !clientById(values.existingClientId)) { toast('Select a valid client'); return; }
      if (!clean(values.name)) { toast('Client name is required'); return; }
      openJobReview(lead, values);
    };
  }

  function jobDefaults(lead, meeting) {
    const service = clean(lead.service);
    const isWebsite = /web|site|hosting|domain/i.test(service) || !!meeting;
    const title = isWebsite ? clean(lead.businessName) + ' website build' :
      (service || clean(lead.businessName) + ' project');
    return {
      title, category: isWebsite ? 'Website' : 'Other', status: 'Booked',
      startDate: TODAY(), endDate: TODAY(),
      amount: lead.estimatedValue !== '' && lead.estimatedValue != null ? Number(lead.estimatedValue) || 0 : 0,
      description: service, notes: clean(lead.problem)
    };
  }

  function openJobReview(lead, client) {
    const currentClient = client.existingClientId || '';
    const matches = state.jobs.filter(j => (currentClient && j.clientId === currentClient) ||
      j.sourceLeadId === lead.id);
    const meetings = matchingMeetings(client.name, currentClient, lead.id);
    const previouslyLinked = matches.find(j => j.sourceLeadId === lead.id);
    const selectedJob = previouslyLinked || null;
    const precise = meetings.filter(m => isMatch(m, client.name, currentClient, lead.id));
    const suggestedMeeting = meetings.find(m => selectedJob && (m.id === selectedJob.meetingId || m.hqJobId === selectedJob.id)) ||
      (precise.length === 1 ? precise[0] : null);
    const values = selectedJob || jobDefaults(lead, suggestedMeeting);
    openModal(
      '<div class="sales-kicker">WON CONTRACT · STEP 2 OF 2</div><h2>Confirm the job and website work</h2>' +
      '<p class="sub">Client: <strong>' + esc(client.name) +
      '</strong>. Confirm the scope, status and agreed fee. The sales estimate is not treated as an agreed quote until you verify it.</p>' +
      '<form id="hqConversionJob"><div class="form-grid">' +
      '<div class="field full"><label>Job record</label><select name="existingJobId" id="hqExistingJob">' +
      '<option value="">Create a new job</option>' +
      selectOptions(matches, selectedJob?.id || '', j => j.title + ' · ' + (j.reference || j.status || 'existing job')) +
      '</select>' + (matches.length ? '<div class="muted">Existing jobs found. Select one to update and link instead of duplicating.</div>' : '') + '</div>' +
      '<div class="field full"><label>Website Client Meeting Builder</label><select name="meetingId" id="hqMeeting">' +
      '<option value="">No meeting linked yet</option>' +
      selectOptions(meetings, suggestedMeeting?.id || '', m => m.business + (m.date ? ' · ' + m.date : '') +
        (m.projectId ? ' · linked website project' : '')) +
      '</select><div class="muted">' +
      (precise.length ? 'Matching meeting drafts found on this browser. Please confirm the correct one.' :
        meetings.length ? 'Other saved meeting drafts are available; select one only if it is the right project.' :
        'No meeting drafts are saved in this browser. You can create or link one after saving.') +
      '</div></div>' +
      '<div class="field full"><label>Job title</label><input name="title" required value="' + esc(values.title) + '"></div>' +
      '<div class="field"><label>Category</label><select name="category">' +
      ['Website', 'Events / hospitality', 'Quiz hosting', 'Video editing', 'Production', 'General support', 'Other']
        .map(c => '<option' + (c === values.category ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
      '</select></div>' +
      '<div class="field"><label>Job status</label><select name="status">' +
      ['Quote', 'Booked', 'In progress', 'Complete', 'Invoiced', 'Paid'].map(s =>
        '<option' + (s === values.status ? ' selected' : '') + '>' + esc(s) + '</option>').join('') +
      '</select></div>' +
      '<div class="field"><label>Start date</label><input type="date" name="startDate" value="' + esc(values.startDate || '') + '"></div>' +
      '<div class="field"><label>End date</label><input type="date" name="endDate" value="' + esc(values.endDate || '') + '"></div>' +
      '<div class="field full"><label>Agreed fee (£)</label><input type="number" name="amount" min="0" step="0.01" required value="' +
      esc(values.amount ?? 0) + '"><div class="muted">Verify the actual agreed job price. £0 is allowed when the fee is still to be agreed.</div></div>' +
      '<div class="field full"><label>Invoice description / agreed scope</label><textarea name="description">' + esc(values.description || '') + '</textarea></div>' +
      '<div class="field full"><label>Job notes</label><textarea name="notes">' + esc(values.notes || '') + '</textarea></div>' +
      '<div class="field full"><label class="hq-check"><input type="checkbox" name="confirmedJob" required> I have checked the job details, agreed fee and existing job / meeting links.</label></div>' +
      '</div><div class="form-actions"><button type="button" class="btn secondary" id="hqBackClient">Back</button>' +
      '<button type="button" class="btn secondary" data-close-modal>Cancel</button>' +
      '<button type="submit" class="btn gold" id="hqConfirmConversion">Confirm · Create client and job</button></div></form>', true
    );
    const form = $('#hqConversionJob');
    $('#hqBackClient').onclick = () => start(lead.id, client);
    $('#hqExistingJob').onchange = e => {
      const record = state.jobs.find(j => j.id === e.target.value);
      const meeting = meetings.find(m => m.id === form.elements.meetingId.value);
      fill(form, record || jobDefaults(lead, meeting),
        ['title', 'category', 'status', 'startDate', 'endDate', 'amount', 'description', 'notes']);
      form.elements.confirmedJob.checked = false;
    };
    form.onsubmit = async e => {
      e.preventDefault();
      const data = fields(form);
      if (data.existingJobId && !jobById(data.existingJobId)) { toast('Job no longer exists'); return; }
      if (data.meetingId && !meetings.some(m => m.id === data.meetingId)) { toast('Meeting no longer exists'); return; }
      if (!Number.isFinite(Number(data.amount)) || Number(data.amount) < 0) { toast('Check the agreed fee'); return; }
      const button = $('#hqConfirmConversion');
      button.disabled = true;
      const oldClients = structuredClone(state.clients);
      const oldJobs = structuredClone(state.jobs);
      const oldLeads = structuredClone(state.salesAssistant.leads);
      const oldActivity = structuredClone(state.salesAssistant.activity || []);
      const oldNextJobNumber = state.settings.nextJobNumber;
      try {
        const now = new Date().toISOString();
        let c = client.existingClientId ? clientById(client.existingClientId) : null;
        if (client.existingClientId && !c) throw Error('Client record no longer exists');
        const clientData = Object.fromEntries(clientKeys.map(k => [k, clean(client[k])]));
        if (c) Object.assign(c, clientData, {updatedAt: now});
        else {
          c = Object.assign({id: uid('cli'), createdAt: now}, clientData);
          state.clients.push(c);
        }
        if (!c.sourceLeadId) c.sourceLeadId = lead.id;
        let j = data.existingJobId ? jobById(data.existingJobId) : null;
        if (j && j.clientId !== c.id && j.sourceLeadId !== lead.id) throw Error('Selected job belongs to another client');
        const fee = Number(data.amount);
        const meeting = meetings.find(m => m.id === data.meetingId);
        if (meeting?.hqJobId && meeting.hqJobId !== (j?.id || '') && jobById(meeting.hqJobId))
          throw Error('This meeting is already linked to another HQ job. Select that existing job first.');
        const jobData = {
          clientId: c.id, title: clean(data.title), category: data.category,
          status: data.status, startDate: data.startDate, endDate: data.endDate,
          amount: fee, description: clean(data.description), notes: clean(data.notes),
          sourceLeadId: lead.id, meetingId: meeting?.id || '',
          projectId: meeting?.projectId || (j?.projectId || ''),
          updatedAt: now
        };
        if (j) Object.assign(j, jobData, {overrideAmount: fee});
        else {
          j = Object.assign({
            id: uid('job'), reference: chipInNextJobReference(),
            createdAt: now, rateType: 'day', days: 1, rate: fee,
            hours: 0, minutes: 0, discount: 0, overrideAmount: null
          }, jobData);
          state.jobs.push(j);
        }
        lead.stage = 'Won';
        lead.convertedClientId = c.id;
        lead.convertedJobId = j.id;
        lead.convertedMeetingId = meeting?.id || '';
        lead.convertedAt = now;
        lead.nextActionDate = '';
        lead.updatedAt = now;
        if (!state.salesAssistant.activity.some(a => a.leadId === lead.id && a.type === 'won')) {
          state.salesAssistant.activity.push({id:uid('saleact'),leadId:lead.id,date:TODAY(),type:'won',
            summary:'Converted into client and job in Chip In HQ',createdAt:now});
        }
        await saveState();
        if (meeting) attachMeeting(meeting.id, c.id, j.id);
        closeModal();
        openModal('<h2>Client and job linked</h2><p class="sub"><strong>' + esc(c.name) +
          '</strong> is now a client. Job <strong>' + esc(j.title) + '</strong> is linked to the won prospect.' +
          (meeting ? ' The saved website meeting is linked too.' : ' No meeting draft was linked yet.') +
          '</p><div class="form-actions"><button type="button" class="btn secondary" id="hqGoJobs">Open job</button>' +
          '<button type="button" class="btn gold" id="hqGoMeeting">Website meeting builder</button></div>');
        $('#hqGoJobs').onclick = () => { closeModal(); page = 'jobs'; render(); openJobForm(j.id); };
        $('#hqGoMeeting').onclick = () => openMeetingForJob(j.id);
      } catch (error) {
        state.clients = oldClients; state.jobs = oldJobs; state.salesAssistant.leads = oldLeads;
        state.salesAssistant.activity = oldActivity;
        state.settings.nextJobNumber = oldNextJobNumber;
        button.disabled = false;
        toast('Could not complete conversion: ' + error.message);
        console.error('Prospect conversion failed', error);
      }
    };
  }

  function attachMeeting(meetingId, clientId, jobId) {
    try {
      const library = JSON.parse(localStorage.getItem(MEETINGS_KEY) || '{}');
      if (!library.projects?.[meetingId]) return;
      const meeting = library.projects[meetingId];
      // Never replace a previous website project ID with an HQ job ID.
      meeting.hqJobId = jobId;
      meeting.hqClientId = clientId;
      localStorage.setItem(MEETINGS_KEY, JSON.stringify(library));
    } catch (error) { console.warn('Meeting link will complete when the builder opens', error); }
  }
  function openMeetingForJob(jobId) {
    const job = jobById(jobId);
    if (!job) { toast('Job not found'); return; }
    const client = clientById(job.clientId);
    try {
      localStorage.setItem(INTENT_KEY, JSON.stringify({
        hqJobId: job.id, hqClientId: job.clientId,
        business: client?.name || '', contact: client?.contact || '',
        email: client?.email || '', location: client?.address || ''
      }));
    } catch (error) { console.warn('Meeting handover could not be prepared', error); }
    const qs = new URLSearchParams({hqJobId: job.id, hqClientId: job.clientId});
    if (job.meetingId) qs.set('meetingId', job.meetingId);
    if (job.projectId) qs.set('projectId', job.projectId);
    const url = '../client-meeting/?' + qs.toString();
    window.open(url, '_blank', 'noopener');
  }

  const previousSales = window.renderSales;
  window.renderSales = function () {
    previousSales();
    const sales = state.salesAssistant?.leads || [];
    const wins = sales.filter(l => l.stage === 'Won');
    const lost = sales.filter(l => l.stage === 'Lost');
    const pipeline = $('#content .sales-pipeline');
    if (!pipeline) return;
    const section = document.createElement('div');
    section.className = 'hq-handover';
    section.innerHTML =
      '<div class="section-title"><div><h2>Won contracts · client handover</h2>' +
      '<p>Won and lost contacts are removed from the active prospect pool. Keep the sales history.</p></div></div>' +
      '<div class="card">' + (wins.length ? wins.map(l => {
        const job = l.convertedJobId && jobById(l.convertedJobId);
        return '<div class="action-item"><div><div class="title">' + esc(l.businessName) + '</div>' +
          '<div class="meta">' + (job ? 'Client and job linked · ' + esc(job.title) :
            'Won · client and job still need confirming') + '</div></div>' +
          (job ? '<button class="btn small secondary" data-hq-job="' + esc(job.id) + '">Open job</button>' :
            '<button class="btn small gold" data-hq-convert="' + esc(l.id) + '">Create client + job</button>') +
          '</div>';
      }).join('') : '<p class="muted">No won contracts awaiting handover.</p>') +
      (lost.length ? '<details><summary>' + lost.length + ' closed / lost prospect(s)</summary>' +
        '<p class="muted">' + lost.map(l => esc(l.businessName)).join(' · ') + '</p></details>' : '') +
      '</div>';
    pipeline.insertAdjacentElement('afterend', section);
  };

  const previousJobs = window.renderJobs;
  window.renderJobs = function () {
    previousJobs();
    const websiteJobs = state.jobs.filter(j => j.category === 'Website' || j.meetingId);
    if (!websiteJobs.length) return;
    const section = document.createElement('div');
    section.className = 'card hq-handover';
    section.innerHTML = '<h3 style="margin-top:0">Website meeting links</h3>' +
      '<p class="muted">Open the existing meeting record, or start a linked draft for this job.</p>' +
      websiteJobs.map(j => '<div class="action-item"><div><div class="title">' + esc(j.title) +
        '</div><div class="meta">' + esc(clientById(j.clientId)?.name || '') + ' · ' +
        (j.meetingId ? 'Meeting linked' : 'Meeting not yet linked') + '</div></div>' +
        '<button class="btn small secondary" data-hq-meeting="' + esc(j.id) +
        '">Website meeting</button></div>').join('');
    $('#content').prepend(section);
  };
  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-hq-convert],[data-hq-job],[data-hq-meeting]');
    if (!btn) return;
    if (btn.dataset.hqConvert) start(btn.dataset.hqConvert);
    else if (btn.dataset.hqJob) { page = 'jobs'; render(); openJobForm(btn.dataset.hqJob); }
    else if (btn.dataset.hqMeeting) openMeetingForJob(btn.dataset.hqMeeting);
  });
  const css = document.createElement('style');
  css.textContent = '.hq-handover{margin-top:16px}.hq-handover .action-item{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(128,128,128,.15);padding:12px 0}.hq-handover .action-item:last-child{border-bottom:0}.hq-handover .action-item .meta{font-size:12px;color:#6b7280;margin-top:4px}.hq-check{display:flex;gap:8px;align-items:flex-start;line-height:1.5}.hq-check input{width:auto;margin-top:4px}';
  document.head.appendChild(css);
  window.ChipInProspectConversion = {start, openMeetingForJob, allMeetings};
})();