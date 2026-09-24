(function(){
  const round5=n=>Math.max(0,Math.round(n/5)*5);
  document.querySelectorAll('.guide-price-form').forEach(form=>{
    const result=form.querySelector('[data-guide-price]');
    const email=form.querySelector('[data-guide-email]');
    const summary=form.querySelector('[data-guide-summary]');
    if(!result||!email)return;

    function fieldLine(el){
      const wrap=el.closest('.builder-field');
      const label=wrap?.querySelector('label,.builder-legend')?.textContent?.trim()||el.name||'Option';
      if(el.matches('select')){
        const opt=el.selectedOptions[0];
        return label+': '+(opt?.textContent?.trim()||'');
      }
      if(el.type==='checkbox'){
        return el.checked ? (el.dataset.label||el.closest('.builder-check')?.textContent?.trim()||label) : null;
      }
      return label+': '+(el.value||'');
    }

    function calculate(){
      let total=Number(form.dataset.base||0);
      const lines=[];
      form.querySelectorAll('select[data-price-field]').forEach(el=>{
        const opt=el.selectedOptions[0];
        total+=Number(opt?.dataset?.price||0);
        lines.push(fieldLine(el));
      });
      form.querySelectorAll('input[type="checkbox"][data-price]').forEach(el=>{
        if(el.checked){
          total+=Number(el.dataset.price||0);
          const line=fieldLine(el);
          if(line)lines.push(line);
        }
      });
      total=round5(total);
      result.textContent='Around £'+total;
      if(summary)summary.textContent=lines.filter(Boolean).join(' · ');

      const title=form.dataset.title||'Service';
      const subject=encodeURIComponent('Chip In - '+title+' Enquiry');
      const body=encodeURIComponent(
        'Hi Chip,\n\nI used the '+title+' guide-price builder:\n\n'+
        lines.filter(Boolean).join('\n')+
        '\n\nBallpark guide shown: around £'+total+
        '\n\nI understand this is only a rough guide and not a fixed quote. Please could we discuss the exact requirements and a bespoke price?'
      );
      email.href='mailto:jamesbutt.chipin@gmail.com?subject='+subject+'&body='+body;
    }

    form.addEventListener('change',calculate);
    form.addEventListener('input',calculate);
    calculate();
  });
})();