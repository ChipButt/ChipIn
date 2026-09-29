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

  function directDriveUrl(fileId){
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
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
    const fileId=driveFileId(trigger.dataset.video);
    const originalUrl=trigger.dataset.video;
    const src=fileId?directDriveUrl(fileId):originalUrl;

    videoHost.className=`modal-video ${ratio}`;
    panel.className='modal-panel video-viewer-panel';

    videoHost.innerHTML=`
      <div class="ci-video-shell controls-visible">
        <video class="ci-video" playsinline preload="metadata" src="${src}"></video>
        <button class="ci-video-center-play" type="button" aria-label="Play video">▶</button>
        <div class="ci-video-controls" aria-label="Video controls">
          <button class="ci-video-play" type="button" aria-label="Play or pause">▶</button>
          <input class="ci-video-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Video progress">
          <span class="ci-video-time">0:00 / 0:00</span>
        </div>
        <div class="ci-video-error" hidden>
          <p>This video could not be streamed directly.</p>
          <a href="${originalUrl.replace('/preview','/view')}" target="_blank" rel="noopener">Open video</a>
        </div>
      </div>`;

    const shell=videoHost.querySelector('.ci-video-shell');
    const video=videoHost.querySelector('.ci-video');
    const centerPlay=videoHost.querySelector('.ci-video-center-play');
    const playButton=videoHost.querySelector('.ci-video-play');
    const seek=videoHost.querySelector('.ci-video-seek');
    const time=videoHost.querySelector('.ci-video-time');
    const error=videoHost.querySelector('.ci-video-error');

    function updateButtons(){
      const paused=video.paused||video.ended;
      centerPlay.hidden=!paused;
      playButton.textContent=paused?'▶':'❚❚';
      playButton.setAttribute('aria-label',paused?'Play':'Pause');
    }

    function showControls(){
      shell.classList.add('controls-visible');
      scheduleControlsHide(shell,video);
    }

    function togglePlay(){
      if(video.paused||video.ended){
        const promise=video.play();
        if(promise&&typeof promise.catch==='function')promise.catch(()=>showControls());
      }else{
        video.pause();
      }
    }

    video.addEventListener('loadedmetadata',()=>{
      time.textContent=`0:00 / ${formatTime(video.duration)}`;
      updateButtons();
    });

    video.addEventListener('timeupdate',()=>{
      if(Number.isFinite(video.duration)&&video.duration>0){
        seek.value=String(Math.round((video.currentTime/video.duration)*1000));
        time.textContent=`${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
      }
    });

    video.addEventListener('play',()=>{
      updateButtons();
      scheduleControlsHide(shell,video);
    });

    video.addEventListener('pause',()=>{
      updateButtons();
      clearHideTimer();
      shell.classList.add('controls-visible');
    });

    video.addEventListener('ended',()=>{
      updateButtons();
      clearHideTimer();
      shell.classList.add('controls-visible');
    });

    video.addEventListener('error',()=>{
      clearHideTimer();
      shell.classList.add('controls-visible');
      error.hidden=false;
      centerPlay.hidden=true;
      video.hidden=true;
    });

    centerPlay.addEventListener('click',e=>{
      e.stopPropagation();
      togglePlay();
    });

    playButton.addEventListener('click',e=>{
      e.stopPropagation();
      togglePlay();
      showControls();
    });

    seek.addEventListener('input',e=>{
      e.stopPropagation();
      if(Number.isFinite(video.duration)&&video.duration>0){
        video.currentTime=(Number(seek.value)/1000)*video.duration;
      }
      showControls();
    });

    shell.addEventListener('click',e=>{
      if(e.target.closest('.ci-video-controls,.ci-video-center-play,.ci-video-error'))return;
      if(shell.classList.contains('controls-visible')){
        if(!video.paused)shell.classList.remove('controls-visible');
      }else{
        showControls();
      }
    });

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
    const activeVideo=videoHost?.querySelector('video');
    if(activeVideo)activeVideo.pause();
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