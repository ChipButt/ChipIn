/* Chip In website-care plan selection: connects the cards to the existing price builder. */
(() => {
  const planSelect = document.getElementById('webCare');
  const planCards = [...document.querySelectorAll('[data-care-card]')];
  const status = document.querySelector('[data-care-status]');
  if (!planSelect || planCards.length !== 3) return;

  const planNames = {
    '0': 'No monthly care plan selected.',
    '25': 'Website Health — £25/month',
    '49': 'Website Care — £49/month',
    '89': 'Website Partner — £89/month'
  };

  function syncFromCalculator() {
    const selected = planSelect.value;
    planCards.forEach(card => {
      const radio = card.querySelector('.website-care-pick');
      if (!radio) return;
      const active = radio.value === selected;
      radio.checked = active;
      card.classList.toggle('is-selected', active);
      const label = card.querySelector('[data-care-choice-label]');
      if (label) label.textContent = active ? 'Selected for my quote' : 'Choose this plan';
    });
    if (status) {
      status.textContent = selected === '0'
        ? 'Monthly care is optional. Select a plan above to include it in your guide price.'
        : planNames[selected] + ' added to your guide price. You can change it at any time.';
    }
  }

  planCards.forEach(card => {
    const radio = card.querySelector('.website-care-pick');
    if (!radio) return;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      planSelect.value = radio.value;
      planSelect.dispatchEvent(new Event('change', { bubbles: true }));
      syncFromCalculator();
    });
  });

  planSelect.addEventListener('change', syncFromCalculator);
  syncFromCalculator();
})();