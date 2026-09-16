import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qjocvyauwuhrrlmlkfit.supabase.co';
const SUPABASE_KEY = 'sb_publishable_2Dp5S6sz6S0PORdUfqbHtw_rnT1njrh';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (v, digits=0) => Number(v ?? 0).toLocaleString('it-IT',{maximumFractionDigits:digits});
const val = (id) => $(id)?.value ?? '';
const num = (id) => Number(val(id) || 0);
const splitList = (text) => (text || '').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
const mealLabels = {breakfast:'Colazione', morning_snack:'Spuntino', lunch:'Pranzo', afternoon_snack:'Merenda', dinner:'Cena'};
const dayLabels = ['','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'];
let session=null, profile=null, patients=[], selectedPatient=null, currentPlanId=null;

function toast(message, type='ok') {
  const t=$('#toast'); t.textContent=message; t.className=`toast show ${type==='error'?'error':''}`;
  clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>t.className='toast',3200);
}
function setLoading(on,title='Generazione in corso',text='Sto ottimizzando pasti, porzioni, varietà ed equivalenze.'){
  $('#loadingTitle').textContent=title; $('#loadingText').textContent=text; $('#loadingOverlay').classList.toggle('hidden',!on);
}
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

async function init(){
  const {data:{session:s}}=await supabase.auth.getSession(); session=s;
  if(session) await enterApp(); else showAuth();
  supabase.auth.onAuthStateChange(async(_e,s2)=>{session=s2; if(s2) await enterApp(); else showAuth();});
  bindEvents(); setDefaultTitle(); updateSummary(); updateShareTotal();
}
function showAuth(){ $('#authView').classList.remove('hidden'); $('#appView').classList.add('hidden'); }
async function enterApp(){
  const {data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();
  if(error||!data){toast('Profilo non trovato.','error');return;}
  if(data.role!=='nutritionist'){toast('Questa schermata è riservata al nutrizionista.','error'); await supabase.auth.signOut(); return;}
  profile=data; $('#authView').classList.add('hidden'); $('#appView').classList.remove('hidden');
  $('#userName').textContent=data.full_name||'Nutrizionista'; $('#userEmail').textContent=data.email||session.user.email||'';
  $('#userInitials').textContent=(data.full_name||'N').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  await loadPatients();
}
async function loadPatients(){
  const {data,error}=await supabase.from('patients').select('id,first_name,last_name,birth_date,email,sex,height_cm,conditions,allergies,preferences,medications,clinical_notes').order('last_name');
  if(error){toast(error.message,'error');return;}
  patients=data||[]; const sel=$('#patientSelect'); sel.innerHTML='<option value="">Seleziona un paziente…</option>'+patients.map(p=>`<option value="${p.id}">${esc(p.last_name)} ${esc(p.first_name)}</option>`).join('');
}
async function selectPatient(id){
  selectedPatient=patients.find(p=>p.id===id)||null; currentPlanId=null; resetPlanView();
  if(!selectedPatient){$('#patientContext').className='patient-context empty-state'; $('#patientContext').textContent='Seleziona un paziente per caricare visita, BIA, allergie e preferenze.'; $('#summaryPatient').textContent='Nessun paziente'; $('#recentPlans').className='card empty-state'; $('#recentPlans').textContent='Seleziona un paziente per vedere i suoi piani.'; return;}
  $('#summaryPatient').textContent=`${selectedPatient.first_name} ${selectedPatient.last_name}`; setDefaultTitle();
  const [biaRes,visitRes]=await Promise.all([
    supabase.from('bia_records').select('*').eq('patient_id',id).order('measured_at',{ascending:false}).limit(1).maybeSingle(),
    supabase.from('visits').select('*').eq('patient_id',id).order('visit_date',{ascending:false}).limit(1).maybeSingle()
  ]);
  const bia=biaRes.data, visit=visitRes.data;
  if(bia?.bmr_kcal) $('#bmr').value=Math.round(Number(bia.bmr_kcal));
  if(visit?.goal) $('#goal').value=visit.goal;
  if(selectedPatient.preferences) $('#preferences').value=selectedPatient.preferences;
  const age=selectedPatient.birth_date?Math.floor((Date.now()-new Date(selectedPatient.birth_date).getTime())/31557600000):null;
  $('#patientContext').className='patient-context';
  $('#patientContext').innerHTML=`<div class="context-grid">
    <div class="context-stat"><span>Età</span><strong>${age??'—'}</strong></div>
    <div class="context-stat"><span>Peso</span><strong>${bia?.weight_kg??visit?.weight_kg??'—'}${bia?.weight_kg||visit?.weight_kg?' kg':''}</strong></div>
    <div class="context-stat"><span>Massa grassa</span><strong>${bia?.body_fat_pct?fmt(bia.body_fat_pct,1)+'%':'—'}</strong></div>
    <div class="context-stat"><span>BMR BIA</span><strong>${bia?.bmr_kcal?fmt(bia.bmr_kcal)+' kcal':'—'}</strong></div>
    <div class="context-stat"><span>Massa magra</span><strong>${bia?.fat_free_mass_kg?fmt(bia.fat_free_mass_kg,1)+' kg':'—'}</strong></div>
    <div class="context-stat"><span>Muscolo</span><strong>${bia?.muscle_mass_kg?fmt(bia.muscle_mass_kg,1)+' kg':'—'}</strong></div>
    <div class="context-stat"><span>Phase angle</span><strong>${bia?.phase_angle?fmt(bia.phase_angle,1)+'°':'—'}</strong></div>
    <div class="context-stat"><span>Ultima visita</span><strong>${visit?.visit_date?new Date(visit.visit_date).toLocaleDateString('it-IT'):'—'}</strong></div>
  </div><div class="context-notes">
    ${selectedPatient.allergies?`<p><strong>Allergie:</strong> ${esc(selectedPatient.allergies)}</p>`:''}
    ${selectedPatient.conditions?`<p><strong>Condizioni:</strong> ${esc(selectedPatient.conditions)}</p>`:''}
    ${selectedPatient.medications?`<p><strong>Farmaci:</strong> ${esc(selectedPatient.medications)}</p>`:''}
  </div>`;
  await loadRecentPlans();
}
function setDefaultTitle(){ const d=new Date().toLocaleDateString('it-IT'); $('#planTitle').value=selectedPatient?`Piano alimentare ${selectedPatient.first_name} ${selectedPatient.last_name} · ${d}`:`Piano alimentare · ${d}`; }
function updateSummary(){ $('#summaryKcal').textContent=fmt(num('#calories')); $('#summaryProtein').textContent=`${fmt(num('#protein'))} g`; $('#summaryCarbs').textContent=`${fmt(num('#carbs'))} g`; $('#summaryFat').textContent=`${fmt(num('#fat'))} g`; }
function updateShareTotal(){ const total=$$('.meal-share').reduce((a,x)=>a+Number(x.value||0),0); $('#shareTotal').textContent=`Totale ${total}%`; $('#shareTotal').className=`tag ${total===100?'':'danger'}`; }
function applyMacroPct(){ const kcal=num('#calories'), p=num('#proteinPct'), c=num('#carbsPct'), f=num('#fatPct'); if(Math.round(p+c+f)!==100){toast('Le percentuali dei macro devono sommare 100%.','error');return;} $('#protein').value=Math.round(kcal*p/100/4); $('#carbs').value=Math.round(kcal*c/100/4); $('#fat').value=Math.round(kcal*f/100/9); updateSummary(); }
function getMealShares(){ return Object.fromEntries($$('.meal-share').map(x=>[x.dataset.meal,Number(x.value||0)/100])); }
function getFrequency(){ const out={}; $$('[data-freq]').forEach(x=>out[x.dataset.freq]={max:Number(x.value||0)}); return out; }
async function functionErrorMessage(error){
  if(!error) return 'Errore sconosciuto';
  try{
    const response=error.context;
    if(response){
      const payload=await (response.clone?response.clone():response).json();
      if(payload?.error) return payload.error;
      if(payload?.message) return payload.message;
    }
  }catch{}
  return error.message||String(error);
}
function generationBody(){
  const mealShares=getMealShares();
  return {
    patient_id:selectedPatient.id, title:val('#planTitle'), goal:val('#goal'), days:num('#days'),
    calories_target:num('#calories'), protein_target_g:num('#protein'), carbs_target_g:num('#carbs'), fat_target_g:num('#fat'), fiber_target_g:num('#fiber'), sodium_limit_mg:num('#sodium')||null,
    bmr_kcal:num('#bmr')||null, tdee_kcal:num('#tdee')||null, activity_factor:num('#activityFactor')||null,
    dietary_pattern:val('#dietaryPattern'), meals:['breakfast','morning_snack','lunch','afternoon_snack','dinner'].map(type=>({type,share:mealShares[type]})), meal_shares:mealShares,
    allergies:splitList(val('#allergiesExtra')), excluded_foods:splitList(val('#excludedFoods')), preferences:splitList(val('#preferences')),
    clinical_notes:val('#clinicalNotes'), patient_notes:val('#patientNotes'), weekly_frequency:getFrequency()
  };
}
async function generatePlan(){
  if(!selectedPatient){toast('Seleziona prima un paziente.','error');return;}
  if(!num('#calories')){toast('Inserisci il target calorico.','error');return;}
  const shareTotal=$$('.meal-share').reduce((a,x)=>a+Number(x.value||0),0); if(shareTotal!==100){toast('La distribuzione dei pasti deve sommare 100%.','error');return;}
  setLoading(true);
  try{
    const {data,error}=await supabase.functions.invoke('generate-diet-plan',{body:generationBody()});
    if(error) throw new Error(await functionErrorMessage(error)); if(data?.error) throw new Error(data.error);
    currentPlanId=data.plan_id; toast(`Piano generato · score ${fmt(data.quality_score,1)}%`); await loadPlan(currentPlanId); await loadRecentPlans();
    $('#planSection').scrollIntoView({behavior:'smooth'});
  }catch(e){toast(e.message||String(e),'error');}finally{setLoading(false);}
}
async function loadPlan(planId){
  setLoading(true,'Caricamento piano','Recupero pasti, metriche ed equivalenze.');
  try{
    const [planRes,metricsRes,mealsRes]=await Promise.all([
      supabase.from('diet_plans').select('*').eq('id',planId).single(),
      supabase.from('diet_plan_day_metrics').select('*').eq('plan_id',planId).order('day_number'),
      supabase.from('plan_meals').select('id,day_number,meal_type,sort_order,preparation_title,instructions,is_free_meal,plan_food_items(id,food_id,food_name,quantity_g,unit,calories,protein_g,carbs_g,fat_g,fiber_g,sodium_mg,food_category,slot_key,plan_food_equivalents(id,food_name,quantity_g,rank,equivalence_score))').eq('plan_id',planId).order('day_number').order('sort_order')
    ]);
    if(planRes.error) throw planRes.error; currentPlanId=planId; renderPlan(planRes.data,metricsRes.data||[],mealsRes.data||[]);
  }catch(e){toast(e.message||String(e),'error');}finally{setLoading(false);}
}
function renderPlan(plan,metrics,meals){
  $('#planEmpty').classList.add('hidden'); $('#planOutput').classList.remove('hidden'); $('#planActions').classList.remove('hidden');
  $('#publishPlanBtn').textContent=plan.status==='published'?'✓ Piano pubblicato':'Pubblica al paziente'; $('#publishPlanBtn').disabled=plan.status==='published';
  const mByDay=Object.fromEntries(metrics.map(m=>[m.day_number,m])); const grouped={}; meals.forEach(m=>(grouped[m.day_number]??=[]).push(m));
  const days=[...new Set([...metrics.map(x=>x.day_number),...meals.map(x=>x.day_number)])].sort((a,b)=>a-b);
  const warnings=[...new Set(metrics.flatMap(m=>m.warnings||[]))];
  const score=Math.round(Number(plan.quality_score||0)*10)/10;
  const meta=[`${fmt(plan.calories_target)} kcal`,`${fmt(plan.protein_target_g)} g proteine`,`${fmt(plan.carbs_target_g)} g carbo`,`${fmt(plan.fat_target_g)} g grassi`,`${fmt(plan.fiber_target_g)} g fibra`,`Algoritmo ${esc(plan.algorithm_version||'2.0.0')}`];
  $('#planOutput').innerHTML=`<div class="plan-hero">
    <div class="card score-card"><div class="score-ring" style="--score:${Math.max(0,Math.min(100,score))}"><strong>${fmt(score,1)}</strong></div><span>Quality Score / 100</span></div>
    <div class="card plan-summary-card"><p class="eyebrow">${esc(plan.status)}</p><h3>${esc(plan.title)}</h3><p class="muted">${esc(plan.goal||'Piano nutrizionale personalizzato')}</p><div class="plan-meta">${meta.map(x=>`<span>${x}</span>`).join('')}</div>${warnings.length?`<div class="warning-list">${warnings.map(w=>`<div class="warning">⚠ ${esc(w)}</div>`).join('')}</div>`:''}</div>
  </div><div class="day-list">${days.map(day=>renderDay(day,mByDay[day],grouped[day]||[])).join('')}</div>`;
}
function renderDay(day,metric,meals){
  const dm=metric?`<span>${fmt(metric.calories)} kcal</span><span>P ${fmt(metric.protein_g)}g</span><span>C ${fmt(metric.carbs_g)}g</span><span>G ${fmt(metric.fat_g)}g</span><span>Fibra ${fmt(metric.fiber_g)}g</span><span>Score ${fmt(metric.quality_score,1)}</span>`:'';
  return `<article class="day-card"><div class="day-head"><div><p class="eyebrow">Giorno ${day}</p><h4>${dayLabels[day]||`Giorno ${day}`}</h4></div><div class="day-metrics">${dm}<button class="btn regen-btn" data-regen-day="${day}">↻ Rigenera giorno</button></div></div><div class="day-body">${meals.map(renderMeal).join('')}</div></article>`;
}
function renderMeal(meal){
  const items=meal.plan_food_items||[]; const total=items.reduce((a,x)=>a+Number(x.calories||0),0);
  return `<div class="meal-row"><div class="meal-title"><strong>${mealLabels[meal.meal_type]||esc(meal.meal_type)}</strong><span class="muted">${fmt(total)} kcal</span></div>${items.map(i=>{
    const eq=(i.plan_food_equivalents||[]).sort((a,b)=>a.rank-b.rank);
    return `<div class="food-item"><div class="food-name"><strong>${esc(i.food_name)}</strong><small>${esc(i.food_category||'')} · ${fmt(i.calories)} kcal · P ${fmt(i.protein_g,1)} · C ${fmt(i.carbs_g,1)} · G ${fmt(i.fat_g,1)}</small>${eq.length?`<div class="equivalents">${eq.map(e=>`<span>oppure ${esc(e.food_name)} ${fmt(e.quantity_g)}g</span>`).join('')}</div>`:''}</div><div class="quantity">${fmt(i.quantity_g)} ${esc(i.unit||'g')}</div></div>`;
  }).join('')}</div>`;
}
async function regenerateDay(day){
  if(!currentPlanId)return; setLoading(true,`Rigenero ${dayLabels[day]||'il giorno'}`,'Mantengo i target e considero gli alimenti già usati negli altri giorni.');
  try{ const {data,error}=await supabase.functions.invoke('regenerate-diet-day',{body:{plan_id:currentPlanId,day_number:day}}); if(error)throw new Error(await functionErrorMessage(error));if(data?.error)throw new Error(data.error);toast(`Giorno rigenerato · score ${fmt(data.quality_score,1)}%`);await loadPlan(currentPlanId); }catch(e){toast(e.message||String(e),'error');}finally{setLoading(false);}
}
async function publishPlan(){
  if(!currentPlanId)return; if(!confirm('Pubblicare questo piano al paziente? Dopo la pubblicazione sarà visibile nella sua area riservata.'))return;
  const {error}=await supabase.from('diet_plans').update({status:'published',published_at:new Date().toISOString()}).eq('id',currentPlanId); if(error){toast(error.message,'error');return;} toast('Piano pubblicato al paziente.'); await loadPlan(currentPlanId); await loadRecentPlans();
}
async function loadRecentPlans(){
  if(!selectedPatient)return; const {data,error}=await supabase.from('diet_plans').select('id,title,status,created_at,quality_score,calories_target').eq('patient_id',selectedPatient.id).order('created_at',{ascending:false}).limit(10);
  if(error){$('#recentPlans').textContent=error.message;return;} const rows=data||[]; $('#recentPlans').className='card';
  $('#recentPlans').innerHTML=rows.length?`<div class="history-list">${rows.map(p=>`<div class="history-row"><div><strong>${esc(p.title)}</strong><small>${new Date(p.created_at).toLocaleString('it-IT')} · ${fmt(p.calories_target)} kcal${p.quality_score?` · score ${fmt(p.quality_score,1)}`:''}</small></div><span class="status-badge ${p.status}">${esc(p.status)}</span><button class="btn small" data-open-plan="${p.id}">Apri</button></div>`).join('')}</div>`:'<div class="empty-state">Nessun piano per questo paziente.</div>';
}
function resetPlanView(){currentPlanId=null;$('#planOutput').classList.add('hidden');$('#planOutput').innerHTML='';$('#planEmpty').classList.remove('hidden');$('#planActions').classList.add('hidden');}
function bindEvents(){
  $('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';const {error}=await supabase.auth.signInWithPassword({email:val('#loginEmail'),password:val('#loginPassword')});if(error)$('#loginError').textContent=error.message;});
  $('#logoutBtn').addEventListener('click',()=>supabase.auth.signOut()); $('#patientSelect').addEventListener('change',e=>selectPatient(e.target.value));
  ['#calories','#protein','#carbs','#fat'].forEach(id=>$(id).addEventListener('input',updateSummary)); $('#applyMacroPct').addEventListener('click',applyMacroPct); $$('.meal-share').forEach(x=>x.addEventListener('input',updateShareTotal));
  $('#generateBtn').addEventListener('click',generatePlan); $('#publishPlanBtn').addEventListener('click',publishPlan); $('#refreshPlanBtn').addEventListener('click',()=>currentPlanId&&loadPlan(currentPlanId));
  document.addEventListener('click',e=>{const r=e.target.closest('[data-regen-day]');if(r)regenerateDay(Number(r.dataset.regenDay));const p=e.target.closest('[data-open-plan]');if(p){currentPlanId=p.dataset.openPlan;loadPlan(currentPlanId);$('#planSection').scrollIntoView({behavior:'smooth'});}const n=e.target.closest('[data-scroll]');if(n)document.querySelector(n.dataset.scroll)?.scrollIntoView({behavior:'smooth'});});
}
init();
