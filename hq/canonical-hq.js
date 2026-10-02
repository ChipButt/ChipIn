// Chip In HQ canonical address guard
(function(){
  'use strict';
  const CANONICAL_ORIGIN='https://chipinworks.co.uk';
  const host=location.hostname.toLowerCase();
  let targetPath='';
  if(host==='chipbutt.github.io'){
    const marker='/ChipIn/hq';
    if(location.pathname===marker||location.pathname.startsWith(marker+'/')){
      targetPath=location.pathname.slice('/ChipIn'.length)||'/hq/';
    }
  }else if(host==='www.chipinworks.co.uk'){
    targetPath=location.pathname;
  }
  if(targetPath){
    if(targetPath==='/hq')targetPath='/hq/';
    location.replace(CANONICAL_ORIGIN+targetPath+location.search+location.hash);
  }
})();