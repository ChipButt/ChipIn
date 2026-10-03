(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const decode=()=>{
    const raw=location.hash.slice(1).replace(/-/g,'+').replace(/_/g,'/');
    const pad=raw+'='.repeat((4-raw.length%4)%4);
    const bytes=Uint8Array.from(atob(pad),c=>c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const has=(text,...terms)=>terms.some(x=>text.includes(x));
  const locality=address=>{
    const a=String(address||'');
    if(/bidford-on-avon/i.test(a))return'Bidford-on-Avon';
    if(/alcester/i.test(a))return'Alcester';
    if(/studley/i.test(a))return'Studley';
    if(/broom/i.test(a))return'Broom';
    return a.split(',').map(x=>x.trim()).filter(Boolean)[1]||'Warwickshire';
  };
  const photos={
    salon:[
      'https://images.pexels.com/photos/7750099/pexels-photo-7750099.jpeg?auto=compress&cs=tinysrgb&w=1600',
      'https://images.pexels.com/photos/14564860/pexels-photo-14564860.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/7750115/pexels-photo-7750115.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3993449/pexels-photo-3993449.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3992874/pexels-photo-3992874.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3993465/pexels-photo-3993465.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3992855/pexels-photo-3992855.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3738349/pexels-photo-3738349.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ],
    florist:[
      'https://images.pexels.com/photos/6720594/pexels-photo-6720594.jpeg?auto=compress&cs=tinysrgb&w=1600',
      'https://images.pexels.com/photos/5894075/pexels-photo-5894075.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/12362043/pexels-photo-12362043.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/931162/pexels-photo-931162.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/1488463/pexels-photo-1488463.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/1070850/pexels-photo-1070850.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/1128783/pexels-photo-1128783.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/1458694/pexels-photo-1458694.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ],
    cafe:[
      'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1600',
      'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/1855214/pexels-photo-1855214.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/70497/pexels-photo-70497.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/315755/pexels-photo-315755.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ],
    pub:[
      'https://images.pexels.com/photos/1267696/pexels-photo-1267696.jpeg?auto=compress&cs=tinysrgb&w=1600',
      'https://images.pexels.com/photos/63633/bar-local-cong-ireland-63633.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/260922/pexels-photo-260922.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/274192/pexels-photo-274192.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/941864/pexels-photo-941864.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/553758/pexels-photo-553758.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/1283219/pexels-photo-1283219.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ],
    dog:[
      'https://images.pexels.com/photos/6568501/pexels-photo-6568501.jpeg?auto=compress&cs=tinysrgb&w=1600',
      'https://images.pexels.com/photos/6131008/pexels-photo-6131008.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/4587998/pexels-photo-4587998.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/5731866/pexels-photo-5731866.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/6568943/pexels-photo-6568943.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/4587987/pexels-photo-4587987.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/1254140/pexels-photo-1254140.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ],
    auto:[
      'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=1600',
      'https://images.pexels.com/photos/4489702/pexels-photo-4489702.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/97075/pexels-photo-97075.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/170811/pexels-photo-170811.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/358070/pexels-photo-358070.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/164634/pexels-photo-164634.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/244206/pexels-photo-244206.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ],
    retail:[
      'https://images.pexels.com/photos/264507/pexels-photo-264507.jpeg?auto=compress&cs=tinysrgb&w=1600',
      'https://images.pexels.com/photos/3962285/pexels-photo-3962285.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/5709661/pexels-photo-5709661.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/5632402/pexels-photo-5632402.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/5868722/pexels-photo-5868722.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/5650026/pexels-photo-5650026.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/2536965/pexels-photo-2536965.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/5632397/pexels-photo-5632397.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ],
    generic:[
      'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1600',
      'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3184339/pexels-photo-3184339.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3184454/pexels-photo-3184454.jpeg?auto=compress&cs=tinysrgb&w=1200',
      'https://images.pexels.com/photos/3184423/pexels-photo-3184423.jpeg?auto=compress&cs=tinysrgb&w=1200'
    ]
  };
  const profiles={
    salon:{eyebrow:'Hair · Beauty · Self-care',strapline:'Feel good. Look like you.',about:'A local salon built around personal service and easy-to-find information.',palette:['#7a4358','#4d2938','#e3b36a','#f7eef0']},
    florist:{eyebrow:'Flowers · Gifts · Occasions',strapline:'Flowers for the moments that matter.',about:'Fresh flowers, thoughtful gifts and floral work for everyday moments and special occasions.',palette:['#46604d','#2f4336','#d1a45f','#f1eee4']},
    cafe:{eyebrow:'Coffee · Food · Local',strapline:'A local place worth stopping for.',about:'A straightforward local spot for food, drink and time together.',palette:['#7a3e2e','#4b2620','#e6b85c','#f7efe4']},
    pub:{eyebrow:'Drinks · Food · Community',strapline:'Your local, online.',about:'A welcoming local venue with the information customers need before they visit.',palette:['#173f35','#0f3028','#b78a44','#f4efe3']},
    dog:{eyebrow:'Dogs · Grooming · Care',strapline:'Good care, clearly presented.',about:'A local dog-care business with a simple place for services, contact and booking information.',palette:['#415d67','#2a4149','#d7aa5e','#eef2ef']},
    auto:{eyebrow:'Vehicles · Service · Local',strapline:'Make the stock and services easy to find.',about:'A clear digital home for vehicle information, services and contact details.',palette:['#35465e','#202c3e','#d09b51','#edf0f3']},
    retail:{eyebrow:'Independent · Local · Useful',strapline:'A better shop window online.',about:'A clear, visual home for products, services and contact information.',palette:['#56445d','#392f40','#c8a15d','#f3eef2']},
    generic:{eyebrow:'Independent · Local · Easy to find',strapline:'A proper home online.',about:'A simple, polished website that puts the useful information first.',palette:['#3f5065','#283747','#caa15a','#f1efe9']}
  };
  function kindFor(text){
    if(has(text,'florist','bouquet','flower','floral'))return'florist';
    if(has(text,'salon','hair','beauty','nail','tanning','make-up','makeup','skin care','skincare'))return'salon';
    if(has(text,'cafe','coffee','bakery','restaurant','food','takeaway'))return'cafe';
    if(has(text,'pub','bar','beer','live music'))return'pub';
    if(has(text,'dog','grooming','pet'))return'dog';
    if(has(text,'car sales','garage','vehicle','mot','auto services'))return'auto';
    if(has(text,'shop','retail','products','ecommerce','homeware'))return'retail';
    return'generic';
  }
  function offeringList(text,kind){
    const defs=[
      ['Hair',['hair','hairdressing'],'Hair services are part of the current public business offering.'],
      ['Beauty',['beauty','treatment'],'Beauty services are included in the current public business information.'],
      ['Nails',['nail'],'Nail services are listed as part of the current offering.'],
      ['Tanning',['tanning','sunbed'],'Tanning is listed among the current services.'],
      ['Bouquets',['bouquet'],'Bouquets are part of the florist offering identified in research.'],
      ['Weddings',['wedding','bridal'],'Wedding work is included in the current business offering.'],
      ['Gifts',['gift'],'Gifts are included in the current public business information.'],
      ['Seasonal flowers',['seasonal'],'Seasonal work is identified as part of the current opportunity.'],
      ['Coffee',['coffee'],'Coffee is part of the current food and drink offering.'],
      ['Food',['food','lunch','breakfast','menu'],'Food is part of the current business offering.'],
      ['Events',['event','party','live music','quiz'],'Events or entertainment are part of the current public business information.'],
      ['Dog grooming',['dog grooming','grooming'],'Dog grooming is part of the verified current business offering.'],
      ['Vehicle sales',['car sales','dealer','stock'],'Vehicle sales are part of the current business activity.'],
      ['Servicing',['servicing','service','repairs','diagnostics','mot'],'Vehicle service or repair work is part of the current offering.']
    ];
    const found=[];defs.forEach(([name,terms,description])=>{if(terms.some(t=>text.includes(t))&&!found.some(x=>x.name===name))found.push({name,description})});
    if(found.length)return found.slice(0,6);
    const f={florist:[{name:'Flowers',description:'Floral work is central to the current business offering.'}],salon:[{name:'Salon services',description:'The current public information identifies this as a salon or beauty business.'}],cafe:[{name:'Food & drink',description:'The current public information identifies this as a local food or drink business.'}],pub:[{name:'Pub & hospitality',description:'The current public information identifies this as a local hospitality business.'}],dog:[{name:'Dog care',description:'The current public information identifies this as a local dog-care business.'}],auto:[{name:'Automotive',description:'The current public information identifies this as an automotive business.'}],retail:[{name:'Products & services',description:'The current public information identifies an independent retail or product business.'}],generic:[{name:'Services',description:'The confirmed services and useful customer information.'}]};
    return f[kind];
  }
  function initials(name){return String(name||'CI').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
  function safeImages(d,kind){const supplied=Array.isArray(d.images)?d.images.filter(x=>x&&x.url).map(x=>x.url):[];return [...new Set([...supplied,...(photos[kind]||photos.generic)])]}
  function setTheme(p){const[a,b,c,d]=p;document.documentElement.style.setProperty('--primary',a);document.documentElement.style.setProperty('--primary-2',b);document.documentElement.style.setProperty('--accent',c);document.documentElement.style.setProperty('--paper',d)}
  let d;try{d=decode()}catch(e){document.body.innerHTML='<div class="shell section"><div class="card"><h2>Concept preview unavailable</h2><p>This preview link is incomplete or damaged.</p></div></div>';return}
  const text=[d.businessName,d.category,d.service,d.researchSummary,d.opportunity,d.websiteEvidence,JSON.stringify(d.demoProfile||{})].join(' ').toLowerCase();
  const kind=kindFor(text),profile=profiles[kind],images=safeImages(d,kind),offerings=(Array.isArray(d.demoProfile?.offerings)&&d.demoProfile.offerings.length)?d.demoProfile.offerings:offeringList(text,kind);
  setTheme(profile.palette);
  const place=locality(d.address),hash=location.hash;
  const page=document.body.dataset.page||'home';
  const paths={home:'./',about:'about/',services:'services/',hours:'hours/',gallery:'gallery/',visit:'visit/'};
  const root=page==='home'?'./':'../';
  const href=p=>root+paths[p]+hash;
  const pageHref=p=>p===page?' aria-current="page"':'';
  const hoursRaw=Array.isArray(d.demoProfile?.hours)&&d.demoProfile.hours.length?d.demoProfile.hours:(Array.isArray(d.openingHours)?d.openingHours:[]);
  const fallbackDays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const hours=hoursRaw.length?hoursRaw:fallbackDays.map(day=>({day,display:'Please contact the business to confirm'}));
  const verified=d.demoProfile?.hoursVerified===true||d.openingHoursVerified===true||hoursRaw.length>0;
  const heroImage=images[0]||'',aboutImage=images[1]||'';
  const serviceImages=offerings.map((_,i)=>images[i+2]||'');
  const galleryImages=images.slice(2+offerings.length,2+offerings.length+6);
  const facts=(Array.isArray(d.demoProfile?.facts)&&d.demoProfile.facts.length?d.demoProfile.facts:offerings.map(x=>x.name)).slice(0,6);
  const aboutLead=d.demoProfile?.aboutLead||profile.about;
  const aboutBody=d.demoProfile?.aboutBody||((d.businessName||'This business')+' is based in '+place+'. '+(offerings.length?'Current public information highlights '+offerings.map(x=>x.name.toLowerCase()).join(', ')+'.':''));
  const map=d.address?'https://www.google.com/maps?q='+encodeURIComponent(d.address)+'&output=embed':'';
  const maps=d.address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(d.address):'';
  const nav=`<a href="${href('about')}"${pageHref('about')}>About</a><a href="${href('services')}"${pageHref('services')}>Services</a><a href="${href('hours')}"${pageHref('hours')}>Hours</a><a href="${href('gallery')}"${pageHref('gallery')}>Gallery</a><a href="${href('visit')}"${pageHref('visit')}>Visit</a>`;
  const header=`<div class="demo-label">CHIP IN CONCEPT WEBSITE · UNCOMMISSIONED PREVIEW</div><header class="site-header"><div class="shell header-inner"><a class="brand" href="${href('home')}"><span class="brand-mark">${esc(initials(d.businessName))}</span><span class="brand-copy"><strong>${esc(d.businessName||'Business')}</strong><small>${esc(place)}</small></span></a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav"><span></span><span></span><span></span><span class="sr-only">Toggle navigation</span></button><nav class="primary-nav" id="primary-nav">${nav}</nav></div></header>`;
  const footer=`<footer class="site-footer"><div class="shell footer-grid"><div><div class="footer-brand">${esc(d.businessName||'Business')}</div><p>${esc(d.address||'')}</p></div><div class="footer-links"><a href="${href('services')}">Services</a><a href="${href('hours')}">Hours</a><a href="${href('visit')}">Contact</a></div><p class="footer-small">Chip In concept website · prototype imagery may be used until official business assets are supplied.</p></div></footer>`;
  let main='';
  if(page==='home'){
    main=`<main><section class="hero demo-image-hero"><div class="hero-media">${heroImage?'<img src="'+esc(heroImage)+'" alt="Concept business imagery">':''}</div><div class="shell hero-grid"><div class="hero-copy"><p class="eyebrow">${esc(d.demoProfile?.heroEyebrow||profile.eyebrow)}</p><h1><span>${esc(d.demoProfile?.heroTitle||d.businessName||'Local business')}</span><em>${esc(d.demoProfile?.heroSubtitle||place)}</em></h1><p class="hero-intro">${esc(d.demoProfile?.strapline||profile.strapline)}</p><div class="hero-actions"><a class="button button-primary" href="${href('services')}">See services</a><a class="button button-ghost" href="${href('visit')}">Find us</a></div></div><aside class="hero-card"><div class="hero-card-topline">Today</div><div class="today-status">${verified?'Opening hours available':'Hours need confirming'}</div><div class="mini-rule"></div><p>${esc(aboutLead)}</p><a class="text-link" href="${href('hours')}">See opening hours →</a></aside></div></section><section class="section"><div class="shell"><div class="section-heading centered"><h2>Explore ${esc(d.businessName||'the business')}</h2></div><div class="page-card-grid"><a class="page-card" href="${href('about')}"><h3>About</h3><p>Learn more about the business.</p></a><a class="page-card" href="${href('services')}"><h3>Services</h3><p>See the verified services and specialities.</p></a><a class="page-card" href="${href('hours')}"><h3>Hours</h3><p>Plan your visit.</p></a><a class="page-card" href="${href('gallery')}"><h3>Gallery</h3><p>See the visual direction.</p></a><a class="page-card" href="${href('visit')}"><h3>Visit</h3><p>Contact details, directions and map.</p></a></div></div></section></main>`;
  }else if(page==='about'){
    main=`<main><section class="page-hero"><div class="shell"><p class="eyebrow">About</p><h1>${esc(d.demoProfile?.aboutHeading||d.businessName||'About')}</h1><p class="page-lead">${esc(aboutLead)}</p></div></section><section class="section"><div class="shell two-column"><div class="demo-about-image">${aboutImage?'<img src="'+esc(aboutImage)+'" alt="Concept business imagery">':''}</div><div class="prose"><p>${esc(aboutBody)}</p><div class="fact-row">${facts.map(x=>'<span>'+esc(x)+'</span>').join('')}</div></div></div></section></main>`;
  }else if(page==='services'){
    main=`<main><section class="page-hero"><div class="shell"><p class="eyebrow">What we do</p><h1>${esc(d.demoProfile?.servicesHeading||'Services')}</h1><p class="page-lead">${esc(d.demoProfile?.servicesLead||'Explore the services and specialities identified during research.')}</p></div></section><section class="section food-section"><div class="shell"><div class="demo-services-grid">${offerings.map((x,i)=>'<article class="demo-service-card">'+(serviceImages[i]?'<img src="'+esc(serviceImages[i])+'" alt="Concept imagery for '+esc(x.name)+'">':'')+'<div class="demo-service-copy"><h3>'+esc(x.name)+'</h3><p>'+esc(x.description||x.desc||'')+'</p></div></article>').join('')}</div></div></section></main>`;
  }else if(page==='hours'){
    main=`<main><section class="page-hero"><div class="shell"><p class="eyebrow">Plan your visit</p><h1>Opening hours</h1><p class="page-lead">${verified?'Current public opening hours identified during research.':'Current opening hours could not be reliably verified, so please contact the business before making a special journey.'}</p></div></section><section class="section hours-section"><div class="shell"><div class="hours-grid">${hours.map(h=>'<div class="hours-row"><strong>'+esc(h.day)+'</strong><span>'+esc(h.display||h.hours||'Please contact to confirm')+'</span></div>').join('')}</div></div></section></main>`;
  }else if(page==='gallery'){
    main=`<main><section class="page-hero"><div class="shell"><p class="eyebrow">Gallery</p><h1>${esc(d.demoProfile?.galleryHeading||'A visual shop window')}</h1><p class="page-lead">${Array.isArray(d.images)&&d.images.length?'Images identified during research.':'Prototype imagery is being used until the business supplies its own photography.'}</p></div></section><section class="section gallery-section"><div class="shell"><div class="gallery-grid">${galleryImages.map((u,i)=>'<div class="gallery-item"><img src="'+esc(u)+'" alt="Concept image '+(i+1)+'"></div>').join('')}</div></div></section></main>`;
  }else{
    main=`<main><section class="page-hero"><div class="shell"><p class="eyebrow">Come by</p><h1>Visit</h1><p class="page-lead">${esc(d.address||'Contact details to be confirmed')}</p></div></section><section class="section visit-section"><div class="shell visit-grid"><div class="visit-card"><address>${esc(d.address||'Address to be confirmed')}</address><div class="contact-stack">${d.phone?'<a href="tel:'+esc(String(d.phone).replace(/[^+\\d]/g,''))+'"><span>Call</span><strong>'+esc(d.phone)+'</strong></a>':''}${d.email?'<a href="mailto:'+esc(d.email)+'"><span>Email</span><strong>'+esc(d.email)+'</strong></a>':''}</div>${maps?'<a class="button button-primary" href="'+esc(maps)+'" target="_blank" rel="noopener">Directions</a>':''}</div>${map?'<div class="map-card"><iframe title="Map" loading="lazy" src="'+esc(map)+'"></iframe></div>':''}</div></section></main>`;
  }
  document.title=(page==='home'?'':page[0].toUpperCase()+page.slice(1)+' | ')+(d.businessName||'Business');
  document.body.innerHTML=header+main+footer+`<nav class="mobile-actions"><a href="${d.phone?'tel:'+esc(String(d.phone).replace(/[^+\\d]/g,'')):href('visit')}">Call</a><a href="${href('services')}">Services</a><a href="${href('hours')}">Hours</a></nav>`;
  const toggle=document.querySelector('.nav-toggle'),navEl=document.querySelector('.primary-nav');
  toggle?.addEventListener('click',()=>{navEl?.classList.toggle('open');toggle.setAttribute('aria-expanded',String(navEl?.classList.contains('open')))});
})();