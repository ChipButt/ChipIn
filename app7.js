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
      // Detect whether this is the first device or an additional device.
      // If encrypted cloud data already exists, verify the passphrase against it
      // before storing anything locally. This prevents a second device accidentally
      // creating a different encryption password.
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
      toast(remote?'This device is now linked to Chip In HQ':'Chip In HQ private storage created');
    }catch(err){
      btn.disabled=false;btn.textContent='Connect securely';toast(err.message);
    }
  };
};
