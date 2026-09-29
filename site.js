(function(){
  const modal=document.getElementById('videoModal');
  const panel=document.getElementById('modalPanel');
  const videoHost=document.getElementById('modalVideo');
  const closeButton=document.getElementById('closeModal');

  const ytPlayers=new Map();
  let activeYoutubeId='';
  let queuedYoutubeId='';
  let ytSetupStarted=false;
  let closeHideTimer=null;
  let activeVideoPlaying=false;
  let wakeLayer=null;

  function clearCloseHideTimer(){
    if(closeHideTimer){
      clearTimeout(closeHideTimer);
      closeHideTimer=null;
    }
  }

  function ensureWakeLayer(){
    if(wakeLayer||!videoHost)return wakeLayer;
    wakeLayer=document.createElement('div');
    wakeLayer.className='ci-video-wake-layer';
    wakeLayer.setAttribute('aria-hidden','true');
    wakeLayer.addEventListener('pointerdown',e=>{
      if(!activeVideoPlaying)return;
      e.preventDefault();
      e.stopPropagation();
      showCloseTemporarily();
    });
    videoHost.appendChild(wakeLayer);
    return wakeLayer;
  }

  function keepCloseVisible(){
    clearCloseHideTimer();
    closeButton?.classList.remove('modal-close-hidden');
    ensureWakeLayer()?.classList.remove('active');
  }

  function hideClose(){
    if(!activeVideoPlaying)return;
    closeButton?.classList.add('modal-close-hidden');
    ensureWakeLayer()?.classList.add('active');
  }

  function showCloseTemporarily(){
    keepCloseVisible();
    if(!activeVideoPlaying)return;
    closeHideTimer=setTimeout(hideClose,2200);
  }

  function setVideoPlaying(isPlaying){
    activeVideoPlaying=Boolean(isPlaying);
    if(activeVideoPlaying)showCloseTemporarily();
    else keepCloseVisible();
  }

  function youtubeVideoId(src){
    const value=String(src||'');
    const short=value.match(/youtu\.be\/([^?&#/]+)/i);
    const watch=value.match(/[?&]v=([^?&#/]+)/i);
    const embed=value.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#/]+)/i);
    const shorts=value.match(/youtube(?:-nocookie)?\.com\/shorts\/([^?&#/]+)/i);
    if(short)return short[1];
    if(watch)return watch[1];
    if(embed)return embed[1];
    if(shorts)return shorts[1];
    return '';
  }

  function showYoutubeSlot(id){
    ytPlayers.forEach((entry,key)=>{
      entry.slot.style.display=key===id?'block':'none';
      if(key!==id&&entry.ready){
        try{entry.player.pauseVideo()}catch(e){}
      }
    });
  }

  function playYoutube(id){
    const entry=ytPlayers.get(id);
    if(!entry||!entry.ready){
      queuedYoutubeId=id;
      return false;
    }
    queuedYoutubeId='';
    activeYoutubeId=id;
    showYoutubeSlot(id);
    try{
      entry.player.unMute();
      entry.player.setVolume(100);
      entry.player.playVideo();
      return true;
    }catch(e){
      return false;
    }
  }

  function prepareYoutubePlayers(){
    if(ytSetupStarted||!videoHost||!window.YT||!window.YT.Player)return;
    ytSetupStarted=true;

    const seen=new Map();
    document.querySelectorAll('.open-video[data-video]').forEach(trigger=>{
      const id=youtubeVideoId(trigger.dataset.video);
      if(id&&!seen.has(id))seen.set(id,trigger.dataset.title||'Video');
    });

    seen.forEach((title,id)=>{
      const slot=document.createElement('div');
      slot.className='ci-youtube-player-slot';
      slot.dataset.youtubeId=id;
      slot.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:none;background:#000;';
      const mount=document.createElement('div');
      mount.id='ci-yt-'+id.replace(/[^a-z0-9_-]/gi,'');
      slot.appendChild(mount);
      videoHost.appendChild(slot);

      const entry={slot,player:null,ready:false};
      ytPlayers.set(id,entry);

      entry.player=new YT.Player(mount,{
        videoId:id,
        playerVars:{
          playsinline:1,
          controls:1,
          rel:0,
          enablejsapi:1,
          origin:location.origin
        },
        events:{
          onReady:()=>{
            entry.ready=true;
            try{
              entry.player.unMute();
              entry.player.setVolume(100);
            }catch(e){}
            if(queuedYoutubeId===id&&modal?.classList.contains('show')){
              playYoutube(id);
            }
          },
          onStateChange:event=>{
            if(activeYoutubeId!==id)return;
            if(event.data===YT.PlayerState.PLAYING)setVideoPlaying(true);
            else if(
              event.data===YT.PlayerState.PAUSED||
              event.data===YT.PlayerState.ENDED||
              event.data===YT.PlayerState.CUED
            )setVideoPlaying(false);
          }
        }
      });
    });
  }

  function loadYoutubeApi(){
    const hasYoutube=document.querySelector('.open-video[data-video*="youtu"]');
    if(!hasYoutube||!videoHost)return;

    if(window.YT&&window.YT.Player){
      prepareYoutubePlayers();
      return;
    }

    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=function(){
      if(typeof previous==='function')previous();
      prepareYoutubePlayers();
    };

    if(!document.querySelector('script[data-chipin-youtube-api]')){
      const script=document.createElement('script');
      script.src='https://www.youtube.com/iframe_api';
      script.async=true;
      script.dataset.chipinYoutubeApi='true';
      document.head.appendChild(script);
    }
  }

  function openVideo(trigger){
    if(!modal||!panel||!videoHost)return;

    const ratio=trigger.dataset.ratio||'landscape';
    const src=trigger.dataset.video||'';
    const title=trigger.dataset.title||'Video';
    const youtubeId=youtubeVideoId(src);

    videoHost.className=`modal-video ${ratio}`;
    panel.className='modal-panel video-viewer-panel';

    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('video-modal-open');
    keepCloseVisible();
    ensureWakeLayer();

    if(youtubeId){
      videoHost.querySelectorAll('.ci-fallback-media').forEach(node=>node.remove());
      if(!playYoutube(youtubeId)){
        showYoutubeSlot(youtubeId);
        queuedYoutubeId=youtubeId;
      }
      return;
    }

    ytPlayers.forEach(entry=>{
      entry.slot.style.display='none';
      if(entry.ready){
        try{entry.player.pauseVideo()}catch(e){}
      }
    });
    activeYoutubeId='';

    videoHost.querySelectorAll('.ci-fallback-media').forEach(node=>node.remove());
    const wrapper=document.createElement('div');
    wrapper.className='ci-fallback-media';
    wrapper.style.cssText='position:absolute;inset:0;width:100%;height:100%;';

    if(/\.mp4(?:$|\?)/i.test(src) && !/^https?:\/\/drive\.google\.com/i.test(src)){
      wrapper.innerHTML=`<video class="ci-native-video" src="${src}" title="${title.replace(/"/g,'&quot;')}" controls playsinline autoplay preload="metadata" style="width:100%;height:100%;object-fit:contain;background:#000"></video>`;
    }else{
      wrapper.innerHTML=`<iframe class="ci-drive-frame" src="${src}" title="${title.replace(/"/g,'&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen webkitallowfullscreen></iframe>`;
    }
    videoHost.appendChild(wrapper);

    const localVideo=wrapper.querySelector('video');
    if(localVideo){
      localVideo.addEventListener('play',()=>setVideoPlaying(true));
      localVideo.addEventListener('pause',()=>setVideoPlaying(false));
      localVideo.addEventListener('ended',()=>setVideoPlaying(false));
      const promise=localVideo.play();
      if(promise&&typeof promise.catch==='function')promise.catch(()=>{});
    }
  }

  document.querySelectorAll('.open-video').forEach(trigger=>{
    trigger.addEventListener('click',()=>openVideo(trigger));
  });

  function close(){
    if(!modal)return;
    clearCloseHideTimer();
    activeVideoPlaying=false;
    closeButton?.classList.remove('modal-close-hidden');
    wakeLayer?.classList.remove('active');
    if(activeYoutubeId){
      const entry=ytPlayers.get(activeYoutubeId);
      if(entry?.ready){
        try{entry.player.pauseVideo()}catch(e){}
      }
    }
    queuedYoutubeId='';
    activeYoutubeId='';
    ytPlayers.forEach(entry=>entry.slot.style.display='none');

    const localVideo=videoHost?.querySelector('.ci-fallback-media video');
    if(localVideo)localVideo.pause();
    videoHost?.querySelectorAll('.ci-fallback-media').forEach(node=>node.remove());

    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('video-modal-open');
  }

  closeButton?.addEventListener('click',close);
  panel?.addEventListener('pointermove',()=>{
    if(activeVideoPlaying&&!closeButton?.classList.contains('modal-close-hidden'))showCloseTemporarily();
  });
  modal?.addEventListener('click',e=>{if(e.target===modal)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

  loadYoutubeApi();

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