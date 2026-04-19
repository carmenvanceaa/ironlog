// ── EXERCISE DATA ────────────────────────────────────────────────────────────
const EXERCISES=[
  {name:"Bench Press",muscle:"Chest"},{name:"Incline Bench Press",muscle:"Chest"},{name:"Decline Bench Press",muscle:"Chest"},
  {name:"Dumbbell Fly",muscle:"Chest"},{name:"Cable Fly",muscle:"Chest"},{name:"Push-Up",muscle:"Chest"},{name:"Dips",muscle:"Chest"},
  {name:"Pec Deck",muscle:"Chest"},{name:"Incline Dumbbell Press",muscle:"Chest"},
  {name:"Pull-Up",muscle:"Back"},{name:"Lat Pulldown",muscle:"Back"},{name:"Barbell Row",muscle:"Back"},
  {name:"Seated Cable Row",muscle:"Back"},{name:"T-Bar Row",muscle:"Back"},{name:"Single-Arm Dumbbell Row",muscle:"Back"},
  {name:"Face Pull",muscle:"Back"},{name:"Deadlift",muscle:"Back"},{name:"Hyperextension",muscle:"Back"},
  {name:"Rack Pull",muscle:"Back"},{name:"Good Morning",muscle:"Back"},
  {name:"Overhead Press",muscle:"Shoulders"},{name:"Dumbbell Shoulder Press",muscle:"Shoulders"},
  {name:"Arnold Press",muscle:"Shoulders"},{name:"Lateral Raise",muscle:"Shoulders"},
  {name:"Front Raise",muscle:"Shoulders"},{name:"Rear Delt Fly",muscle:"Shoulders"},
  {name:"Upright Row",muscle:"Shoulders"},{name:"Cable Lateral Raise",muscle:"Shoulders"},{name:"Shrugs",muscle:"Shoulders"},
  {name:"Barbell Curl",muscle:"Biceps"},{name:"Dumbbell Curl",muscle:"Biceps"},{name:"Hammer Curl",muscle:"Biceps"},
  {name:"Incline Dumbbell Curl",muscle:"Biceps"},{name:"Preacher Curl",muscle:"Biceps"},
  {name:"Cable Curl",muscle:"Biceps"},{name:"Concentration Curl",muscle:"Biceps"},
  {name:"Spider Curl",muscle:"Biceps"},{name:"Reverse Curl",muscle:"Biceps"},
  {name:"Tricep Pushdown",muscle:"Triceps"},{name:"Overhead Tricep Extension",muscle:"Triceps"},
  {name:"Skull Crusher",muscle:"Triceps"},{name:"Close-Grip Bench Press",muscle:"Triceps"},
  {name:"Tricep Kickback",muscle:"Triceps"},{name:"Diamond Push-Up",muscle:"Triceps"},
  {name:"Cable Overhead Extension",muscle:"Triceps"},
  {name:"Squat",muscle:"Quads"},{name:"Leg Press",muscle:"Quads"},{name:"Hack Squat",muscle:"Quads"},
  {name:"Leg Extension",muscle:"Quads"},{name:"Lunges",muscle:"Quads"},{name:"Bulgarian Split Squat",muscle:"Quads"},
  {name:"Front Squat",muscle:"Quads"},{name:"Step-Up",muscle:"Quads"},
  {name:"Romanian Deadlift",muscle:"Hamstrings"},{name:"Leg Curl",muscle:"Hamstrings"},
  {name:"Stiff-Leg Deadlift",muscle:"Hamstrings"},{name:"Nordic Curl",muscle:"Hamstrings"},{name:"Glute-Ham Raise",muscle:"Hamstrings"},
  {name:"Hip Thrust",muscle:"Glutes"},{name:"Glute Bridge",muscle:"Glutes"},{name:"Cable Kickback",muscle:"Glutes"},
  {name:"Sumo Deadlift",muscle:"Glutes"},{name:"Goblet Squat",muscle:"Glutes"},
  {name:"Standing Calf Raise",muscle:"Calves"},{name:"Seated Calf Raise",muscle:"Calves"},{name:"Leg Press Calf Raise",muscle:"Calves"},
  {name:"Plank",muscle:"Core"},{name:"Ab Crunch",muscle:"Core"},{name:"Leg Raise",muscle:"Core"},
  {name:"Cable Crunch",muscle:"Core"},{name:"Russian Twist",muscle:"Core"},{name:"Dead Bug",muscle:"Core"},
  {name:"Hanging Leg Raise",muscle:"Core"},{name:"Ab Rollout",muscle:"Core"},
  {name:"Wrist Curl",muscle:"Forearms"},{name:"Reverse Wrist Curl",muscle:"Forearms"},{name:"Farmers Walk",muscle:"Forearms"},
];
const MUSCLES=["All",...[...new Set(EXERCISES.map(e=>e.muscle))]];
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ── STATE ────────────────────────────────────────────────────────────────────
let state={
  currentExercises:[],history:[],customExercises:[],templates:[],
  editingId:null,
  bodyWeight:[],   // [{date, value, unit}]
  weightUnit:'kg',
  schedule:{},     // {0:'Template Name', 1:null, ...} — 0=Monday
  prs:{}           // {exerciseName: {weight, reps, volume, date}}
};
let timerInterval=null,timerSeconds=60,timerRunning=false,selectedMuscle="All";
let recognition=null,isListening=false,pendingChanges=null;
let deferredInstallPrompt=null;
let weightChart=null,strengthChart=null,volumeChart=null;

// ── STORAGE ──────────────────────────────────────────────────────────────────
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem('ironlog')||'{}');
    state.history=s.history||[];
    state.customExercises=s.customExercises||[];
    state.templates=s.templates||[];
    state.bodyWeight=s.bodyWeight||[];
    state.weightUnit=s.weightUnit||'kg';
    state.schedule=s.schedule||{};
    state.prs=s.prs||{};
  }catch(e){}
}
function saveState(){
  try{
    localStorage.setItem('ironlog',JSON.stringify({
      history:state.history,customExercises:state.customExercises,
      templates:state.templates,bodyWeight:state.bodyWeight,
      weightUnit:state.weightUnit,schedule:state.schedule,prs:state.prs
    }));
  }catch(e){}
}
function allExercises(){return[...EXERCISES,...state.customExercises];}
function getPrevValues(name){
  for(let w of state.history){
    const ex=w.exercises.find(e=>e.name===name);
    if(ex&&ex.sets&&ex.sets.length)return ex.sets;
  }return[];
}

// ── PR DETECTION ─────────────────────────────────────────────────────────────
function checkPRs(workout){
  const newPRs=[];
  workout.exercises.forEach(ex=>{
    const maxWeight=Math.max(...ex.sets.map(s=>parseFloat(s.weight)||0));
    const maxReps=Math.max(...ex.sets.map(s=>parseInt(s.reps)||0));
    const volume=ex.sets.reduce((sum,s)=>sum+(parseFloat(s.weight)||0)*(parseInt(s.reps)||0),0);
    const prev=state.prs[ex.name]||{weight:0,reps:0,volume:0};
    let isPR=false;
    const updated={...prev,date:workout.date};
    if(maxWeight>prev.weight){updated.weight=maxWeight;isPR=true;}
    if(maxReps>prev.reps){updated.reps=maxReps;isPR=true;}
    if(volume>prev.volume){updated.volume=Math.round(volume);isPR=true;}
    if(isPR){
      state.prs[ex.name]=updated;
      newPRs.push({name:ex.name,weight:maxWeight,reps:maxReps});
    }
  });
  return newPRs;
}

function showPRFlash(prs){
  if(!prs.length)return;
  const el=document.getElementById('pr-flash');
  const sub=document.getElementById('pr-flash-sub');
  const pr=prs[0];
  sub.textContent=`${pr.name}: ${pr.weight}kg × ${pr.reps} reps`;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3000);
}

// ── STREAK ───────────────────────────────────────────────────────────────────
function calcStreak(){
  if(!state.history.length)return 0;
  const dates=[...new Set(state.history.map(w=>w.date.slice(0,10)))].sort().reverse();
  const today=new Date().toISOString().slice(0,10);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  if(dates[0]!==today&&dates[0]!==yesterday)return 0;
  let streak=1,prev=dates[0];
  for(let i=1;i<dates.length;i++){
    const diff=(new Date(prev)-new Date(dates[i]))/86400000;
    if(diff===1){streak++;prev=dates[i];}
    else break;
  }
  return streak;
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDashboard(){
  // Streak
  const streak=calcStreak();
  document.getElementById('streak-badge').textContent=`🔥 ${streak}`;

  // Stats
  document.getElementById('stat-total').textContent=state.history.length;
  const now=new Date();
  const thisMonth=state.history.filter(w=>new Date(w.date).getMonth()===now.getMonth()&&new Date(w.date).getFullYear()===now.getFullYear()).length;
  document.getElementById('stat-month').textContent=thisMonth;

  const totalVol=state.history.reduce((sum,w)=>sum+w.exercises.reduce((s,ex)=>s+ex.sets.reduce((ss,set)=>ss+(parseFloat(set.weight)||0)*(parseInt(set.reps)||0),0),0),0);
  document.getElementById('stat-volume').textContent=(totalVol/1000).toFixed(1);

  // Body weight
  if(state.bodyWeight.length){
    const latest=state.bodyWeight[0];
    document.getElementById('stat-weight').textContent=latest.value+latest.unit;
    if(state.bodyWeight.length>1){
      const delta=(latest.value-state.bodyWeight[1].value).toFixed(1);
      const el=document.getElementById('stat-weight-delta');
      el.textContent=(delta>0?'+':'')+delta+latest.unit+' vs last';
      el.style.color=delta<=0?'var(--success)':'var(--danger)';
    }
  }

  // Week grid
  const weekEl=document.getElementById('week-grid');
  const todayIdx=(new Date().getDay()+6)%7; // 0=Mon
  const weekStart=new Date();weekStart.setDate(weekStart.getDate()-todayIdx);weekStart.setHours(0,0,0,0);
  weekEl.innerHTML='';
  DAYS.forEach((day,i)=>{
    const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);
    const dateStr=d.toISOString().slice(0,10);
    const done=state.history.some(w=>w.date.slice(0,10)===dateStr);
    const isToday=i===todayIdx;
    const div=document.createElement('div');
    div.className='week-day'+(done?' done':'')+(isToday?' today':'');
    div.innerHTML=`<div class="week-day-name">${day.slice(0,1)}</div><div class="week-day-dot"></div>`;
    weekEl.appendChild(div);
  });

  // Today's workout from schedule
  const todaySchedule=state.schedule[todayIdx];
  const todayNameEl=document.getElementById('today-workout-name');
  const todayMusclesEl=document.getElementById('today-workout-muscles');
  const todayGoBtn=document.getElementById('today-go-btn');
  if(todaySchedule){
    const tpl=state.templates.find(t=>t.name===todaySchedule);
    todayNameEl.textContent=todaySchedule;
    if(tpl){
      todayMusclesEl.textContent=[...new Set(tpl.exercises.map(e=>e.muscle))].join(' · ');
      todayGoBtn.style.display='block';
    }
  }else{
    todayNameEl.textContent='No workout scheduled';
    todayNameEl.style.color='var(--muted)';
    todayMusclesEl.textContent='Go to Schedule to set up your split';
    todayGoBtn.style.display='none';
  }

  // PRs
  const prEl=document.getElementById('pr-list');
  const prEntries=Object.entries(state.prs).sort((a,b)=>new Date(b[1].date)-new Date(a[1].date));
  if(!prEntries.length){prEl.innerHTML='<div class="empty-state" style="padding:20px">Complete workouts to set PRs</div>';return;}
  prEl.innerHTML=prEntries.slice(0,8).map(([name,pr])=>`
    <div class="pr-item">
      <div><div class="pr-name">${name}</div><div class="pr-date">${new Date(pr.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div></div>
      <div class="pr-value">${pr.weight}kg × ${pr.reps}</div>
    </div>`).join('');
}

function loadTodayWorkout(){
  const todayIdx=(new Date().getDay()+6)%7;
  const name=state.schedule[todayIdx];
  if(!name)return;
  const tpl=state.templates.find(t=>t.name===name);
  if(!tpl)return;
  loadTemplate(tpl.id);
  showTab('log');
}

// ── SCHEDULE ─────────────────────────────────────────────────────────────────
function renderSchedule(){
  const todayIdx=(new Date().getDay()+6)%7;
  const grid=document.getElementById('schedule-grid');
  grid.innerHTML='';
  DAYS.forEach((day,i)=>{
    const assigned=state.schedule[i];
    const isToday=i===todayIdx;
    const row=document.createElement('div');
    row.className='schedule-day'+(isToday?' today-highlight':'');
    const tpl=assigned?state.templates.find(t=>t.name===assigned):null;
    const muscles=tpl?[...new Set(tpl.exercises.map(e=>e.muscle))].join(', '):'';
    row.innerHTML=`
      <div class="schedule-day-name">${day.slice(0,3).toUpperCase()}</div>
      <div class="schedule-day-content">
        ${assigned?`<div class="schedule-day-workout">${assigned}</div><div class="schedule-day-muscles">${muscles}</div>`:'<div class="schedule-day-rest">Rest day</div>'}
      </div>
      <button class="schedule-assign-btn${assigned?' assigned':''}" onclick="assignDay(${i})">${assigned?'Change':'Assign'}</button>`;
    grid.appendChild(row);
  });
}

function assignDay(dayIdx){
  const options=['Rest day',...state.templates.map(t=>t.name)];
  const current=state.schedule[dayIdx]||'Rest day';
  const idx=options.indexOf(current);
  const next=options[(idx+1)%options.length];
  if(next==='Rest day')delete state.schedule[dayIdx];
  else state.schedule[dayIdx]=next;
  saveState();renderSchedule();renderDashboard();
  showNotification(DAYS[dayIdx]+': '+(state.schedule[dayIdx]||'Rest day'));
}

// ── BODY WEIGHT ───────────────────────────────────────────────────────────────
function toggleWeightUnit(){
  state.weightUnit=state.weightUnit==='kg'?'lbs':'kg';
  document.getElementById('weight-unit-btn').textContent=state.weightUnit;
  saveState();renderWeightHistory();renderWeightChart();
}

function logWeight(){
  const val=parseFloat(document.getElementById('weight-input').value);
  if(!val||val<20||val>400){showNotification('Enter a valid weight');return;}
  state.bodyWeight.unshift({date:new Date().toISOString(),value:val,unit:state.weightUnit});
  document.getElementById('weight-input').value='';
  saveState();renderWeightHistory();renderWeightChart();renderDashboard();
  showNotification('Weight logged!');
}

function renderWeightHistory(){
  const el=document.getElementById('weight-history-list');
  if(!state.bodyWeight.length){el.innerHTML='<div class="empty-state" style="padding:20px">No weight logged yet</div>';return;}
  el.innerHTML=state.bodyWeight.slice(0,20).map((w,i)=>{
    const prev=state.bodyWeight[i+1];
    const delta=prev?((w.value-prev.value).toFixed(1)):null;
    const deltaHtml=delta!=null?`<span class="weight-entry-delta ${parseFloat(delta)<=0?'down':'up'}">${parseFloat(delta)>0?'+':''}${delta}${w.unit}</span>`:'';
    return`<div class="weight-entry">
      <div class="weight-entry-date">${new Date(w.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div>
      <div class="weight-entry-val">${w.value} ${w.unit}</div>
      ${deltaHtml}
      <button class="del-weight-btn" onclick="deleteWeight(${i})">✕</button>
    </div>`;
  }).join('');
}

function deleteWeight(i){
  state.bodyWeight.splice(i,1);saveState();renderWeightHistory();renderWeightChart();renderDashboard();
}

// ── CHARTS ────────────────────────────────────────────────────────────────────
const CHART_DEFAULTS={
  responsive:true,maintainAspectRatio:false,
  plugins:{legend:{display:false},tooltip:{backgroundColor:'#1a1a1a',borderColor:'#333',borderWidth:1,titleColor:'#e8ff47',bodyColor:'#f0f0f0',padding:10}},
  scales:{
    x:{grid:{color:'#222'},ticks:{color:'#888',font:{size:10},maxTicksLimit:6}},
    y:{grid:{color:'#222'},ticks:{color:'#888',font:{size:10}}}
  }
};

function renderWeightChart(){
  const ctx=document.getElementById('weight-chart').getContext('2d');
  const data=[...state.bodyWeight].reverse();
  if(weightChart)weightChart.destroy();
  if(!data.length)return;
  weightChart=new Chart(ctx,{
    type:'line',
    data:{
      labels:data.map(w=>new Date(w.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})),
      datasets:[{
        data:data.map(w=>w.value),
        borderColor:'#e8ff47',backgroundColor:'rgba(232,255,71,0.08)',
        borderWidth:2,pointRadius:3,pointBackgroundColor:'#e8ff47',tension:0.3,fill:true
      }]
    },
    options:{...CHART_DEFAULTS,plugins:{...CHART_DEFAULTS.plugins},scales:{...CHART_DEFAULTS.scales,y:{...CHART_DEFAULTS.scales.y,ticks:{...CHART_DEFAULTS.scales.y.ticks,callback:v=>v+(state.weightUnit)}}}}
  });
}

function populateStrengthSelects(){
  const exercisesWithHistory=[...new Set(state.history.flatMap(w=>w.exercises.map(e=>e.name)))].sort();
  ['strength-exercise-select','volume-exercise-select'].forEach(id=>{
    const sel=document.getElementById(id);
    const cur=sel.value;
    sel.innerHTML='<option value="">Select exercise</option>';
    exercisesWithHistory.forEach(name=>{
      const o=document.createElement('option');o.value=name;o.textContent=name;sel.appendChild(o);
    });
    if(cur)sel.value=cur;
  });
}

function renderStrengthChart(){
  const name=document.getElementById('strength-exercise-select').value;
  const ctx=document.getElementById('strength-chart').getContext('2d');
  if(strengthChart)strengthChart.destroy();
  if(!name)return;
  const points=state.history.filter(w=>w.exercises.find(e=>e.name===name))
    .map(w=>{
      const ex=w.exercises.find(e=>e.name===name);
      const max=Math.max(...ex.sets.map(s=>parseFloat(s.weight)||0));
      return{date:w.date,value:max};
    }).reverse();
  strengthChart=new Chart(ctx,{
    type:'line',
    data:{
      labels:points.map(p=>new Date(p.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})),
      datasets:[{data:points.map(p=>p.value),borderColor:'#4fffb0',backgroundColor:'rgba(79,255,176,0.08)',borderWidth:2,pointRadius:3,pointBackgroundColor:'#4fffb0',tension:0.3,fill:true}]
    },
    options:{...CHART_DEFAULTS,scales:{...CHART_DEFAULTS.scales,y:{...CHART_DEFAULTS.scales.y,ticks:{...CHART_DEFAULTS.scales.y.ticks,callback:v=>v+'kg'}}}}
  });
}

function renderVolumeChart(){
  const name=document.getElementById('volume-exercise-select').value;
  const ctx=document.getElementById('volume-chart').getContext('2d');
  if(volumeChart)volumeChart.destroy();
  if(!name)return;
  const points=state.history.filter(w=>w.exercises.find(e=>e.name===name))
    .map(w=>{
      const ex=w.exercises.find(e=>e.name===name);
      const vol=ex.sets.reduce((s,set)=>s+(parseFloat(set.weight)||0)*(parseInt(set.reps)||0),0);
      return{date:w.date,value:Math.round(vol)};
    }).reverse();
  volumeChart=new Chart(ctx,{
    type:'bar',
    data:{
      labels:points.map(p=>new Date(p.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})),
      datasets:[{data:points.map(p=>p.value),backgroundColor:'rgba(71,180,255,0.5)',borderColor:'#47b4ff',borderWidth:1,borderRadius:4}]
    },
    options:{...CHART_DEFAULTS,scales:{...CHART_DEFAULTS.scales,y:{...CHART_DEFAULTS.scales.y,ticks:{...CHART_DEFAULTS.scales.y.ticks,callback:v=>v+'kg'}}}}
  });
}

// ── VOICE INTERPRETER ────────────────────────────────────────────────────────
function fuzzyMatch(input,target){
  const a=input.toLowerCase().replace(/[^a-z0-9 ]/g,'');
  const b=target.toLowerCase().replace(/[^a-z0-9 ]/g,'');
  if(b.includes(a)||a.includes(b))return true;
  const wa=a.split(' '),wb=b.split(' ');
  let hits=0;wa.forEach(w=>{if(w.length>2&&wb.some(t=>t.includes(w)||w.includes(t)))hits++;});
  return hits>=Math.min(wa.length,wb.length)*0.6;
}
function findExercise(text){const all=allExercises();return all.find(e=>text.toLowerCase().includes(e.name.toLowerCase()))||all.find(e=>fuzzyMatch(text,e.name))||null;}
function findTemplate(text){const t=text.toLowerCase();return state.templates.find(tpl=>t.includes(tpl.name.toLowerCase())||fuzzyMatch(t,tpl.name))||null;}
function resolveSetIndex(text,setsLen){
  const t=text.toLowerCase();
  if(/\blast\b|\bfinal\b/.test(t))return setsLen-1;
  if(/\bfirst\b/.test(t))return 0;if(/\bsecond\b/.test(t))return 1;if(/\bthird\b/.test(t))return 2;
  if(/\ball\b|\bevery\b/.test(t))return'all';
  const m=t.match(/set\s*(\d+)/);if(m)return parseInt(m[1])-1;
  return'all';
}

function interpret(text){
  const t=text.toLowerCase().trim();
  const actions=[],unmatched=[];
  if(/\b(load|start|use|do|using|doing|begin|open)\b/.test(t)){const tpl=findTemplate(t);if(tpl)actions.push({type:'load_template',templateName:tpl.name});}
  if(/\b(remove|delete|drop|skip|take out)\b/.test(t)){const ex=findExercise(t);if(ex)actions.push({type:'remove_exercise',exerciseName:ex.name});}
  if(/\b(add|include|also|plus)\b/.test(t)&&!/\badd\s+(more|extra|\d)/.test(t)){
    const ex=findExercise(t);
    if(ex&&!state.currentExercises.find(e=>e.name===ex.name)){
      if(!/(\d+\s*kg|\d+\s*rep|\d+\s*more|more weight|more reps|less|fewer|heavier|lighter)/.test(t))
        actions.push({type:'add_exercise',exerciseName:ex.name,muscle:ex.muscle});
    }
  }
  const ex=findExercise(t);
  if(ex){
    const currentEx=state.currentExercises.find(e=>e.name===ex.name);
    const setIdx=resolveSetIndex(t,currentEx?currentEx.sets.length:1);
    const setsToChange=setIdx==='all'?(currentEx?currentEx.sets.map((_,i)=>i):[0]):[setIdx];
    let wChange=null,rChange=null;
    if(/(\d+\.?\d*)\s*(?:kg|kilo)?\s*(?:more|extra|heavier|\+)/.test(t)){const m=t.match(/(\d+\.?\d*)\s*(?:kg|kilo)?\s*(?:more|extra|heavier|\+)/);wChange={delta:+parseFloat(m[1])};}
    else if(/(?:add|plus|\+)\s*(\d+\.?\d*)\s*(?:kg|kilo)/.test(t)){const m=t.match(/(?:add|plus|\+)\s*(\d+\.?\d*)\s*(?:kg|kilo)/);wChange={delta:+parseFloat(m[1])};}
    else if(/(\d+\.?\d*)\s*(?:kg|kilo)?\s*(?:less|lighter|-)/.test(t)){const m=t.match(/(\d+\.?\d*)\s*(?:kg|kilo)?\s*(?:less|lighter|-)/);wChange={delta:-parseFloat(m[1])};}
    else if(/(?:set|at|to|use|do|lift)\s+(\d+\.?\d*)\s*(?:kg|kilo)/.test(t)){const m=t.match(/(?:set|at|to|use|do|lift)\s+(\d+\.?\d*)\s*(?:kg|kilo)/);wChange={absolute:parseFloat(m[1])};}
    else if(/(\d+\.?\d*)\s*(?:kg|kilo)/.test(t)){const m=t.match(/(\d+\.?\d*)\s*(?:kg|kilo)/);wChange={absolute:parseFloat(m[1])};}
    if(/(\d+)\s*(?:more|extra|additional)\s*rep/.test(t)){const m=t.match(/(\d+)\s*(?:more|extra|additional)\s*rep/);rChange={delta:+parseInt(m[1])};}
    else if(/(\d+)\s*(?:less|fewer)\s*rep/.test(t)){const m=t.match(/(\d+)\s*(?:less|fewer)\s*rep/);rChange={delta:-parseInt(m[1])};}
    else if(/(\d+)\s*rep/.test(t)){const m=t.match(/(\d+)\s*rep/);rChange={absolute:parseInt(m[1])};}
    if(wChange||rChange){
      setsToChange.forEach(si=>{
        const prev=getPrevValues(ex.name);
        if(wChange){
          let oldVal=null;
          if(currentEx&&currentEx.sets[si])oldVal=parseFloat(currentEx.sets[si].weight)||null;
          if(oldVal===null&&prev[si])oldVal=parseFloat(prev[si].weight)||null;
          const newVal=wChange.absolute!=null?wChange.absolute:(oldVal!=null?oldVal+wChange.delta:wChange.delta);
          actions.push({type:'modify_set',exerciseName:ex.name,setIndex:si,field:'weight',oldValue:oldVal,newValue:Math.round(newVal*2)/2});
        }
        if(rChange){
          let oldVal=null;
          if(currentEx&&currentEx.sets[si])oldVal=parseInt(currentEx.sets[si].reps)||null;
          if(oldVal===null&&prev[si])oldVal=parseInt(prev[si].reps)||null;
          const newVal=rChange.absolute!=null?rChange.absolute:(oldVal!=null?oldVal+rChange.delta:rChange.delta);
          actions.push({type:'modify_set',exerciseName:ex.name,setIndex:si,field:'reps',oldValue:oldVal,newValue:Math.max(1,newVal)});
        }
      });
    }else if(!actions.find(a=>a.exerciseName===ex.name)&&actions.length===0){
      unmatched.push(`Found "${ex.name}" but couldn't determine what to change`);
    }
  }
  const parts=actions.map(a=>{
    if(a.type==='load_template')return`Load "${a.templateName}"`;
    if(a.type==='add_exercise')return`Add ${a.exerciseName}`;
    if(a.type==='remove_exercise')return`Remove ${a.exerciseName}`;
    if(a.type==='modify_set'){const u=a.field==='weight'?'kg':'';const d=a.oldValue!=null&&a.newValue>a.oldValue?'↑':a.oldValue!=null&&a.newValue<a.oldValue?'↓':'→';return`${a.exerciseName} set ${a.setIndex+1} ${a.field} ${d} ${a.newValue}${u}`;}
    return'';
  });
  return{actions,understood:parts.join(', '),unmatched};
}

function submitVoiceLog(){
  const tb=document.getElementById('transcript-box');
  const textInput=document.getElementById('voice-text-input').value.trim();
  const userText=textInput||(!tb.classList.contains('empty')?tb.textContent.trim():'');
  if(!userText){showNotification('Nothing to interpret');return;}
  renderReview(interpret(userText),userText);
}

function renderReview(result,originalText){
  const rc=document.getElementById('review-container');
  if(!result.actions.length){
    rc.innerHTML=`<div class="review-panel"><div class="review-title">No Changes Found</div><div class="no-match">${result.unmatched.join('. ')||'Try: "load push day", "add 2kg last set bench press"'}</div><div class="review-actions"><button class="review-discard-btn" style="flex:none;padding:8px 20px" onclick="discardChanges()">Dismiss</button></div></div>`;
    return;
  }
  pendingChanges=result;
  const changesHtml=result.actions.map(a=>{
    if(a.type==='load_template')return`<div class="review-change"><div class="review-change-header">📋 Load template</div><div class="review-change-detail">Load "<strong>${a.templateName}</strong>" with previous values</div></div>`;
    if(a.type==='modify_set'){const u=a.field==='weight'?'kg':'';return`<div class="review-change"><div class="review-change-header">${a.exerciseName} — Set ${a.setIndex+1}</div><div class="review-change-detail">${a.field==='weight'?'Weight':'Reps'}: <span style="color:var(--muted)">${a.oldValue!=null?a.oldValue+u:'—'}</span><span class="change-arrow">→</span><span style="color:var(--accent);font-weight:600">${a.newValue}${u}</span></div></div>`;}
    if(a.type==='add_exercise')return`<div class="review-change"><div class="review-change-header">➕ Add exercise</div><div class="review-change-detail"><strong>${a.exerciseName}</strong> (${a.muscle})</div></div>`;
    if(a.type==='remove_exercise')return`<div class="review-change"><div class="review-change-header">➖ Remove exercise</div><div class="review-change-detail"><strong>${a.exerciseName}</strong></div></div>`;
    return'';
  }).join('');
  rc.innerHTML=`<div class="review-panel"><div class="review-title">Review Changes</div><div class="review-understood" style="color:var(--muted);font-size:12px;margin-bottom:4px">You said: "${originalText}"</div><div class="review-understood">${result.understood}</div><div class="review-changes">${changesHtml}</div><div class="review-actions"><button class="review-confirm-btn" onclick="applyChanges()">Apply Changes</button><button class="review-discard-btn" onclick="discardChanges()">Discard</button></div></div>`;
}

function applyChanges(){
  if(!pendingChanges)return;
  pendingChanges.actions.forEach(a=>{
    if(a.type==='load_template'){
      const tpl=state.templates.find(t=>t.name===a.templateName);
      if(tpl){state.currentExercises=[];tpl.exercises.forEach(ex=>{const prev=getPrevValues(ex.name);const sets=[];for(let i=0;i<(ex.defaultSets||1);i++){const ps=prev[i]||null;sets.push({reps:ps?ps.reps:'',weight:ps?ps.weight:''});}state.currentExercises.push({name:ex.name,muscle:ex.muscle,sets});});document.getElementById('workout-name').value=tpl.name;}
    }
    if(a.type==='modify_set'){const ex=state.currentExercises.find(e=>e.name===a.exerciseName);if(ex&&ex.sets[a.setIndex]!==undefined){ex.sets[a.setIndex][a.field]=String(a.newValue);ex.sets[a.setIndex]['_changed'+(a.field==='weight'?'Weight':'Reps')]=true;}}
    if(a.type==='add_exercise'){const ex=allExercises().find(e=>e.name===a.exerciseName);if(ex&&!state.currentExercises.find(e=>e.name===ex.name)){const prev=getPrevValues(ex.name);state.currentExercises.push({name:ex.name,muscle:ex.muscle,sets:prev.length?prev.map(s=>({reps:s.reps,weight:s.weight})):[{reps:'',weight:''}]});}}
    if(a.type==='remove_exercise')state.currentExercises=state.currentExercises.filter(e=>e.name!==a.exerciseName);
  });
  renderSessionExercises(true);
  document.getElementById('review-container').innerHTML='';
  document.getElementById('transcript-box').textContent='Tap mic and speak...';document.getElementById('transcript-box').classList.add('empty');
  document.getElementById('voice-text-input').value='';document.getElementById('voice-submit-btn').disabled=true;
  pendingChanges=null;showNotification('Changes applied!');
}
function discardChanges(){document.getElementById('review-container').innerHTML='';pendingChanges=null;showNotification('Discarded');}

// ── MIC ──────────────────────────────────────────────────────────────────────
function toggleMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){document.getElementById('mic-hint').textContent='Not supported — use text box';return;}
  if(isListening){recognition.stop();return;}
  recognition=new SR();recognition.lang='en-US';recognition.interimResults=true;
  recognition.onstart=()=>{isListening=true;document.getElementById('mic-btn').className='mic-btn recording';document.getElementById('mic-btn').textContent='⏹';document.getElementById('mic-hint').textContent='Listening… tap to stop';const tb=document.getElementById('transcript-box');tb.classList.remove('empty');tb.textContent='…';};
  recognition.onresult=e=>{let interim='',final='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final+=e.results[i][0].transcript;else interim+=e.results[i][0].transcript;}document.getElementById('transcript-box').textContent=final||interim;if(final)updateSubmitBtn();};
  recognition.onend=()=>{isListening=false;document.getElementById('mic-btn').className='mic-btn';document.getElementById('mic-btn').textContent='🎙';document.getElementById('mic-hint').textContent='Tap to speak again';updateSubmitBtn();};
  recognition.onerror=e=>{isListening=false;document.getElementById('mic-btn').className='mic-btn';document.getElementById('mic-btn').textContent='🎙';document.getElementById('mic-hint').textContent=e.error==='not-allowed'?'Mic denied — use text box':'Error — try again';};
  recognition.start();
}
function updateSubmitBtn(){
  const tb=document.getElementById('transcript-box');
  const hasT=!tb.classList.contains('empty')&&tb.textContent.trim()&&tb.textContent!=='…';
  document.getElementById('voice-submit-btn').disabled=!(hasT||document.getElementById('voice-text-input').value.trim().length>0);
}

// ── EXERCISE LIBRARY ──────────────────────────────────────────────────────────
function initMuscleFilter(){
  const c=document.getElementById('muscle-tabs'),s=document.getElementById('custom-muscle');
  c.innerHTML='';
  MUSCLES.forEach(m=>{const b=document.createElement('button');b.className='muscle-tab'+(m===selectedMuscle?' active':'');b.textContent=m;b.onclick=()=>{selectedMuscle=m;initMuscleFilter();renderExerciseList();};c.appendChild(b);});
  s.innerHTML='<option value="">Muscle</option>';
  [...new Set(allExercises().map(e=>e.muscle))].sort().forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;s.appendChild(o);});
  const co=document.createElement('option');co.value="Custom";co.textContent="Custom";s.appendChild(co);
}
function renderExerciseList(){
  const q=document.getElementById('exercise-search').value.toLowerCase();
  const c=document.getElementById('exercise-list');c.innerHTML='';
  allExercises().filter(e=>(selectedMuscle==="All"||e.muscle===selectedMuscle)&&(!q||e.name.toLowerCase().includes(q)||e.muscle.toLowerCase().includes(q))).forEach(ex=>{
    const d=document.createElement('div');d.className='exercise-option';
    const prev=getPrevValues(ex.name);
    const hint=prev.length?`<span style="font-size:10px;color:var(--accent);margin-left:4px">prev</span>`:'';
    d.innerHTML=`<div><div class="ex-name">${ex.name}${hint}</div><div class="ex-muscle">${ex.muscle}</div></div><span style="color:var(--accent);font-size:20px">+</span>`;
    d.onclick=()=>addExerciseToSession(ex);c.appendChild(d);
  });
}
function addExerciseToSession(ex){
  if(state.currentExercises.find(e=>e.name===ex.name)){showNotification('Already in session!');return;}
  const prev=getPrevValues(ex.name);
  state.currentExercises.push({name:ex.name,muscle:ex.muscle,sets:prev.length?prev.map(s=>({reps:s.reps,weight:s.weight})):[{reps:'',weight:''}]});
  renderSessionExercises();showNotification(ex.name+' added');
}
function addCustomExercise(){
  const name=document.getElementById('custom-name').value.trim();
  const muscle=document.getElementById('custom-muscle').value;
  if(!name||!muscle){showNotification('Enter name and muscle group');return;}
  const newEx={name,muscle,custom:true};state.customExercises.push(newEx);saveState();
  document.getElementById('custom-name').value='';initMuscleFilter();renderExerciseList();addExerciseToSession(newEx);
}
function renderSessionExercises(highlightChanges){
  const container=document.getElementById('exercises-list');
  if(!state.currentExercises.length){container.innerHTML='<div class="empty-state"><div style="font-size:32px;margin-bottom:8px">🏋</div><div>Load a template or add exercises</div></div>';return;}
  container.innerHTML='';
  state.currentExercises.forEach((ex,ei)=>{
    const prev=getPrevValues(ex.name);const card=document.createElement('div');card.className='exercise-card';
    let setsHtml='';
    ex.sets.forEach((set,si)=>{
      const ps=prev[si]||null;const pr=ps&&ps.reps?ps.reps:'',pw=ps&&ps.weight?ps.weight:'';
      const cr=highlightChanges&&set._changedReps,cw=highlightChanges&&set._changedWeight;
      setsHtml+=`<tr><td class="set-num">${si+1}</td><td><div class="set-input-wrap"><input class="set-input${cr?' changed':''}" type="number" inputmode="decimal" placeholder="${pr||'—'}" value="${set.reps}" min="0" oninput="updateSet(${ei},${si},'reps',this.value)" style="width:52px"><div class="prev-val${pr?' has-val':''}">${pr||'—'}</div></div></td><td><div class="set-input-wrap"><input class="set-input${cw?' changed':''}" type="number" inputmode="decimal" placeholder="${pw||'—'}" value="${set.weight}" min="0" step="0.5" oninput="updateSet(${ei},${si},'weight',this.value)" style="width:64px"><div class="prev-val${pw?' has-val':''}">${pw?pw+'kg':'—'}</div></div></td><td><button class="del-set-btn" onclick="deleteSet(${ei},${si})">✕</button></td></tr>`;
    });
    const hasPrev=prev.length>0;
    card.innerHTML=`<div class="exercise-card-header"><div><div class="exercise-card-name">${ex.name}</div><div class="exercise-card-muscle">${ex.muscle}${hasPrev?'&nbsp;&nbsp;<span style="font-size:10px;color:var(--accent)">prev shown below</span>':''}</div></div><button class="del-ex-btn" onclick="removeExercise(${ei})">✕</button></div><table class="sets-table"><thead><tr><th>Set</th><th>Reps${hasPrev?'<div style="font-size:9px;color:var(--muted2);font-weight:400">prev</div>':''}</th><th>kg${hasPrev?'<div style="font-size:9px;color:var(--muted2);font-weight:400">prev</div>':''}</th><th></th></tr></thead><tbody>${setsHtml}</tbody></table><div class="add-set-row"><button class="add-set-btn" onclick="addSet(${ei})">+ Add set</button></div>`;
    container.appendChild(card);
  });
}
function updateSet(ei,si,field,val){state.currentExercises[ei].sets[si][field]=val;}
function addSet(ei){const ex=state.currentExercises[ei];const prev=getPrevValues(ex.name);const si=ex.sets.length;const ps=prev[si]||null;ex.sets.push({reps:ps?ps.reps:'',weight:ps?ps.weight:''});renderSessionExercises();}
function deleteSet(ei,si){if(state.currentExercises[ei].sets.length===1){showNotification('At least one set required');return;}state.currentExercises[ei].sets.splice(si,1);renderSessionExercises();}
function removeExercise(ei){state.currentExercises.splice(ei,1);renderSessionExercises();}

// ── SAVE / TEMPLATES / HISTORY ────────────────────────────────────────────────
function saveWorkout(){
  if(!state.currentExercises.length){showNotification('Add at least one exercise');return;}
  const name=document.getElementById('workout-name').value.trim()||'Workout '+new Date().toLocaleDateString();
  const workout={id:state.editingId||Date.now(),name,date:new Date().toISOString(),exercises:JSON.parse(JSON.stringify(state.currentExercises))};
  if(state.editingId){const idx=state.history.findIndex(w=>w.id===state.editingId);if(idx!==-1)state.history[idx]=workout;state.editingId=null;}
  else state.history.unshift(workout);
  const newPRs=checkPRs(workout);
  saveState();
  state.currentExercises=[];document.getElementById('workout-name').value='';
  renderSessionExercises();renderTemplates();
  if(newPRs.length)setTimeout(()=>showPRFlash(newPRs),400);
  showNotification('Workout saved!');
  showTab('history');
}
function saveAsTemplate(){
  if(!state.currentExercises.length){showNotification('Add exercises first');return;}
  const name=document.getElementById('workout-name').value.trim();
  if(!name){showNotification('Give your workout a name first');return;}
  state.templates=state.templates.filter(t=>t.name!==name);
  state.templates.unshift({id:Date.now(),name,exercises:state.currentExercises.map(e=>({name:e.name,muscle:e.muscle,defaultSets:e.sets.length}))});
  saveState();renderTemplates();renderSchedule();showNotification('Template saved: '+name);
}
function loadTemplate(id){
  const tpl=state.templates.find(t=>t.id===id);if(!tpl)return;
  state.currentExercises=[];
  tpl.exercises.forEach(ex=>{const prev=getPrevValues(ex.name);const sets=[];for(let i=0;i<(ex.defaultSets||1);i++){const ps=prev[i]||null;sets.push({reps:ps?ps.reps:'',weight:ps?ps.weight:''});}state.currentExercises.push({name:ex.name,muscle:ex.muscle,sets});});
  document.getElementById('workout-name').value=tpl.name;renderSessionExercises();showNotification('Loaded: '+tpl.name);
}
function deleteTemplate(id){state.templates=state.templates.filter(t=>t.id!==id);saveState();renderTemplates();showNotification('Template deleted');}
function renderTemplates(){
  const section=document.getElementById('templates-section');
  if(!state.templates.length){section.innerHTML='';return;}
  const cards=state.templates.map(t=>`<div class="template-card"><div class="template-info"><div class="template-name">${t.name}</div><div class="template-meta">${t.exercises.length} exercises · ${[...new Set(t.exercises.map(e=>e.muscle))].join(', ')}</div></div><div class="template-actions"><button class="tpl-btn start" onclick="loadTemplate(${t.id})">Load</button><button class="tpl-btn" onclick="deleteTemplate(${t.id})" style="color:var(--danger)">Del</button></div></div>`).join('');
  section.innerHTML=`<div class="section-title">Templates</div><div class="template-cards">${cards}</div><div style="border-top:1px solid var(--border);margin:14px 0"></div>`;
}
function renderHistory(){
  const container=document.getElementById('history-list');
  if(!state.history.length){container.innerHTML='<div class="empty-state"><div style="font-size:32px;margin-bottom:8px">📋</div><div>No workouts saved yet</div></div>';return;}
  container.innerHTML='';
  state.history.forEach(w=>{
    const muscles=[...new Set(w.exercises.map(e=>e.muscle))];
    const dateStr=new Date(w.date).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
    const card=document.createElement('div');card.className='history-card';
    let exDetailsHtml='';
    w.exercises.forEach(ex=>{
      const sh=ex.sets.filter(s=>s.reps||s.weight).map((s,i)=>`<span class="history-set-badge">Set ${i+1}: ${s.reps||'—'} reps${s.weight?' @ '+s.weight+'kg':''}</span>`).join('');
      exDetailsHtml+=`<div class="history-ex-item"><div class="history-ex-name">${ex.name}</div><div class="history-sets-row">${sh||'<span class="history-set-badge" style="color:var(--muted2)">No data</span>'}</div></div>`;
    });
    card.innerHTML=`<div class="history-card-header"><div><div class="history-workout-name">${w.name}</div><div class="history-date">${dateStr}</div></div><div style="font-size:13px;color:var(--muted)">${w.exercises.length} ex</div></div><div class="history-muscles">${muscles.map(m=>`<span class="muscle-tag">${m}</span>`).join('')}</div><div class="history-details">${exDetailsHtml}<div class="history-btns"><button class="edit-workout-btn" onclick="editWorkout(${w.id},event)">Edit</button><button class="del-workout-btn" onclick="deleteWorkout(${w.id},event)">Delete</button></div></div>`;
    card.onclick=()=>card.classList.toggle('expanded');container.appendChild(card);
  });
}
function editWorkout(id,e){e.stopPropagation();const workout=state.history.find(w=>w.id===id);if(!workout)return;state.currentExercises=JSON.parse(JSON.stringify(workout.exercises));document.getElementById('workout-name').value=workout.name;state.editingId=id;showTab('log');renderSessionExercises();showNotification('Editing "'+workout.name+'"');}
function deleteWorkout(id,e){e.stopPropagation();state.history=state.history.filter(w=>w.id!==id);saveState();renderHistory();showNotification('Workout deleted');}

// ── EXPORT / IMPORT ──────────────────────────────────────────────────────────
function exportData(){
  const data={version:2,exportedAt:new Date().toISOString(),history:state.history,templates:state.templates,customExercises:state.customExercises,bodyWeight:state.bodyWeight,schedule:state.schedule,prs:state.prs};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download=`ironlog-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
  showNotification('Backup downloaded!');
}
function importData(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.history)throw new Error('invalid');
        const existingIds=new Set(state.history.map(w=>w.id));
        state.history=[...data.history.filter(w=>!existingIds.has(w.id)),...state.history];
        const existingTplIds=new Set(state.templates.map(t=>t.id));
        state.templates=[...(data.templates||[]).filter(t=>!existingTplIds.has(t.id)),...state.templates];
        const existingCustom=new Set(state.customExercises.map(e=>e.name));
        state.customExercises=[...state.customExercises,...(data.customExercises||[]).filter(e=>!existingCustom.has(e.name))];
        if(data.bodyWeight)state.bodyWeight=[...data.bodyWeight,...state.bodyWeight].sort((a,b)=>new Date(b.date)-new Date(a.date));
        if(data.schedule)Object.assign(state.schedule,data.schedule);
        if(data.prs)Object.assign(state.prs,data.prs);
        saveState();renderTemplates();initMuscleFilter();renderExerciseList();renderDashboard();
        showNotification('Import successful!');
      }catch(err){showNotification('Invalid backup file');}
    };reader.readAsText(file);
  };input.click();
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function showTab(tab){
  ['dashboard','log','progress','schedule','history'].forEach((t,i)=>{
    document.getElementById('tab-'+t).style.display=t===tab?'block':'none';
    document.querySelectorAll('.nav-btn')[i].classList.toggle('active',t===tab);
  });
  if(tab==='dashboard')renderDashboard();
  if(tab==='progress'){populateStrengthSelects();renderWeightHistory();renderWeightChart();renderStrengthChart();renderVolumeChart();}
  if(tab==='schedule')renderSchedule();
  if(tab==='history')renderHistory();
}

// ── TIMER ────────────────────────────────────────────────────────────────────
function toggleTimer(){
  if(timerRunning){clearInterval(timerInterval);timerRunning=false;document.getElementById('timer-start-btn').textContent='Start';document.getElementById('timer-display').className='timer-display';}
  else{if(timerSeconds<=0)resetTimer();timerRunning=true;document.getElementById('timer-start-btn').textContent='Pause';document.getElementById('timer-display').className='timer-display running';timerInterval=setInterval(()=>{timerSeconds--;updateTimerDisplay();if(timerSeconds<=0){clearInterval(timerInterval);timerRunning=false;document.getElementById('timer-start-btn').textContent='Start';document.getElementById('timer-display').className='timer-display done';if(navigator.vibrate)navigator.vibrate([200,100,200]);}},1000);}
}
function resetTimer(){clearInterval(timerInterval);timerRunning=false;timerSeconds=60;updateTimerDisplay();document.getElementById('timer-start-btn').textContent='Start';document.getElementById('timer-display').className='timer-display';}
function updateTimerDisplay(){const m=Math.floor(timerSeconds/60),s=timerSeconds%60;document.getElementById('timer-display').textContent=m+':'+(s<10?'0':'')+s;}

// ── PWA INSTALL ───────────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;document.getElementById('install-banner').style.display='flex';});
function installApp(){if(deferredInstallPrompt){deferredInstallPrompt.prompt();deferredInstallPrompt.userChoice.then(()=>{deferredInstallPrompt=null;dismissInstall();});}}
function dismissInstall(){document.getElementById('install-banner').style.display='none';}
window.addEventListener('appinstalled',()=>{showNotification('IronLog installed! 💪');dismissInstall();});

// ── NOTIFICATION ─────────────────────────────────────────────────────────────
function showNotification(msg){const n=document.getElementById('notification');n.textContent=msg;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),2400);}

// ── INIT ─────────────────────────────────────────────────────────────────────
document.getElementById('voice-text-input').addEventListener('input',updateSubmitBtn);
document.getElementById('weight-unit-btn').textContent=state.weightUnit;

loadState();
document.getElementById('weight-unit-btn').textContent=state.weightUnit;
document.getElementById('today-date').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
initMuscleFilter();renderExerciseList();renderTemplates();renderDashboard();

if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
