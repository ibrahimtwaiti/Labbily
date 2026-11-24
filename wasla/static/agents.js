'use strict';
const studioLabel=sv('وكلاء الذكاء الاصطناعي','AI agents');
for(const role of ['admin','supervisor']) menus[role].splice(2,0,['agents',studioLabel,'✦']);
menus.provider.push(['agentpolicy',sv('إتاحة الوكلاء','Agent access'),'✦']);
const agentWords={
 draft:['مسودة','Draft'],published:['منشور','Published'],paused:['متوقف','Paused'],archived:['مؤرشف','Archived'],
 answer:['إجابة موثقة','Grounded answer'],review:['مطابقة تحتاج مراجعة','Review match'],handover:['تحويل للموظف','Human handover'],followup:['متابعة بشرية','Follow-up'],
 auto_queued:['رد الوكيل','Agent reply'],suggestion:['مسودة الوكيل','Agent suggestion'],internal:['ملاحظة الوكيل','Agent note'],
 suggest:['اقتراح للمراجعة','Suggested reply'],auto:['رد آلي','Automatic reply'],hybrid:['رد وتحويل','Hybrid'],build:['دليل العمل','Playbook'],
 knowledge:['المعرفة','Knowledge'],playground:['المحاكاة','Playground'],deploy:['النشر','Deploy'],analytics:['النشاط والأداء','Activity & metrics']
};
const aw=k=>agentWords[k]?sv(...agentWords[k]):k;
function agentResultLabel(k){return esc(aw(k))}
const agentOpts=keys=>keys.map(k=>[k,aw(k)]);
const studioButton=(id,label,secondary=true)=>`<button type="button" id="${id}" class="${secondary?'light':''}">${esc(label)}</button>`;
const studioSubmit=label=>`<button type="submit">${esc(label)}</button>`;
const studioForm=(id,content,label)=>`<form class="agent-form" id="${id}">${errorBox}${content}${studioSubmit(label)}</form>`;
const studioActions=(parent,fn)=>async event=>{const el=event.currentTarget;el.disabled=true;try{await fn()}catch(e){toast(serviceError(e))}finally{if(parent.contains(el))el.disabled=false}};
function renderCustomerContext(main,t){
 const panel=main.querySelector('#customer-context');if(!panel)return;
 const contact=t.contact, identity=t.identity;
 panel.hidden=false;
 panel.innerHTML=`<details open><summary>${sv('ملف العميل','Customer profile')}</summary><h3 dir="auto">${esc(contact?.name||identity.name)}</h3>
 <dl><dt>${sv('القناة','Channel')}</dt><dd>${esc(t.account.label||t.account.channel)}</dd><dt>${sv('الهوية على القناة','Channel identity')}</dt><dd><bdi>${esc(identity.provider_user_id)}</bdi></dd>
 ${contact?`<dt>${sv('هاتف موثق','Verified phone')}</dt><dd><bdi>${esc(contact.phone)}</bdi></dd><dt>${sv('التصنيفات','Tags')}</dt><dd>${esc(contact.tags||'—')}</dd>`:''}
 <dt>${sv('الفريق','Team')}</dt><dd>${esc(t.team||'—')}</dd></dl>${t.summary?`<p dir="auto">${esc(t.summary)}</p>`:''}
 ${(t.linked_tasks||[]).map(x=>`<p>${esc(x.title)} · ${esc(x.status)}</p>`).join('')}</details>`;
}
function mountCopilot(form,t){
 const panel=document.createElement('details');panel.className='copilot';
 panel.innerHTML=`<summary>✦ ${sv('مساعد الصياغة','Writing assistant')}</summary><div></div>`;form.elements.body.closest('label').after(panel);
 const root=panel.querySelector('div');
 panel.ontoggle=async()=>{
  if(!panel.open||root.dataset.ready)return;
  try{
   const agents=await api('/v2/tickets/'+t.id+'/copilot');
   if(!agents.length){root.textContent=sv('لا يوجد وكيل منشور لهذه الشركة.','This workspace has no published agents.');return}
   const ops=[['draft',sv('اقتراح من المعرفة','Suggest from knowledge')],['summarize',sv('تلخيص رسائل العميل','Summarize customer messages')],['translate',sv('ترجمة إلى لغة الطلب','Translate to ticket language')],['rewrite',sv('إعادة صياغة','Rewrite')],['shorten',sv('اختصار','Shorten')],['expand',sv('توسيع','Expand')],['correct',sv('تصحيح','Proofread')],['friendly',sv('أسلوب ودي','Friendly tone')],['formal',sv('أسلوب رسمي','Formal tone')],['intent',sv('تحديد الطلب','Identify intent')],['next_step',sv('اقتراح الخطوة التالية','Suggest next step')]];
   root.innerHTML=select('copilot_agent',studioLabel,agents.map(a=>[a.id,a.name]))+select('copilot_op',sv('المهمة','Action'),ops)+studioButton('generate-copy',sv('معاينة الاقتراح','Preview suggestion'))+'<output aria-live="polite"></output>';root.dataset.ready='1';
   root.querySelector('button').onclick=studioActions(root,async()=>{
    const r=await send('/v2/tickets/'+t.id+'/copilot','POST',{agent_id:form.elements.copilot_agent.value,operation:form.elements.copilot_op.value,text:form.elements.body.value});
    const out=root.querySelector('output');out.textContent=r.answer||aw(r.kind);
    if(r.answer){const use=document.createElement('button');use.type='button';use.className='light';use.textContent=sv('استخدام في المسودة','Use in draft');use.onclick=()=>{form.elements.body.value=r.answer;form.elements.body.focus()};out.append(document.createElement('br'),use)}
   });
  }catch(e){root.textContent=serviceError(e)}
 };
}
async function agentPolicyView(main){
 const companies=await api('/admin/tenants');
 main.innerHTML=heading(sv('إتاحة الوكلاء','Agent access'),sv('حدود التشغيل لكل شركة.','Operating limits by workspace.'))+`<div class="card">${select('workspace',sv('الشركة','Workspace'),[['','—'],...companies.map(c=>[c.id,c.name])])}<div id="agent-limits"></div></div>`;
 main.querySelector('select').onchange=async e=>{
  const tid=e.target.value,root=main.querySelector('#agent-limits');root.replaceChildren();if(!tid)return;
  try{const p=await api('/admin/workspaces/'+tid+'/agent-policy');if(main.querySelector('select').value!==tid)return;
   const flags=(k,label)=>select(k,label,[['0',sv('معطل','Off')],['1',sv('متاح','On')]],String(p[k]));
   root.innerHTML=studioForm('policy-form',field('max_agents',sv('عدد الوكلاء','Agent limit'),'number',p.max_agents)+field('monthly_runs',sv('عمليات شهرية','Monthly operations'),'number',p.monthly_runs)+flags('live_enabled',sv('تشغيل على القنوات','Live channel operation'))+flags('external_enabled',sv('السماح بإرسال النص إلى OpenAI للصياغة','Allow text processing by OpenAI')),tr('حفظ التغييرات'));
   bindForm(root.querySelector('form'),async d=>{await send('/admin/workspaces/'+tid+'/agent-policy','PUT',{max_agents:Number(d.max_agents),monthly_runs:Number(d.monthly_runs),live_enabled:d.live_enabled==='1',external_enabled:d.external_enabled==='1'});toast(tr('تم الحفظ بنجاح'))});
  }catch(e){root.textContent=serviceError(e)}
 };
}
async function agentStudioView(main,selected=null,tab='build'){
 const list=await api('/v2/agents');
 const a=selected?await api('/v2/agents/'+selected):null;
 main.innerHTML=heading(studioLabel,sv('أنشئ دليل العمل، اختبر الإجابات، ثم اختر قناة التشغيل.','Build a playbook, test its answers, then select a channel.'),studioButton('agent-new',sv('إنشاء وكيل','Create agent'),false))+
 `<div class="agent-shell"><aside class="agent-list"><p>${sv('عمليات هذا الشهر','Runs this month')} <bdi>${list.usage.runs} / ${list.policy.monthly_runs}</bdi></p>${list.agents.map(x=>`<button type="button" class="agent-item ${x.id===selected?'selected':''}" data-agent="${esc(x.id)}"><strong>${esc(x.name)}</strong><small>${aw(x.state)}${x.published?' · v'+x.published:''}</small></button>`).join('')}</aside>
 <section class="agent-board"><div id="agent-body"></div></section></div>`;
 const refresh=(id=selected,key=tab)=>agentStudioView(main,id,key);
 const click=(id,fn)=>{main.querySelector('#'+id).onclick=studioActions(main,fn)};
 click('agent-new',async()=>{
  const root=main.querySelector('#agent-body');
  root.innerHTML=`<h2>${sv('وكيل جديد','New agent')}</h2>`+studioForm('create-agent',field('name',sv('اسم الوكيل','Agent name'))+area('instructions',sv('تعليمات الصياغة','Editorial instructions'),'',false),sv('إنشاء المسودة','Create draft'));
  bindForm(root.querySelector('form'),async d=>{const r=await send('/v2/agents','POST',d);await refresh(r.id,'build')});
 });
 for(const el of main.querySelectorAll('[data-agent]'))el.onclick=studioActions(main,()=>refresh(el.dataset.agent,'build'));
 const root=main.querySelector('#agent-body');
 if(!a){root.innerHTML=empty(sv('اختر وكيلًا أو أنشئ مسودة','Select an agent or create a draft'));return}
 root.before(Object.assign(document.createElement('h2'),{textContent:a.name}));
 const tabs=document.createElement('nav');tabs.className='agent-tabs';tabs.setAttribute('aria-label',studioLabel);root.before(tabs);
 for(const k of ['build','knowledge','playground','deploy','analytics']){
  const btn=document.createElement('button');btn.type='button';btn.textContent=aw(k);btn.setAttribute('aria-pressed',String(k===tab));btn.onclick=studioActions(main,()=>refresh(selected,k));tabs.append(btn)
 }
 const base='/v2/agents/'+a.id,cfg=a.draft;
 const save=async value=>{await send(base,'PUT',{revision:a.revision,config:value});await refresh()};
 if(tab==='build'){
  root.innerHTML=studioForm('agent-build',field('name',sv('اسم الوكيل','Agent name'),'text',cfg.name)+area('instructions',sv('تعليمات الصياغة للمساعد','Copilot editorial playbook'),cfg.instructions,false)+select('language',sv('اللغة','Language'),[['auto',sv('لغة العميل','Customer language')],['ar','العربية'],['en','English']],cfg.language)+select('tone',sv('النبرة','Tone'),[['professional',sv('مهنية','Professional')],['friendly',sv('ودية','Friendly')],['concise',sv('مختصرة','Concise')]],cfg.tone)+area('terms',sv('عبارات التحويل للموظف، كل عبارة في سطر','Handover phrases, one per line'),cfg.handover_terms.join('\n'),false)+select('follow',sv('إنشاء مهمة عند طلب المتابعة','Create a task when follow-up is requested'),[['0',sv('معطل','Off')],['1',sv('مسموح','Allowed')]],String(Number(cfg.tools.includes('followup')))),sv('حفظ المسودة','Save draft'));
  bindForm(root.querySelector('form'),d=>save({...cfg,name:d.name,instructions:d.instructions,language:d.language,tone:d.tone,handover_terms:d.terms.split('\n').map(x=>x.trim()).filter(Boolean),tools:d.follow==='1'?['followup']:[]}));
 }else if(tab==='knowledge'){
  root.innerHTML=cfg.sources.map((s,i)=>`<details class="source-row"><summary>${esc(s.title)}</summary><p>${esc(s.answer)}</p><button type="button" class="light" data-remove="${i}">${sv('إزالة من المسودة','Remove from draft')}</button></details>`).join('')+studioForm('agent-source',field('title',sv('سؤال معتمد','Approved question'))+area('answer',sv('الإجابة المعتمدة','Approved answer'))+area('aliases',sv('صيغ أخرى للسؤال، كل صيغة في سطر','Alternative questions, one per line'),'',false),sv('إضافة إلى المعرفة','Add to knowledge'));
  root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=studioActions(root,()=>save({...cfg,sources:cfg.sources.filter((_,i)=>i!==Number(el.dataset.remove))})));
  bindForm(root.querySelector('form'),d=>save({...cfg,sources:[...cfg.sources,{title:d.title,answer:d.answer,aliases:d.aliases.split('\n').map(x=>x.trim()).filter(Boolean)}]}));
 }else if(tab==='playground'){
  root.innerHTML=studioForm('agent-play',area('question',sv('رسالة المحاكاة','Simulated customer message'))+select('expected',sv('حفظ كحالة اختبار','Save as a test case'),[['',sv('تجربة فقط','Run once')],...agentOpts(['answer','review','handover','followup'])]),sv('اختبر المسودة','Test draft'))+'<output class="agent-preview" aria-live="polite"></output>'+a.scenarios.map(c=>`<p>${esc(c.question)} · ${aw(c.expected)} <button class="light small" data-case="${esc(c.id)}">${sv('إزالة','Remove')}</button></p>`).join('');
  bindForm(root.querySelector('form'),async d=>{const r=await send(base+'/playground','POST',{question:d.question,save:!!d.expected,expected:d.expected||null});if(d.expected)await refresh();const o=main.querySelector('.agent-preview');o.textContent=[aw(r.kind),r.answer,r.source,sv('زمن التنفيذ','Duration')+' '+r.elapsed_ms+' ms',sv('حالات الاختبار الناجحة','Saved scenarios passing')+': '+(r.scenarios_passed?'✓':'—')].filter(Boolean).join('\n')});
  root.querySelectorAll('[data-case]').forEach(el=>el.onclick=studioActions(root,async()=>{await send(base+'/scenarios/'+el.dataset.case,'DELETE',{});await refresh()}));
 }else if(tab==='deploy'){
  root.innerHTML=`<p>${sv('النسخة المنشورة','Published version')} <bdi>${a.published||'—'}</bdi> · ${aw(a.state)}</p>`+studioButton('agent-publish',sv('نشر المسودة المختبرة','Publish tested draft'),false)+studioButton('agent-pause',sv('إيقاف التشغيل','Pause agent'))+studioButton('agent-archive',sv('أرشفة','Archive'))+
   (a.versions.length?studioForm('agent-restore',select('version',sv('الإصدارات','Versions'),a.versions.map(v=>[v.version,'v'+v.version+' · '+date(v.created_at)])),sv('استعادة كمسودة','Restore as draft')):'')+
   (list.accounts.length&&list.policy.live_enabled?studioForm('agent-route',select('account_id',sv('حساب القناة','Channel account'),list.accounts.map(c=>[c.id,c.label+' · '+c.channel]))+select('mode',sv('وضع التشغيل','Operating mode'),agentOpts(['suggest','internal','auto','hybrid'])),sv('ربط الحساب','Connect account')):`<p>${sv('يتطلب الربط حساب قناة متحققًا وإتاحة التشغيل من مدير المنصة.','Live routing requires a verified channel and workspace authorization.')}</p>`)+a.deployments.map(d=>`<p>${esc(d.label)} · ${aw(d.mode)} <button class="light small" data-unbind="${esc(d.account_id)}">${sv('فصل','Disconnect')}</button></p>`).join('');
  main.querySelector('#agent-publish').disabled=a.tested_revision!==a.revision||a.state==='archived';
  click('agent-publish',async()=>{await send(base+'/publish','POST',{revision:a.revision});await refresh()});
  for(const action of ['pause','archive'])click('agent-'+action,async()=>{await send(base+'/state','POST',{action,revision:a.revision});await refresh()});
  if(root.querySelector('#agent-restore'))bindForm(root.querySelector('#agent-restore'),async d=>{await send(base+'/state','POST',{action:'restore',version:Number(d.version),revision:a.revision});await refresh(selected,'build')});
  if(root.querySelector('#agent-route'))bindForm(root.querySelector('#agent-route'),async d=>{await send(base+'/deployment','PUT',d);await refresh()});
  root.querySelectorAll('[data-unbind]').forEach(el=>el.onclick=studioActions(root,async()=>{await send(base+'/deployment/'+el.dataset.unbind,'DELETE',{});await refresh()}));
 }else{
  root.innerHTML=a.metrics.length?table([sv('النتيجة','Result'),sv('العدد','Count'),sv('متوسط المعالجة','Mean processing time')],a.metrics.map(m=>`<tr><td>${aw(m.result)}</td><td>${m.count}</td><td>${Math.round(m.mean_ms)} ms</td></tr>`)):empty(sv('لم يسجل الوكيل عمليات على القنوات بعد','No channel runs yet'));
  root.innerHTML+=a.activity.map(r=>`<p><bdi>${date(r.created_at)}</bdi> · v${r.version} · ${aw(r.result)}</p>`).join('');
 }
}
