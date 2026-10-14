// Chip In HQ: recurring job schedules. Each occurrence is an independent editable job.
(function(){
  'use strict';

  var MAX_OCCURRENCES20=120;
  var JOB_FIELDS20=['clientId','category','customerReference','title','startTime','endTime','rateType','rate','hours','minutes','days','hourlyDiscount','discount','overrideAmount','description','notes'];

  function dayNumber20(value){
    var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
    if(!m)return NaN;
    var n=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))/86400000;
    return dateFromNumber20(n)===value?n:NaN;
  }
  function dateFromNumber20(n){return new Date(n*86400000).toISOString().slice(0,10)}
  function shiftDate20(value,n){var x=dayNumber20(value);return Number.isFinite(x)?dateFromNumber20(x+n):''}
  function daysInMonth20(y,m){return new Date(Date.UTC(y,m,0)).getUTCDate()}
  function weekday20(value){var n=dayNumber20(value);return Number.isFinite(n)?new Date(n*86400000).getUTCDay():5}
  function nthWeekday20(y,month,weekday,ordinal){
    var count=daysInMonth20(y,month);
    if(ordinal==='last'){
      var lastWeekday=new Date(Date.UTC(y,month-1,count)).getUTCDay();
      return count-(lastWeekday-weekday+7)%7;
    }
    var firstWeekday=new Date(Date.UTC(y,month-1,1)).getUTCDay();
    var date=1+(weekday-firstWeekday+7)%7+(Number(ordinal)-1)*7;
    return date<=count?date:null;
  }
  function defaultRule20(job){
    var date=job.recurrencePlannedDate||job.startDate||TODAY();
    var parts=date.split('-').map(Number),dim=daysInMonth20(parts[0],parts[1]);
    var ordinal=(parts[2]+7>dim)?'last':String(Math.floor((parts[2]-1)/7)+1);
    var year=parts[0]||(new Date().getFullYear());
    var until=year+'-12-31';
    if(date>=until)until=(year+1)+'-12-31';
    return Object.assign({frequency:'monthly-weekday',weekday:weekday20(date),ordinal:ordinal,until:until},job.recurrenceRule||{});
  }
  function ruleDates20(anchor,rule){
    var first=dayNumber20(anchor),last=dayNumber20(rule.until),dates=[];
    if(!Number.isFinite(first)||!Number.isFinite(last))throw Error('Enter a valid job date and recurrence end date.');
    if(last<=first)throw Error('The recurrence end date must be after the first job.');
    if(last-first>366*10)throw Error('Choose a recurrence end date within 10 years.');
    function include(n){
      if(n<=first||n>last)return;
      if(dates.length>=MAX_OCCURRENCES20)throw Error('Please create no more than 120 occurrences at a time. Choose an earlier end date.');
      dates.push(dateFromNumber20(n));
    }
    if(rule.frequency==='weekly'||rule.frequency==='fortnightly'){
      var step=rule.frequency==='weekly'?7:14;
      for(var n=first+step;n<=last;n+=step)include(n);
    }else if(rule.frequency==='monthly-date'||rule.frequency==='monthly-weekday'){
      var original=new Date(first*86400000),year=original.getUTCFullYear(),month=original.getUTCMonth()+1,day=original.getUTCDate();
      for(var i=0;i<=120;i++){
        var y=year+Math.floor((month-1+i)/12),m=(month-1+i)%12+1;
        if(dayNumber20(y+'-'+String(m).padStart(2,'0')+'-01')>last)break;
        var target=rule.frequency==='monthly-date'?Math.min(day,daysInMonth20(y,m)):nthWeekday20(y,m,Number(rule.weekday),rule.ordinal);
        if(target!==null)include(dayNumber20(y+'-'+String(m).padStart(2,'0')+'-'+String(target).padStart(2,'0')));
      }
    }else throw Error('Choose a recurrence frequency.');
    return dates;
  }
  function root20(job){
    if(!job)return null;
    return job.recurrenceRootJobId?jobById(job.recurrenceRootJobId)||job:job;
  }
  function sourceDays20(job){
    if(Array.isArray(job.workDays))return job.workDays;
    if(typeof job.workDays==='string'){try{var x=JSON.parse(job.workDays);return Array.isArray(x)?x:[]}catch(e){}}
    return [];
  }
  function cloneOccurrence20(source,date,seriesId,rootId){
    var delta=dayNumber20(date)-dayNumber20(source.startDate);
    var job={id:uid('job'),createdAt:new Date().toISOString(),status:source.status==='Quote'?'Quote':'Booked'};
    JOB_FIELDS20.forEach(function(k){if(source[k]!==undefined)job[k]=source[k]});
    job.reference=chipInNextJobReference();
    job.startDate=date;
    job.endDate=shiftDate20(source.endDate||source.startDate,delta)||date;
    job.workDays=sourceDays20(source).map(function(day){
      return Object.assign({},day,{
        id:uid('workday'),
        date:day.date?shiftDate20(day.date,delta):'',
        breaks:(Array.isArray(day.breaks)?day.breaks:[]).map(function(b){return Object.assign({},b,{id:uid('break')})})
      });
    });
    job.recurrenceSeriesId=seriesId;
    job.recurrenceRootJobId=rootId;
    job.recurrencePlannedDate=date;
    job.amount=job.rateType?chipInJobAmount(job):Number(source.amount||0);
    return job;
  }
  function matchingDate20(job,source,date,seriesId){
    if(job.recurrenceSeriesId===seriesId&&job.recurrencePlannedDate===date)return 'series';
    if(job.id===source.id)return false;
    // Do not silently make another copy of an existing independently booked job.
    if(job.startDate===date&&job.clientId===source.clientId&&String(job.title||'').trim().toLowerCase()===String(source.title||'').trim().toLowerCase()&&job.category===source.category)return 'existing';
    return false;
  }
  function plan20(job,rule){
    var root=root20(job),anchor=root.recurrencePlannedDate||root.startDate;
    var from=job.recurrencePlannedDate||job.startDate,seriesId=root.recurrenceSeriesId||'';
    var dates=ruleDates20(anchor,rule).filter(function(d){return d>from});
    return dates.map(function(date){
      var existing=(state.jobs||[]).find(function(j){return matchingDate20(j,job,date,seriesId)});
      return {date:date,existing:existing||null};
    });
  }
  function label20(date){
    var d=new Date(dayNumber20(date)*86400000);
    var text=d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
    return text+(date.slice(5)==='12-25'?' (Christmas Day)':'');
  }
  function selected20(value,label,current){
    return '<option value="'+esc(value)+'"'+(String(value)===String(current)?' selected':'')+'>'+esc(label)+'</option>';
  }
  function controls20(rule){
    return '<div class="form-grid recurrence-grid20">'+
      '<div class="field"><label>Repeat</label><select data-rec20="frequency">'+
        selected20('weekly','Every week',rule.frequency)+
        selected20('fortnightly','Every 2 weeks',rule.frequency)+
        selected20('monthly-date','Every month (same date)',rule.frequency)+
        selected20('monthly-weekday','Every month (e.g. last Friday)',rule.frequency)+
      '</select></div>'+
      '<div class="field"><label>Repeat until (inclusive)</label><input type="date" data-rec20="until" value="'+esc(rule.until)+'" required></div>'+
      '<div class="field recurrence-monthly20"><label>Which week?</label><select data-rec20="ordinal">'+
        selected20('1','First',rule.ordinal)+selected20('2','Second',rule.ordinal)+
        selected20('3','Third',rule.ordinal)+selected20('4','Fourth',rule.ordinal)+
        selected20('last','Last',rule.ordinal)+
      '</select></div>'+
      '<div class="field recurrence-monthly20"><label>Day of week</label><select data-rec20="weekday">'+
        ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(function(day,i){return selected20(i,day,rule.weekday)}).join('')+
      '</select></div>'+
      '<div class="field full"><div class="hint-box">Each occurrence becomes a separate booked job with its own reference. You can move, edit or cancel any individual date later without changing the others.</div></div>'+
    '</div>';
  }
  function readRule20(form){
    return {
      frequency:$('[data-rec20="frequency"]',form).value,
      until:$('[data-rec20="until"]',form).value,
      ordinal:$('[data-rec20="ordinal"]',form).value,
      weekday:Number($('[data-rec20="weekday"]',form).value)
    };
  }
  function preview20(form,source){
    var type=$('[data-rec20="frequency"]',form).value;
    $$('.recurrence-monthly20',form).forEach(function(el){el.style.display=type==='monthly-weekday'?'flex':'none'});
    var out=$('[data-rec20="preview"]',form);
    try{
      var list=plan20(source,readRule20(form));
      var newDates=list.filter(function(item){return !item.existing});
      var known=list.filter(function(item){return item.existing});
      var rows=list.slice(0,12).map(function(x){
        var extra=x.existing?' — already booked, will not duplicate':'';
        return '<div>'+esc(label20(x.date)+extra)+'</div>';
      }).join('');
      out.innerHTML='<strong>'+newDates.length+' new job'+(newDates.length===1?'':'s')+' to create</strong>'+
        (known.length?' · '+known.length+' already booked':'')+
        (rows?'<div style="margin-top:8px;line-height:1.8">'+rows+'</div>':'<div style="margin-top:8px">No future dates in this range.</div>')+
        (list.length>12?'<div class="muted">… plus '+(list.length-12)+' more dates</div>':'');
      out.dataset.valid='true';
      out.dataset.newCount=String(newDates.length);
    }catch(e){
      out.innerHTML='<span style="color:#b12b2b">'+esc(e.message)+'</span>';
      out.dataset.valid='false';out.dataset.newCount='0';
    }
  }
  function bindControls20(form,getSource){
    function update(){preview20(form,getSource())}
    $$('[data-rec20]',form).forEach(function(el){if(el.dataset.rec20!=='preview'){el.addEventListener('change',update);el.addEventListener('input',update)}});
    update();
    return update;
  }
  async function createOccurrences20(source,rule){
    var entries=plan20(source,rule);
    var proposed=entries.filter(function(x){return !x.existing});
    if(!proposed.length)return 0;
    var root=root20(source);
    var seriesId=root.recurrenceSeriesId||uid('series');
    var originId=root.id;
    root.recurrenceSeriesId=seriesId;
    root.recurrenceRootJobId=originId;
    root.recurrencePlannedDate=root.recurrencePlannedDate||root.startDate;
    root.recurrenceRule=Object.assign({},rule);
    for(var i=0;i<proposed.length;i++)state.jobs.push(cloneOccurrence20(source,proposed[i].date,seriesId,originId));
    await saveState();
    return proposed.length;
  }
  function openRepeat20(id){
    var job=jobById(id);
    if(!job){toast('That job could not be found.');return}
    var root=root20(job),rule=defaultRule20(root);
    openModal('<h2>Make recurring jobs</h2>'+
      '<p class="sub">'+esc(job.title||'Job')+' — choose a pattern and review the dates before creating them.</p>'+
      '<form id="recurrenceForm20">'+controls20(rule)+
      '<div class="card" style="margin-top:14px"><div data-rec20="preview" aria-live="polite"></div></div>'+
      '<div class="form-actions"><button type="button" class="btn secondary" data-close-modal>Cancel</button>'+
      '<button type="submit" class="btn">Create recurring jobs</button></div></form>',true);
    var form=$('#recurrenceForm20');
    bindControls20(form,function(){return job});
    form.onsubmit=async function(e){
      e.preventDefault();
      var preview=$('[data-rec20="preview"]',form);
      if(preview.dataset.valid!=='true'){toast('Fix the recurrence dates first.');return}
      if(Number(preview.dataset.newCount)<1){toast('No new dates to add.');return}
      var submit=$('button[type="submit"]',form);
      submit.disabled=true;
      try{
        var added=await createOccurrences20(job,readRule20(form));
        closeModal();render();toast(added+' recurring job'+(added===1?'':'s')+' created');
      }catch(err){submit.disabled=false;toast('Unable to create recurring jobs: '+err.message)}
    };
  }

  // Jobs can be scheduled when first entered, as well as from any existing job.
  var baseJobForm20=jobForm;
  jobForm=function(j){
    var html=baseJobForm20(j);
    if(j&&j.id)return html;
    var rule=defaultRule20(j||{});
    var block='<div class="field full" id="jobRecurrence20" style="margin-top:12px">'+
      '<label style="display:flex;align-items:center;gap:10px"><input type="checkbox" data-rec20="enabled" style="width:auto"> Repeat this job</label>'+
      '<div id="jobRecurrenceDetails20" style="display:none;margin-top:12px">'+controls20(rule)+
      '<div class="hint-box" data-rec20="preview" aria-live="polite" style="margin-top:12px"></div></div></div>';
    return html.replace('<div class="form-actions">',block+'<div class="form-actions">');
  };

  var baseOpenJobForm20=openJobForm;
  openJobForm=function(id,duplicateFromId){
    baseOpenJobForm20(id,duplicateFromId);
    var form=$('#jobForm'),box=$('#jobRecurrence20',form);
    if(!form||!box)return;
    var enabled=$('[data-rec20="enabled"]',box),details=$('#jobRecurrenceDetails20',box),start=$('[name="startDate"]',form),end=$('[name="endDate"]',form);
    var viewSource=function(){return {startDate:start.value,endDate:end.value}};
    var update=bindControls20(box,viewSource);
    enabled.addEventListener('change',function(){details.style.display=enabled.checked?'block':'none';update()});
    var dayControlsTouched=false;
    $$('[data-rec20="weekday"],[data-rec20="ordinal"]',box).forEach(function(el){el.addEventListener('change',function(){dayControlsTouched=true})});
    start.addEventListener('change',function(){
      if(!dayControlsTouched){
        var r=defaultRule20({startDate:start.value});
        $('[data-rec20="weekday"]',box).value=String(r.weekday);
        $('[data-rec20="ordinal"]',box).value=r.ordinal;
      }
      update();
    });
    end.addEventListener('change',update);
    var baseSubmit=form.onsubmit;
    form.onsubmit=async function(e){
      if(!enabled.checked)return baseSubmit(e);
      var preview=$('[data-rec20="preview"]',box);
      update();
      if(preview.dataset.valid!=='true'||Number(preview.dataset.newCount)<1){
        e.preventDefault();toast('Choose a recurrence that has at least one future date.');return;
      }
      var rule=readRule20(box),countBefore=state.jobs.length;
      await baseSubmit(e);
      // The ordinary job form performs all usual validation and saves the first job.
      if(state.jobs.length===countBefore)return;
      var source=state.jobs[state.jobs.length-1];
      try{
        var added=await createOccurrences20(source,rule);
        toast('Job saved with '+added+' recurring date'+(added===1?'':'s'));
      }catch(err){toast('First job saved, but repeats failed: '+err.message)}
    };
  };

  var baseJobRows20=jobRows;
  jobRows=function(rows){
    return baseJobRows20(rows).replace(/(<button class="btn small secondary" data-action="duplicate-job" data-id="([^"]+)">Duplicate<\/button>)/g,
      function(match,button,id){
        var job=jobById(id);
        var label=job&&job.recurrenceSeriesId?'Repeat / extend':'Repeat';
        return button+'<button class="btn small secondary" data-action="repeat-job" data-id="'+esc(id)+'">'+label+'</button>';
      });
  };
  var baseHandleAction20=handleAction;
  handleAction=async function(action,id){
    if(action==='repeat-job'){openRepeat20(id);return}
    return baseHandleAction20(action,id);
  };
  window.chipInRecurrence20={dates:ruleDates20,shiftDate:shiftDate20};
})();
