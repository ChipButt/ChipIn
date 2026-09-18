(function(){
  const form=document.getElementById('videoCostBuilder');
  if(!form)return;
  const result=document.getElementById('guidePrice');
  const email=document.getElementById('builderEmail');
  const fields=['outputLength','filming','editing','graphics','contentLevel'];
  const round5=n=>Math.max(0,Math.round(n/5)*5);
  function calculate(){
    let total=40;
    for(const name of fields){
      const el=form.elements[name];
      total+=Number(el?.selectedOptions?.[0]?.dataset?.price||0);
    }
    const low=round5(total*.9),high=round5(total*1.15);
    result.textContent='£'+low+'–£'+high;
    const lines=fields.map(name=>{
      const el=form.elements[name],label=el?.closest('.builder-field')?.querySelector('label')?.textContent||name;
      return label+': '+(el?.selectedOptions?.[0]?.textContent||'');
    });
    const subject=encodeURIComponent('Chip In - Video Creation Enquiry');
    const body=encodeURIComponent('Hi Chip,\n\nI used the video guide-price builder:\n\n'+lines.join('\n')+'\n\nGuide estimate: £'+low+'–£'+high+'\n\nPlease could you give me a bespoke quote?');
    email.href='mailto:jamesbutt.chipin@gmail.com?subject='+subject+'&body='+body;
  }
  form.addEventListener('change',calculate);
  calculate();
})();