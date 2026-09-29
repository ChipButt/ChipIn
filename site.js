(function(){
  const modal=document.getElementById('videoModal');
  const panel=document.getElementById('modalPanel');
  const video=document.getElementById('modalVideo');
  const title=document.getElementById('modalTitle');
  const closeButton=document.getElementById('closeModal');
  const fullscreenButton=document.getElementById('fullscreenVideo');

  function requestFullScreen(){
    if(!panel)return;
    const fn=panel.requestFullscreen||panel.webkitRequestFullscreen;
    if(fn){
      try{
        const result=fn.call(panel);
        if(result&&typeof result.catch==='function')result.catch(()=>{});
      }catch(_){}
    }
  }

  function openVideo(trigger){
    if(!modal||!video)return;
    title.textContent=trigger.dataset.title||'Video';
    const ratio=trigger.dataset.ratio||'landscape';
    video.className=`modal-video ${ratio}`;
    panel.className='modal-panel video-viewer-panel';
    const src=trigger.dataset.video;
    video.innerHTML=`<iframe src="${src}" title="${(trigger.dataset.title||'Video').replace(/"/g,'&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen webkitallowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('video-modal-open');
    if(trigger.classList.contains('project-title-button'))requestFullScreen();
  }

  document.querySelectorAll('.open-video').forEach(trigger=>{
    trigger.addEventListener('click',()=>openVideo(trigger));
  });

  function close(){
    if(!modal)return;
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    if((document.fullscreenElement||document.webkitFullscreenElement)&&exit){
      try{
        const result=exit.call(document);
        if(result&&typeof result.catch==='function')result.catch(()=>{});
      }catch(_){}
    }
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('video-modal-open');
    if(video)video.innerHTML='';
  }

  closeButton?.addEventListener('click',close);
  fullscreenButton?.addEventListener('click',requestFullScreen);
  modal?.addEventListener('click',e=>{if(e.target===modal)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

  const buttons=[...document.querySelectorAll('.tab-btn')],panels=[...document.querySelectorAll('.tab-panel')];
  function setTab(t){
    buttons.forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
    panels.forEach(p=>p.classList.toggle('active',p.id===t));
    const u=new URL(location.href);
    u.searchParams.set('tab',t);
    history.replaceState(null,'',u)
  }
  buttons.forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
  const q=new URLSearchParams(location.search).get('tab');
  if(q&&document.getElementById(q))setTab(q);

  const liveSite=document.querySelector('#web .web-showcase');
  if(liveSite){
    const href='https://angelsanddemonspiercing.netlify.app/';
    liveSite.querySelector('.btn.navy')?.remove();
    const preview=liveSite.querySelector('iframe');
    if(preview)preview.style.pointerEvents='none';
    liveSite.setAttribute('role','link');
    liveSite.setAttribute('tabindex','0');
    liveSite.setAttribute('aria-label','Open Angels and Demons Piercing Studio live website');
    liveSite.style.cursor='pointer';
    liveSite.style.transition='transform .18s, box-shadow .18s';
    const openLive=()=>window.open(href,'_blank','noopener');
    liveSite.addEventListener('click',openLive);
    liveSite.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openLive()}});
    liveSite.addEventListener('mouseenter',()=>{liveSite.style.transform='translateY(-4px)';liveSite.style.boxShadow='0 24px 60px rgba(8,47,104,.15)'});
    liveSite.addEventListener('mouseleave',()=>{liveSite.style.transform='';liveSite.style.boxShadow=''})
  }
})();