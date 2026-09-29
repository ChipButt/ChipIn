(function(){
  const modal=document.getElementById('videoModal');
  const panel=document.getElementById('modalPanel');
  const videoHost=document.getElementById('modalVideo');
  const closeButton=document.getElementById('closeModal');
  let hideTimer=null;

  function formatTime(seconds){
    if(!Number.isFinite(seconds))return '0:00';
    const total=Math.max(0,Math.floor(seconds));
    const mins=Math.floor(total/60);
    const secs=String(total%60).padStart(2,'0');
    return `${mins}:${secs}`;
  }

  function driveFileId(url){
    const match=String(url||'').match(/\/d\/([^/]+)/);
    return match?match[1]:'';
  }

    function clearHideTimer(){
    if(hideTimer){
      clearTimeout(hideTimer);
      hideTimer=null;
    }
  }

  function scheduleControlsHide(shell,video){
    clearHideTimer();
    if(video.paused||video.ended)return;
    hideTimer=setTimeout(()=>shell.classList.remove('controls-visible'),1800);
  }

  function openVideo(trigger){
    if(!modal||!videoHost)return;

    const ratio=trigger.dataset.ratio||'landscape';
    const originalUrl=trigger.dataset.video;
    const src=originalUrl;

    videoHost.className=`modal-video ${ratio}`;
    panel.className='modal-panel video-viewer-panel';

    videoHost.innerHTML=`
      <div class="ci-video-shell controls-visible">
        <iframe class="ci-drive-frame" src="${src}" title="${(trigger.dataset.title||'Video').replace(/"/g,'&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen webkitallowfullscreen></iframe>
      </div>`;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('video-modal-open');

    const promise=video.play();
    if(promise&&typeof promise.catch==='function'){
      promise.catch(()=>{
        shell.classList.add('controls-visible');
        updateButtons();
      });
    }
  }

  document.querySelectorAll('.open-video').forEach(trigger=>{
    trigger.addEventListener('click',()=>openVideo(trigger));
  });

  function close(){
    if(!modal)return;
    clearHideTimer();
        modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('video-modal-open');
    if(videoHost)videoHost.innerHTML='';
  }

  closeButton?.addEventListener('click',close);
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