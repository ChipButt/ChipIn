(function(){
  const modal=document.getElementById('videoModal');
  const panel=document.getElementById('modalPanel');
  const videoHost=document.getElementById('modalVideo');
  const closeButton=document.getElementById('closeModal');

  function youtubeEmbedUrl(src){
    const value=String(src||'');
    let id='';
    const short=value.match(/youtu\.be\/([^?&#/]+)/i);
    const watch=value.match(/[?&]v=([^?&#/]+)/i);
    const embed=value.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#/]+)/i);
    if(short)id=short[1];
    else if(watch)id=watch[1];
    else if(embed)id=embed[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1` : '';
  }

  function openVideo(trigger){
    if(!modal||!panel||!videoHost)return;

    const ratio=trigger.dataset.ratio||'landscape';
    const src=trigger.dataset.video||'';
    const title=trigger.dataset.title||'Video';
    const youtubeSrc=youtubeEmbedUrl(src);

    videoHost.className=`modal-video ${ratio}`;
    panel.className='modal-panel video-viewer-panel';

    if(youtubeSrc){
      videoHost.innerHTML=`<iframe class="ci-youtube-frame" src="${youtubeSrc}" title="${title.replace(/"/g,'&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen webkitallowfullscreen></iframe>`;
    }else if(/\.mp4(?:$|\?)/i.test(src) && !/^https?:\/\/drive\.google\.com/i.test(src)){
      videoHost.innerHTML=`<video class="ci-native-video" src="${src}" title="${title.replace(/"/g,'&quot;')}" controls playsinline autoplay preload="metadata"></video>`;
    }else{
      videoHost.innerHTML=`<iframe class="ci-drive-frame" src="${src}" title="${title.replace(/"/g,'&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen webkitallowfullscreen></iframe>`;
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('video-modal-open');

    const localVideo=videoHost.querySelector('video');
    if(localVideo){
      const playPromise=localVideo.play();
      if(playPromise&&typeof playPromise.catch==='function')playPromise.catch(()=>{});
    }
  }

  document.querySelectorAll('.open-video').forEach(trigger=>{
    trigger.addEventListener('click',()=>openVideo(trigger));
  });

  function close(){
    if(!modal)return;
    const localVideo=videoHost?.querySelector('video');
    if(localVideo)localVideo.pause();
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