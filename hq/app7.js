// Chip In HQ device-link and multi-device passphrase flow
// Existing data: token first, then the existing shared passphrase.
// Only a genuinely empty ChipIn-Data repository may create a new passphrase.

function existingDevicePassphraseStep(token,remote){
  openModal(`<h2>Enter your Chip In HQ passphrase</h2>
  <p class="sub">GitHub access is confirmed. Now enter the same Chip In HQ passphrase you already use on your other device.</p>
  <form id="ghExistingPass"><div class="field"><label>Passphrase</label><input name="pass" type="password" minlength="10" autocomplete="current-password" required autofocus></div>
  <div class="hint-box" style="margin-top:14px"><strong>This is not a new passphrase.</strong> Use your existing Chip In HQ passphrase.</div>
  <div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn gold" type="submit">Link this device</button></div></form>`);

  document.getElementById('ghExistingPass').onsubmit=async e=>{
    e.preventDefault();
    const p=String(new FormData(e.target).get('pass')||''),btn=e.target.querySelector('[type=submit]');
    btn.disabled=true;btn.textContent='Linking…';
    try{
      await openText(remote.text,p);
      await saveCredential(token,p);
      ghToken=token;ghPass=p;ghUnlocked=true;
      closeModal();
      await reconcileGh();
      render();
      toast('This device is now linked to Chip In HQ');
    }catch(err){
      btn.disabled=false;btn.textContent='Link this device';
      toast(err.message.includes('Wrong Chip In HQ passphrase')?'That passphrase does not match your existing Chip In HQ data.':err.message);
    }
  };
}

function firstEverPassphraseStep(token){
  openModal(`<h2>Create the Chip In HQ passphrase</h2>
  <p class="sub">No existing Chip In HQ data was found in ChipIn-Data. This appears to be the first-ever setup.</p>
  <form id="ghFirstPass"><div class="form-grid">
    <div class="field"><label>Create passphrase</label><input name="pass" type="password" minlength="10" autocomplete="new-password" required autofocus></div>
    <div class="field"><label>Confirm passphrase</label><input name="again" type="password" minlength="10" autocomplete="new-password" required></div>
  </div>
  <div class="warning-box" style="margin-top:14px"><strong>Keep this passphrase safe.</strong> Every other device will use this same passphrase.</div>
  <div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn gold" type="submit">Create private storage</button></div></form>`,true);

  document.getElementById('ghFirstPass').onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target),p=String(f.get('pass')||''),a=String(f.get('again')||''),btn=e.target.querySelector('[type=submit]');
    if(p!==a)return toast('Passphrases do not match');
    btn.disabled=true;btn.textContent='Creating…';
    try{
      await saveCredential(token,p);
      ghToken=token;ghPass=p;ghUnlocked=true;
      closeModal();
      await reconcileGh();
      render();
      if(!state.settings.setupComplete)setTimeout(chipInAllowBusinessSetup,100);
      toast('Chip In HQ private storage created');
    }catch(err){
      btn.disabled=false;btn.textContent='Create private storage';toast(err.message);
    }
  };
}

setupGh=function(){
  openModal(`<h2>Link this device</h2>
  <p class="sub">Enter the fine-grained GitHub token for <strong>ChipIn-Data</strong>. You only need to do this once on this device or browser.</p>
  <form id="ghTokenStep"><div class="field"><label>GitHub token</label><input name="token" type="password" autocomplete="off" required autofocus placeholder="github_pat_…"></div>
  <div class="hint-box" style="margin-top:14px">After the token is verified, Chip In HQ will ask for your existing passphrase and load your encrypted data.</div>
  <div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn gold" type="submit">Verify token</button></div></form>`);

  document.getElementById('ghTokenStep').onsubmit=async e=>{
    e.preventDefault();
    const token=String(new FormData(e.target).get('token')||'').trim(),btn=e.target.querySelector('[type=submit]');
    btn.disabled=true;btn.textContent='Checking…';
    try{
      await checkToken(token);
      const old=ghToken;
      ghToken=token;
      let remote=null;
      try{remote=await getFile('data/chipin.enc')}finally{ghToken=old}
      if(remote)existingDevicePassphraseStep(token,remote);
      else firstEverPassphraseStep(token);
    }catch(err){
      btn.disabled=false;btn.textContent='Verify token';toast(err.message);
    }
  };
};

// Devices that already hold their encrypted GitHub token should only need the
// shared Chip In HQ passphrase on each fresh session.
unlockBox=function(){
  openModal(`<h2>Unlock Chip In HQ</h2><p class="sub">Enter your Chip In HQ passphrase to load the latest encrypted data from ChipIn-Data.</p><form id="ghUnlock"><div class="field"><label>Passphrase</label><input name="pass" type="password" autocomplete="current-password" required autofocus></div><div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Use local copy only</button><button class="btn gold" type="submit">Unlock</button></div></form>`);
  document.getElementById('ghUnlock').onsubmit=async e=>{
    e.preventDefault();
    const p=String(new FormData(e.target).get('pass')||''),b=e.target.querySelector('[type=submit]');
    b.disabled=true;b.textContent='Unlocking…';
    try{
      await unlockGh(p);
      closeModal();
      render();
      if(!state.settings.setupComplete)setTimeout(chipInAllowBusinessSetup,100);
      toast('Private storage unlocked');
    }catch(err){
      b.disabled=false;b.textContent='Unlock';toast(err.message);
    }
  };
};
