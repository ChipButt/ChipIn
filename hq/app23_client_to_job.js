// Chip In HQ — turn a won client into a job using the existing full job editor.
// No new client record is created, and no job is saved until the form is submitted.
(function () {
  'use strict';

  const trim = value => String(value == null ? '' : value).trim();
  const norm = value => trim(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const MEETINGS_KEY = 'chipin-client-meetings-v2';
  const findLead = client => (state.salesAssistant?.leads || []).find(l =>
    l.id === client.sourceLeadId || l.clientRecordId === client.id || l.convertedClientId === client.id);

  function inferCategory(service) {
    const value = trim(service).toLowerCase();
    if (/website|web\s?design|web\s?site|domain|hosting|\bseo\b/.test(value)) return 'Website';
    if (/quiz|trivia/.test(value)) return 'Quiz hosting';
    if (/video|film|editing/.test(value)) return 'Video editing';
    if (/production|photograph|audio|podcast|voice.?over|recording/.test(value)) return 'Production';
    if (/hospitality|staffing|bar service|event/.test(value)) return 'Events / hospitality';
    if (/admin|general support|business support|virtual assistant/.test(value)) return 'General support';
    return 'Other'; // Never infer a job from the type of business alone.
  }

  function matchingMeetings(client) {
    const source = window.ChipInProspectConversion?.allMeetings?.() || [];
    const name = norm(client.name);
    return source.filter(m =>
      (m.hqClientId && m.hqClientId === client.id) || (name && norm(m.business) === name)
    ).filter(m => !m.hqJobId || !jobById(m.hqJobId));
  }

  function noteLines(lead) {
    if (!lead) return '';
    const pairs = [
      ['Opportunity', lead.problem],
      ['Last sales discussion', lead.lastContactSummary],
      ['Sales notes', lead.notes]
    ];
    return pairs.filter(([, text]) => trim(text)).map(([label, text]) => label + ':\n' + trim(text)).join('\n\n');
  }

  function fill(form, name, value) {
    const control = form.elements.namedItem(name);
    if (control && value != null && trim(value)) control.value = value;
    return control;
  }

  function linkMeeting(meeting, job, clientId) {
    if (!meeting || !job || job.category !== 'Website') return false;
    try {
      const library = JSON.parse(localStorage.getItem(MEETINGS_KEY) || '{}');
      const record = library.projects?.[meeting.id];
      if (!record || (record.hqJobId && record.hqJobId !== job.id && jobById(record.hqJobId))) return false;
      record.hqClientId = clientId;
      record.hqJobId = job.id;
      localStorage.setItem(MEETINGS_KEY, JSON.stringify(library));
      job.meetingId = meeting.id;
      job.projectId = trim(meeting.projectId || job.projectId);
      return true;
    } catch (error) {
      console.warn('Website meeting could not be linked', error);
      return false;
    }
  }

  function createJob(client) {
    const lead = findLead(client);
    const service = trim(lead?.service);
    const meetings = matchingMeetings(client);
    const category = service ? inferCategory(service) : (meetings.length === 1 ? 'Website' : 'Other');

    // Use the established job editor: categories, pricing, day/hour rates,
    // discounts, timesheets, recurrence and invoice generation stay intact.
    openJobForm();
    const form = document.getElementById('jobForm');
    if (!form) return toast('Job editor could not open');

    const heading = document.querySelector('#modalBody h2');
    if (heading) heading.textContent = 'Convert to Job';
    const sub = document.querySelector('#modalBody .sub');
    if (sub) sub.textContent = 'The client is already linked. Check the category, scope, dates and agreed price before saving.';

    const selectedClient = fill(form, 'clientId', client.id);
    if (!selectedClient || selectedClient.value !== client.id) {
      closeModal();
      return toast('The selected client is not available in the job editor');
    }

    const categoryInput = fill(form, 'category', category);
    if (categoryInput && categoryInput.value !== category) categoryInput.value = 'Other';
    fill(form, 'title', service ? client.name + ' — ' + service :
      client.name + (category === 'Website' ? ' — Website project' : ' — New job'));
    fill(form, 'description', service);
    fill(form, 'notes', noteLines(lead));

    // Trigger the existing client/category pricing logic. The sales *estimate*
    // remains only a reference, never silently becomes an agreed fee.
    selectedClient.dispatchEvent(new Event('change', {bubbles:true}));
    categoryInput?.dispatchEvent(new Event('change', {bubbles:true}));
    // The standard new-job editor initially loads a rate for its *first*
    // category. Clear that value if this client's selected category has no
    // applicable rate, rather than silently carrying an unrelated rate over.
    const rateInput = form.elements.namedItem('rate');
    const rateType = form.elements.namedItem('rateType')?.value || 'day';
    const chosenCategory = categoryInput?.value || 'Other';
    const applicableRate = typeof chipInRateFor === 'function'
      ? Number(chipInRateFor(client.id, chosenCategory, rateType)?.rate || 0) : 0;
    if (rateInput && applicableRate <= 0) {
      rateInput.value = '';
      rateInput.dispatchEvent(new Event('input', {bubbles:true}));
    }

    const estimate = Number(lead?.estimatedValue);
    const hasEstimate = lead?.estimatedValue !== '' && lead?.estimatedValue != null
      && Number.isFinite(estimate) && estimate > 0;
    const summary = document.createElement('div');
    summary.className = 'hq-job-conversion-summary';
    summary.innerHTML =
      '<strong>Linked client:</strong> ' + esc(client.name) +
      (client.contact ? ' <span>· ' + esc(client.contact) + '</span>' : '') +
      (service ? '<p><strong>Sales opportunity:</strong> ' + esc(service) + '</p>' : '') +
      (hasEstimate ? '<p><strong>Sales estimate:</strong> ' + money(estimate) +
        ' — reference only. Enter or confirm the agreed job price below.</p>' : '') +
      '<p>Saving creates a job, not another client. You can invoice it from Jobs when the work is complete.</p>';
    form.parentElement.insertBefore(summary, form);

    if (meetings.length) {
      const section = document.createElement('div');
      section.className = 'field full hq-job-meeting';
      section.innerHTML = '<label for="hqJobMeetingChoice">Website Client Meeting Builder (optional)</label>' +
        '<select id="hqJobMeetingChoice"><option value="">Do not link a meeting</option>' +
        meetings.map(m => '<option value="' + esc(m.id) + '">' + esc(m.business || client.name) +
          (m.date ? ' · ' + esc(m.date) : '') + '</option>').join('') +
        '</select><p>Only matching, unlinked meetings are shown. Select one if it belongs to this job.</p>';
      const grid = form.querySelector('.form-grid');
      grid?.appendChild(section);
    }

    const originalSubmit = form.onsubmit;
    let submitting = false;
    form.onsubmit = async function (event) {
      event.preventDefault();
      if (submitting) return;
      submitting = true;
      const beforeIds = new Set(state.jobs.map(j => j.id));
      const selectedMeetingId = document.getElementById('hqJobMeetingChoice')?.value || '';
      const chosenMeeting = meetings.find(m => m.id === selectedMeetingId);
      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      try {
        // This runs the normal final job form handler, including all existing
        // validations, save behaviour and any requested recurring jobs.
        await originalSubmit.call(form, event);
        const created = state.jobs.filter(j => !beforeIds.has(j.id));
        const matching = created.filter(j => j.clientId === client.id);
        if (matching.length) {
          for (const job of matching) {
            job.sourceClientId = client.id;
            if (lead) job.sourceLeadId = lead.id;
          }
          if (lead) {
            lead.convertedClientId = client.id;
            if (!lead.convertedJobId || !jobById(lead.convertedJobId)) {
              lead.convertedJobId = matching[0].id;
              lead.convertedAt = new Date().toISOString();
            }
            // Linking a job is not a research update. Do not advance the
            // lead's contact-data timestamp: that could overwrite newer,
            // manually corrected client details during state reconciliation.
          }
          if (chosenMeeting) linkMeeting(chosenMeeting, matching[0], client.id);
          await saveState();
          toast(matching.length === 1 ? 'Job created for ' + client.name : matching.length + ' jobs created for ' + client.name);
        } else if (created.length) {
          toast('Job saved to the client selected in the form.');
        }
      } catch (error) {
        console.error('Client to job conversion failed', error);
        toast('Could not finish creating job: ' + error.message);
      } finally {
        submitting = false;
        if (submitButton) submitButton.disabled = false;
      }
    };
  }

  function start(clientId, addAnother = false) {
    const client = clientById(clientId);
    if (!client) return toast('Client not found');
    if (client.pipelineStage !== 'Won' && findLead(client)?.stage !== 'Won') {
      return toast('Set this client to Won before converting it to a job.');
    }
    const lead = findLead(client);
    // Any existing job for this client merits a duplicate check, including
    // jobs created before the new conversion workflow existed.
    const linked = state.jobs.filter(j => j.clientId === client.id);
    if (linked.length && !addAnother) {
      openModal('<h2>Job already linked</h2><p class="sub">' + esc(client.name) +
        ' already has ' + linked.length + ' job' + (linked.length === 1 ? '' : 's') +
        ' linked to this client conversion. Open an existing one or deliberately create another.</p>' +
        '<div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button>' +
        '<button class="btn secondary" type="button" id="hqOpenExistingJob">Open job</button>' +
        '<button class="btn gold" type="button" id="hqCreateAnotherJob">Create another job</button></div>');
      document.getElementById('hqOpenExistingJob').onclick = () => {
        closeModal();page='jobs';render();openJobForm(linked[0].id);
      };
      document.getElementById('hqCreateAnotherJob').onclick = () => createJob(client);
      return;
    }
    createJob(client);
  }

  const style = document.createElement('style');
  style.textContent =
    '.hq-job-conversion-summary{border:1px solid #dce5f0;background:#f4f7fb;border-radius:12px;padding:12px 14px;margin:12px 0 20px;font-size:12px;line-height:1.55;color:#465269}' +
    '.hq-job-conversion-summary strong{color:#0a2f57}.hq-job-conversion-summary p{margin:7px 0 0}' +
    '.hq-job-conversion-summary span{color:#657182}.hq-job-meeting{margin-top:12px}' +
    '.hq-job-meeting select{width:100%;border:1px solid #dce1e8;border-radius:10px;background:#fff;padding:10px}' +
    '.hq-job-meeting p{color:#6f7787;font-size:12px;margin:6px 0 0}';
  document.head.appendChild(style);
  window.ChipInClientToJob = {start, inferCategory};
})();