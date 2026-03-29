// ── DATA ────────────────────────────────────────────────────────────────────

const EXERCISES = [
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

const MUSCLES = ["All", ...[...new Set(EXERCISES.map(e => e.muscle))]];

let state = { currentExercises: [], history: [], customExercises: [], templates: [], editingId: null };
let timerInterval = null, timerSeconds = 60, timerRunning = false, selectedMuscle = "All";
let recognition = null, isListening = false, pendingChanges = null;
let deferredInstallPrompt = null;

// ── STORAGE ──────────────────────────────────────────────────────────────────

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('ironlog') || '{}');
    state.history = s.history || [];
    state.customExercises = s.customExercises || [];
    state.templates = s.templates || [];
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem('ironlog', JSON.stringify({
      history: state.history,
      customExercises: state.customExercises,
      templates: state.templates
    }));
  } catch(e) {}
}

function allExercises() { return [...EXERCISES, ...state.customExercises]; }

function getPrevValues(name) {
  for (let w of state.history) {
    const ex = w.exercises.find(e => e.name === name);
    if (ex && ex.sets && ex.sets.length) return ex.sets;
  }
  return [];
}

// ── VOICE INTERPRETER ────────────────────────────────────────────────────────

function fuzzyMatch(input, target) {
  const a = input.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const b = target.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (b.includes(a) || a.includes(b)) return true;
  const wa = a.split(' '), wb = b.split(' ');
  let hits = 0;
  wa.forEach(w => { if (w.length > 2 && wb.some(t => t.includes(w) || w.includes(t))) hits++; });
  return hits >= Math.min(wa.length, wb.length) * 0.6;
}

function findExercise(text) {
  const all = allExercises();
  let found = all.find(e => text.toLowerCase().includes(e.name.toLowerCase()));
  if (found) return found;
  return all.find(e => fuzzyMatch(text, e.name)) || null;
}

function findTemplate(text) {
  const t = text.toLowerCase();
  return state.templates.find(tpl => t.includes(tpl.name.toLowerCase()) || fuzzyMatch(t, tpl.name)) || null;
}

function resolveSetIndex(text, setsLen) {
  const t = text.toLowerCase();
  if (/\blast\b|\bfinal\b/.test(t)) return setsLen - 1;
  if (/\bfirst\b/.test(t)) return 0;
  if (/\bsecond\b/.test(t)) return 1;
  if (/\bthird\b/.test(t)) return 2;
  if (/\ball\b|\bevery\b/.test(t)) return 'all';
  const m = t.match(/set\s*(\d+)/);
  if (m) return parseInt(m[1]) - 1;
  return 'all';
}

function interpret(text) {
  const t = text.toLowerCase().trim();
  const actions = [], unmatched = [];

  // Load template
  if (/\b(load|start|use|do|using|doing|begin|open)\b/.test(t)) {
    const tpl = findTemplate(t);
    if (tpl) actions.push({ type: 'load_template', templateName: tpl.name });
  }

  // Remove exercise
  if (/\b(remove|delete|drop|skip|take out)\b/.test(t)) {
    const ex = findExercise(t);
    if (ex) actions.push({ type: 'remove_exercise', exerciseName: ex.name });
  }

  // Add exercise (only if not a weight/rep modification)
  if (/\b(add|include|also|plus)\b/.test(t) && !/\badd\s+(more|extra|\d)/.test(t)) {
    const ex = findExercise(t);
    if (ex && !state.currentExercises.find(e => e.name === ex.name)) {
      const isModification = /(\d+\s*kg|\d+\s*rep|\d+\s*more|more weight|more reps|less|fewer|heavier|lighter)/.test(t);
      if (!isModification) actions.push({ type: 'add_exercise', exerciseName: ex.name, muscle: ex.muscle });
    }
  }

  // Weight / reps modifications
  const ex = findExercise(t);
  if (ex) {
    const currentEx = state.currentExercises.find(e => e.name === ex.name);
    const setIdx = resolveSetIndex(t, currentEx ? currentEx.sets.length : 1);
    const setsToChange = setIdx === 'all' ? (currentEx ? currentEx.sets.map((_, i) => i) : [0]) : [setIdx];

    let wChange = null, rChange = null;

    if (/(\d+\.?\d*)\s*(?:kg|kilo)?\s*(?:more|extra|heavier|\+)/.test(t)) {
      const m = t.match(/(\d+\.?\d*)\s*(?:kg|kilo)?\s*(?:more|extra|heavier|\+)/);
      wChange = { delta: +parseFloat(m[1]) };
    } else if (/(?:add|plus|\+)\s*(\d+\.?\d*)\s*(?:kg|kilo)/.test(t)) {
      const m = t.match(/(?:add|plus|\+)\s*(\d+\.?\d*)\s*(?:kg|kilo)/);
      wChange = { delta: +parseFloat(m[1]) };
    } else if (/(\d+\.?\d*)\s*(?:kg|kilo)?\s*(?:less|lighter|-)/.test(t)) {
      const m = t.match(/(\d+\.?\d*)\s*(?:kg|kilo)?\s*(?:less|lighter|-)/);
      wChange = { delta: -parseFloat(m[1]) };
    } else if (/(?:set|at|to|use|do|lift)\s+(\d+\.?\d*)\s*(?:kg|kilo)/.test(t)) {
      const m = t.match(/(?:set|at|to|use|do|lift)\s+(\d+\.?\d*)\s*(?:kg|kilo)/);
      wChange = { absolute: parseFloat(m[1]) };
    } else if (/(\d+\.?\d*)\s*(?:kg|kilo)/.test(t)) {
      const m = t.match(/(\d+\.?\d*)\s*(?:kg|kilo)/);
      wChange = { absolute: parseFloat(m[1]) };
    }

    if (/(\d+)\s*(?:more|extra|additional)\s*rep/.test(t)) {
      const m = t.match(/(\d+)\s*(?:more|extra|additional)\s*rep/);
      rChange = { delta: +parseInt(m[1]) };
    } else if (/(\d+)\s*(?:less|fewer)\s*rep/.test(t)) {
      const m = t.match(/(\d+)\s*(?:less|fewer)\s*rep/);
      rChange = { delta: -parseInt(m[1]) };
    } else if (/(\d+)\s*rep/.test(t)) {
      const m = t.match(/(\d+)\s*rep/);
      rChange = { absolute: parseInt(m[1]) };
    }

    if (wChange || rChange) {
      setsToChange.forEach(si => {
        const prev = getPrevValues(ex.name);
        if (wChange) {
          let oldVal = null;
          if (currentEx && currentEx.sets[si]) oldVal = parseFloat(currentEx.sets[si].weight) || null;
          if (oldVal === null && prev[si]) oldVal = parseFloat(prev[si].weight) || null;
          const newVal = wChange.absolute != null ? wChange.absolute : (oldVal != null ? oldVal + wChange.delta : wChange.delta);
          actions.push({ type: 'modify_set', exerciseName: ex.name, setIndex: si, field: 'weight', oldValue: oldVal, newValue: Math.round(newVal * 2) / 2, description: `Set ${si + 1} weight` });
        }
        if (rChange) {
          let oldVal = null;
          if (currentEx && currentEx.sets[si]) oldVal = parseInt(currentEx.sets[si].reps) || null;
          if (oldVal === null && prev[si]) oldVal = parseInt(prev[si].reps) || null;
          const newVal = rChange.absolute != null ? rChange.absolute : (oldVal != null ? oldVal + rChange.delta : rChange.delta);
          actions.push({ type: 'modify_set', exerciseName: ex.name, setIndex: si, field: 'reps', oldValue: oldVal, newValue: Math.max(1, newVal), description: `Set ${si + 1} reps` });
        }
      });
    } else if (!actions.find(a => a.exerciseName === ex.name) && actions.length === 0) {
      unmatched.push(`Found "${ex.name}" but couldn't determine what to change. Try: "add 2kg to last set of ${ex.name}"`);
    }
  }

  const parts = actions.map(a => {
    if (a.type === 'load_template') return `Load template "${a.templateName}"`;
    if (a.type === 'add_exercise') return `Add ${a.exerciseName}`;
    if (a.type === 'remove_exercise') return `Remove ${a.exerciseName}`;
    if (a.type === 'modify_set') {
      const unit = a.field === 'weight' ? 'kg' : '';
      const dir = a.oldValue != null && a.newValue > a.oldValue ? '↑' : a.oldValue != null && a.newValue < a.oldValue ? '↓' : '→';
      return `${a.exerciseName} set ${a.setIndex + 1} ${a.field} ${dir} ${a.newValue}${unit}`;
    }
    return '';
  });

  return { actions, understood: parts.join(', '), unmatched };
}

function submitVoiceLog() {
  const tb = document.getElementById('transcript-box');
  const textInput = document.getElementById('voice-text-input').value.trim();
  const userText = textInput || (!tb.classList.contains('empty') ? tb.textContent.trim() : '');
  if (!userText) { showNotification('Nothing to interpret'); return; }
  const result = interpret(userText);
  renderReview(result, userText);
}

function renderReview(result, originalText) {
  const rc = document.getElementById('review-container');
  if (result.actions.length === 0) {
    let msg = result.unmatched.length ? result.unmatched.join('. ') : 'Could not understand. Try: "load push day", "add 2kg to last set of bench press", "remove shrugs"';
    rc.innerHTML = `<div class="review-panel">
      <div class="review-title">No Changes Found</div>
      <div class="no-match">${msg}</div>
      <div class="review-actions"><button class="review-discard-btn" style="flex:none;padding:8px 20px" onclick="discardChanges()">Dismiss</button></div>
    </div>`;
    return;
  }
  pendingChanges = result;
  const changesHtml = result.actions.map(a => {
    if (a.type === 'load_template') return `<div class="review-change"><div class="review-change-header">📋 Load template</div><div class="review-change-detail">Load "<strong>${a.templateName}</strong>" with previous values</div></div>`;
    if (a.type === 'modify_set') {
      const unit = a.field === 'weight' ? 'kg' : '';
      return `<div class="review-change"><div class="review-change-header">${a.exerciseName} — Set ${a.setIndex + 1}</div><div class="review-change-detail">${a.field === 'weight' ? 'Weight' : 'Reps'}: <span style="color:var(--muted)">${a.oldValue != null ? a.oldValue + unit : '—'}</span><span class="change-arrow">→</span><span style="color:var(--accent);font-weight:600">${a.newValue}${unit}</span></div></div>`;
    }
    if (a.type === 'add_exercise') return `<div class="review-change"><div class="review-change-header">➕ Add exercise</div><div class="review-change-detail"><strong>${a.exerciseName}</strong> (${a.muscle})</div></div>`;
    if (a.type === 'remove_exercise') return `<div class="review-change"><div class="review-change-header">➖ Remove exercise</div><div class="review-change-detail"><strong>${a.exerciseName}</strong></div></div>`;
    return '';
  }).join('');
  rc.innerHTML = `<div class="review-panel">
    <div class="review-title">Review Changes</div>
    <div class="review-understood" style="color:var(--muted);font-size:12px;margin-bottom:4px">You said: "${originalText}"</div>
    <div class="review-understood">${result.understood}</div>
    <div class="review-changes">${changesHtml}</div>
    <div class="review-actions">
      <button class="review-confirm-btn" onclick="applyChanges()">Apply Changes</button>
      <button class="review-discard-btn" onclick="discardChanges()">Discard</button>
    </div>
  </div>`;
}

function applyChanges() {
  if (!pendingChanges) return;
  pendingChanges.actions.forEach(a => {
    if (a.type === 'load_template') {
      const tpl = state.templates.find(t => t.name === a.templateName);
      if (tpl) {
        state.currentExercises = [];
        tpl.exercises.forEach(ex => {
          const prev = getPrevValues(ex.name);
          const sets = [];
          for (let i = 0; i < (ex.defaultSets || 1); i++) {
            const ps = prev[i] || null;
            sets.push({ reps: ps ? ps.reps : '', weight: ps ? ps.weight : '' });
          }
          state.currentExercises.push({ name: ex.name, muscle: ex.muscle, sets });
        });
        document.getElementById('workout-name').value = tpl.name;
      }
    }
    if (a.type === 'modify_set') {
      const ex = state.currentExercises.find(e => e.name === a.exerciseName);
      if (ex && ex.sets[a.setIndex] !== undefined) {
        ex.sets[a.setIndex][a.field] = String(a.newValue);
        ex.sets[a.setIndex]['_changed' + (a.field === 'weight' ? 'Weight' : 'Reps')] = true;
      }
    }
    if (a.type === 'add_exercise') {
      const ex = allExercises().find(e => e.name === a.exerciseName);
      if (ex && !state.currentExercises.find(e => e.name === ex.name)) {
        const prev = getPrevValues(ex.name);
        state.currentExercises.push({ name: ex.name, muscle: ex.muscle, sets: prev.length ? prev.map(s => ({ reps: s.reps, weight: s.weight })) : [{ reps: '', weight: '' }] });
      }
    }
    if (a.type === 'remove_exercise') {
      state.currentExercises = state.currentExercises.filter(e => e.name !== a.exerciseName);
    }
  });
  renderSessionExercises(true);
  document.getElementById('review-container').innerHTML = '';
  document.getElementById('transcript-box').textContent = 'Tap mic and speak...';
  document.getElementById('transcript-box').classList.add('empty');
  document.getElementById('voice-text-input').value = '';
  document.getElementById('voice-submit-btn').disabled = true;
  pendingChanges = null;
  showNotification('Changes applied!');
}

function discardChanges() {
  document.getElementById('review-container').innerHTML = '';
  pendingChanges = null;
  showNotification('Discarded');
}

// ── MIC ──────────────────────────────────────────────────────────────────────

function toggleMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { document.getElementById('mic-hint').textContent = 'Not supported — use text box'; return; }
  if (isListening) { recognition.stop(); return; }
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.onstart = () => {
    isListening = true;
    document.getElementById('mic-btn').className = 'mic-btn recording';
    document.getElementById('mic-btn').textContent = '⏹';
    document.getElementById('mic-hint').textContent = 'Listening… tap to stop';
    const tb = document.getElementById('transcript-box');
    tb.classList.remove('empty'); tb.textContent = '…';
  };
  recognition.onresult = e => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('transcript-box').textContent = final || interim;
    if (final) updateSubmitBtn();
  };
  recognition.onend = () => {
    isListening = false;
    document.getElementById('mic-btn').className = 'mic-btn';
    document.getElementById('mic-btn').textContent = '🎙';
    document.getElementById('mic-hint').textContent = 'Tap to speak again';
    updateSubmitBtn();
  };
  recognition.onerror = e => {
    isListening = false;
    document.getElementById('mic-btn').className = 'mic-btn';
    document.getElementById('mic-btn').textContent = '🎙';
    document.getElementById('mic-hint').textContent = e.error === 'not-allowed' ? 'Mic denied — use text box' : 'Error — try again';
  };
  recognition.start();
}

function updateSubmitBtn() {
  const tb = document.getElementById('transcript-box');
  const hasTranscript = !tb.classList.contains('empty') && tb.textContent.trim() && tb.textContent !== '…';
  const hasText = document.getElementById('voice-text-input').value.trim().length > 0;
  document.getElementById('voice-submit-btn').disabled = !(hasTranscript || hasText);
}

// ── EXERCISE UI ──────────────────────────────────────────────────────────────

function initMuscleFilter() {
  const c = document.getElementById('muscle-tabs'), s = document.getElementById('custom-muscle');
  c.innerHTML = '';
  MUSCLES.forEach(m => {
    const b = document.createElement('button');
    b.className = 'muscle-tab' + (m === selectedMuscle ? ' active' : '');
    b.textContent = m;
    b.onclick = () => { selectedMuscle = m; initMuscleFilter(); renderExerciseList(); };
    c.appendChild(b);
  });
  s.innerHTML = '<option value="">Muscle</option>';
  [...new Set(allExercises().map(e => e.muscle))].sort().forEach(m => {
    const o = document.createElement('option'); o.value = m; o.textContent = m; s.appendChild(o);
  });
  const co = document.createElement('option'); co.value = "Custom"; co.textContent = "Custom"; s.appendChild(co);
}

function renderExerciseList() {
  const q = document.getElementById('exercise-search').value.toLowerCase();
  const c = document.getElementById('exercise-list'); c.innerHTML = '';
  allExercises()
    .filter(e => (selectedMuscle === "All" || e.muscle === selectedMuscle) && (!q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)))
    .forEach(ex => {
      const d = document.createElement('div'); d.className = 'exercise-option';
      const prev = getPrevValues(ex.name);
      const hint = prev.length ? `<span style="font-size:10px;color:var(--accent);margin-left:4px">prev</span>` : '';
      d.innerHTML = `<div><div class="ex-name">${ex.name}${hint}</div><div class="ex-muscle">${ex.muscle}</div></div><span style="color:var(--accent);font-size:20px">+</span>`;
      d.onclick = () => addExerciseToSession(ex);
      c.appendChild(d);
    });
}

function addExerciseToSession(ex) {
  if (state.currentExercises.find(e => e.name === ex.name)) { showNotification('Already in session!'); return; }
  const prev = getPrevValues(ex.name);
  state.currentExercises.push({ name: ex.name, muscle: ex.muscle, sets: prev.length ? prev.map(s => ({ reps: s.reps, weight: s.weight })) : [{ reps: '', weight: '' }] });
  renderSessionExercises();
  showNotification(ex.name + ' added');
}

function addCustomExercise() {
  const name = document.getElementById('custom-name').value.trim();
  const muscle = document.getElementById('custom-muscle').value;
  if (!name || !muscle) { showNotification('Enter name and muscle group'); return; }
  const newEx = { name, muscle, custom: true };
  state.customExercises.push(newEx); saveState();
  document.getElementById('custom-name').value = '';
  initMuscleFilter(); renderExerciseList(); addExerciseToSession(newEx);
}

function renderSessionExercises(highlightChanges) {
  const container = document.getElementById('exercises-list');
  if (!state.currentExercises.length) {
    container.innerHTML = '<div class="empty-state"><div style="font-size:32px;margin-bottom:10px">🏋</div><div>Load a template or add exercises above</div></div>';
    return;
  }
  container.innerHTML = '';
  state.currentExercises.forEach((ex, ei) => {
    const prev = getPrevValues(ex.name);
    const card = document.createElement('div'); card.className = 'exercise-card';
    let setsHtml = '';
    ex.sets.forEach((set, si) => {
      const ps = prev[si] || null;
      const pr = ps && ps.reps ? ps.reps : '', pw = ps && ps.weight ? ps.weight : '';
      const cr = highlightChanges && set._changedReps, cw = highlightChanges && set._changedWeight;
      setsHtml += `<tr>
        <td class="set-num">${si + 1}</td>
        <td><div class="set-input-wrap"><input class="set-input${cr ? ' changed' : ''}" type="number" inputmode="decimal" placeholder="${pr || '—'}" value="${set.reps}" min="0" oninput="updateSet(${ei},${si},'reps',this.value)" style="width:52px"><div class="prev-val${pr ? ' has-val' : ''}">${pr || '—'}</div></div></td>
        <td><div class="set-input-wrap"><input class="set-input${cw ? ' changed' : ''}" type="number" inputmode="decimal" placeholder="${pw || '—'}" value="${set.weight}" min="0" step="0.5" oninput="updateSet(${ei},${si},'weight',this.value)" style="width:64px"><div class="prev-val${pw ? ' has-val' : ''}">${pw ? pw + 'kg' : '—'}</div></div></td>
        <td><button class="del-set-btn" onclick="deleteSet(${ei},${si})">✕</button></td>
      </tr>`;
    });
    const hasPrev = prev.length > 0;
    card.innerHTML = `<div class="exercise-card-header">
      <div><div class="exercise-card-name">${ex.name}</div><div class="exercise-card-muscle">${ex.muscle}${hasPrev ? '&nbsp;&nbsp;<span style="font-size:10px;color:var(--accent)">prev shown below</span>' : ''}</div></div>
      <button class="del-ex-btn" onclick="removeExercise(${ei})">✕</button>
    </div>
    <table class="sets-table">
      <thead><tr><th>Set</th><th>Reps${hasPrev ? '<div style="font-size:9px;color:var(--muted2);font-weight:400">prev</div>' : ''}</th><th>kg${hasPrev ? '<div style="font-size:9px;color:var(--muted2);font-weight:400">prev</div>' : ''}</th><th></th></tr></thead>
      <tbody>${setsHtml}</tbody>
    </table>
    <div class="add-set-row"><button class="add-set-btn" onclick="addSet(${ei})">+ Add set</button></div>`;
    container.appendChild(card);
  });
}

function updateSet(ei, si, field, val) { state.currentExercises[ei].sets[si][field] = val; }

function addSet(ei) {
  const ex = state.currentExercises[ei], prev = getPrevValues(ex.name), si = ex.sets.length;
  const ps = prev[si] || null;
  ex.sets.push({ reps: ps ? ps.reps : '', weight: ps ? ps.weight : '' });
  renderSessionExercises();
}

function deleteSet(ei, si) {
  if (state.currentExercises[ei].sets.length === 1) { showNotification('At least one set required'); return; }
  state.currentExercises[ei].sets.splice(si, 1); renderSessionExercises();
}

function removeExercise(ei) { state.currentExercises.splice(ei, 1); renderSessionExercises(); }

// ── WORKOUT SAVE / HISTORY ────────────────────────────────────────────────────

function saveWorkout() {
  if (!state.currentExercises.length) { showNotification('Add at least one exercise'); return; }
  const name = document.getElementById('workout-name').value.trim() || 'Workout ' + new Date().toLocaleDateString();
  const workout = { id: state.editingId || Date.now(), name, date: new Date().toISOString(), exercises: JSON.parse(JSON.stringify(state.currentExercises)) };
  if (state.editingId) {
    const idx = state.history.findIndex(w => w.id === state.editingId);
    if (idx !== -1) state.history[idx] = workout;
    state.editingId = null;
  } else {
    state.history.unshift(workout);
  }
  saveState();
  state.currentExercises = [];
  document.getElementById('workout-name').value = '';
  renderSessionExercises(); renderTemplates();
  showNotification('Workout saved!');
  showTab('history');
}

function saveAsTemplate() {
  if (!state.currentExercises.length) { showNotification('Add exercises first'); return; }
  const name = document.getElementById('workout-name').value.trim();
  if (!name) { showNotification('Give your workout a name first'); return; }
  state.templates = state.templates.filter(t => t.name !== name);
  state.templates.unshift({ id: Date.now(), name, exercises: state.currentExercises.map(e => ({ name: e.name, muscle: e.muscle, defaultSets: e.sets.length })) });
  saveState(); renderTemplates();
  showNotification('Template saved: ' + name);
}

function loadTemplate(id) {
  const tpl = state.templates.find(t => t.id === id); if (!tpl) return;
  state.currentExercises = [];
  tpl.exercises.forEach(ex => {
    const prev = getPrevValues(ex.name), sets = [];
    for (let i = 0; i < (ex.defaultSets || 1); i++) {
      const ps = prev[i] || null;
      sets.push({ reps: ps ? ps.reps : '', weight: ps ? ps.weight : '' });
    }
    state.currentExercises.push({ name: ex.name, muscle: ex.muscle, sets });
  });
  document.getElementById('workout-name').value = tpl.name;
  renderSessionExercises();
  showNotification('Loaded: ' + tpl.name);
}

function deleteTemplate(id) {
  state.templates = state.templates.filter(t => t.id !== id);
  saveState(); renderTemplates();
  showNotification('Template deleted');
}

function renderTemplates() {
  const section = document.getElementById('templates-section');
  if (!state.templates.length) { section.innerHTML = ''; return; }
  const cards = state.templates.map(t => `<div class="template-card">
    <div class="template-info"><div class="template-name">${t.name}</div><div class="template-meta">${t.exercises.length} exercises · ${[...new Set(t.exercises.map(e => e.muscle))].join(', ')}</div></div>
    <div class="template-actions">
      <button class="tpl-btn start" onclick="loadTemplate(${t.id})">Load</button>
      <button class="tpl-btn" onclick="deleteTemplate(${t.id})" style="color:var(--danger)">Del</button>
    </div>
  </div>`).join('');
  section.innerHTML = `<div class="section-title">Templates</div><div class="template-cards">${cards}</div><hr class="divider">`;
}

function renderHistory() {
  const container = document.getElementById('history-list');
  if (!state.history.length) {
    container.innerHTML = '<div class="empty-state"><div style="font-size:32px;margin-bottom:10px">📋</div><div>No workouts saved yet</div></div>';
    return;
  }
  container.innerHTML = '';
  state.history.forEach(w => {
    const muscles = [...new Set(w.exercises.map(e => e.muscle))];
    const dateStr = new Date(w.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const card = document.createElement('div'); card.className = 'history-card';
    let exDetailsHtml = '';
    w.exercises.forEach(ex => {
      const sh = ex.sets.filter(s => s.reps || s.weight).map((s, i) => `<span class="history-set-badge">Set ${i + 1}: ${s.reps || '—'} reps${s.weight ? ' @ ' + s.weight + 'kg' : ''}</span>`).join('');
      exDetailsHtml += `<div class="history-ex-item"><div class="history-ex-name">${ex.name}</div><div class="history-sets-row">${sh || '<span class="history-set-badge" style="color:var(--muted2)">No data</span>'}</div></div>`;
    });
    card.innerHTML = `<div class="history-card-header">
      <div><div class="history-workout-name">${w.name}</div><div class="history-date">${dateStr}</div></div>
      <div style="font-size:13px;color:var(--muted)">${w.exercises.length} exercise${w.exercises.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="history-muscles">${muscles.map(m => `<span class="muscle-tag">${m}</span>`).join('')}</div>
    <div class="history-details">${exDetailsHtml}
      <div class="history-btns">
        <button class="edit-workout-btn" onclick="editWorkout(${w.id},event)">Edit</button>
        <button class="del-workout-btn" onclick="deleteWorkout(${w.id},event)">Delete</button>
      </div>
    </div>`;
    card.onclick = () => card.classList.toggle('expanded');
    container.appendChild(card);
  });
}

function editWorkout(id, e) {
  e.stopPropagation();
  const workout = state.history.find(w => w.id === id); if (!workout) return;
  state.currentExercises = JSON.parse(JSON.stringify(workout.exercises));
  document.getElementById('workout-name').value = workout.name;
  state.editingId = id;
  showTab('log'); renderSessionExercises();
  showNotification('Editing "' + workout.name + '"');
}

function deleteWorkout(id, e) {
  e.stopPropagation();
  state.history = state.history.filter(w => w.id !== id);
  saveState(); renderHistory();
  showNotification('Workout deleted');
}

// ── TABS ─────────────────────────────────────────────────────────────────────

function showTab(tab) {
  document.getElementById('tab-log').style.display = tab === 'log' ? 'block' : 'none';
  document.getElementById('tab-history').style.display = tab === 'history' ? 'block' : 'none';
  document.querySelectorAll('.nav-btn').forEach((b, i) => b.classList.toggle('active', (i === 0 && tab === 'log') || (i === 1 && tab === 'history')));
  if (tab === 'history') renderHistory();
}

// ── TIMER ────────────────────────────────────────────────────────────────────

function toggleTimer() {
  if (timerRunning) {
    clearInterval(timerInterval); timerRunning = false;
    document.getElementById('timer-start-btn').textContent = 'Start';
    document.getElementById('timer-display').className = 'timer-display';
  } else {
    if (timerSeconds <= 0) resetTimer();
    timerRunning = true;
    document.getElementById('timer-start-btn').textContent = 'Pause';
    document.getElementById('timer-display').className = 'timer-display running';
    timerInterval = setInterval(() => {
      timerSeconds--;
      updateTimerDisplay();
      if (timerSeconds <= 0) {
        clearInterval(timerInterval); timerRunning = false;
        document.getElementById('timer-start-btn').textContent = 'Start';
        document.getElementById('timer-display').className = 'timer-display done';
        // Vibrate on phone if supported
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval); timerRunning = false; timerSeconds = 60;
  updateTimerDisplay();
  document.getElementById('timer-start-btn').textContent = 'Start';
  document.getElementById('timer-display').className = 'timer-display';
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60), s = timerSeconds % 60;
  document.getElementById('timer-display').textContent = m + ':' + (s < 10 ? '0' : '') + s;
}

// ── NOTIFICATIONS ────────────────────────────────────────────────────────────

function showNotification(msg) {
  const n = document.getElementById('notification');
  n.textContent = msg; n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 2200);
}

// ── PWA INSTALL ──────────────────────────────────────────────────────────────

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('install-banner').style.display = 'flex';
});

function installApp() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
      deferredInstallPrompt = null;
      dismissInstall();
    });
  }
}

function dismissInstall() {
  document.getElementById('install-banner').style.display = 'none';
}

window.addEventListener('appinstalled', () => {
  showNotification('IronLog installed!');
  dismissInstall();
});

// ── INIT ─────────────────────────────────────────────────────────────────────

document.getElementById('voice-text-input').addEventListener('input', updateSubmitBtn);

loadState();
document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
initMuscleFilter();
renderExerciseList();
renderTemplates();

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
