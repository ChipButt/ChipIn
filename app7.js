// Chip In HQ setup wording / multi-device passphrase guard
// The encryption passphrase belongs to the whole Chip In HQ data store, not to one device.
setupGh=function(){
  openModal(`<h2>Connect private storage</h2>
  <p class="sub">Paste the fine-grained GitHub token for <strong>ChipIn-Data</strong>. Then enter your Chip In HQ passphrase.</p>
  <form id="ghSetup"><div class="form-grid">
    <div class="field full"><label>GitHub token</label><input name="token" type="password" autocomplete="off" required placeholder="github_pat_…"></div>
    <div class="field"><label>Chip In HQ passphrase</label><input name="pass" type="password" minlength="10" autocomplete="current-password" required></div>
    <div class="field"><label>Confirm passphrase</label><input name="again" type="password" minlength="10" autocomplete="current-password" required></div>
  </div>
  <div class="hint-box" style="margin-top:14px"><strong>Use one passphrase on every device.</strong> On the first device, choose it. On your phone, computer, or any later device, enter that exact same passphrase.</div>
  <div class="warning-box" style="margin-top:12px"><strong>Do not lose this passphrase.</strong> It is never stored in GitHub. Without it, the encrypted business archive cannot be opened.</div>
  <div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn gold" type="submit">Connect securely</button></div></form>`,true);

  document.getElementById('ghSetup').onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target),
      t=String(f.get('token')||'').trim(),
      p=String(f.get('pass')||''),
      a=String(f.get('again')||'');
    if(p!==a)return toast('Passphrases do not match');
    const btn=e.target.querySelector('[type=submit]');
    btn.disabled=true;btn.textContent='Checking…';
    try{
      await checkToken(t);
      const old=ghToken;
      ghToken=t;
      let remote=null;
      try{remote=await getFile('data/chipin.enc')}finally{ghToken=old}
      if(remote){
        try{await openText(remote.text,p)}
        catch{throw Error('That is not the Chip In HQ passphrase already used for your private data. Enter the same passphrase as your other device.')}
      }
      await saveCredential(t,p);
      ghToken=t;ghPass=p;ghUnlocked=true;
      closeModal();
      await reconcileGh();
      render();
      if(!state.settings.setupComplete&&!remote){
        setTimeout(chipInAllowBusinessSetup,100);
      }
      toast(remote?'This device is now linked to Chip In HQ':'Chip In HQ private storage created');
    }catch(err){
      btn.disabled=false;btn.textContent='Connect securely';toast(err.message);
    }
  };
};

// A device that already has its encrypted GitHub credential should only ask for
// the shared Chip In HQ passphrase. Business setup is considered only after the
// private store has been unlocked and reconciled.
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
