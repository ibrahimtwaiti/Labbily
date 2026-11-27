'use strict';
const studioLabel=sv('وكلاء الذكاء الاصطناعي','AI agents');
for(const role of ['admin','supervisor']) menus[role].splice(2,0,['agents',studioLabel,'✦']);
menus.provider.push(['agentpolicy',sv('إتاحة الوكلاء','Agent access'),'✦']);
const agentWords={
 webhook:['إجراء خارجي بموافقة','Webhook with human approval'],actions:['الأدوات','Actions'],order:['استعلام عن طلب','Order lookup'],availability:['المواعيد المتاحة','Appointment availability'],pending:['قيد المعالجة','Processing'],canceled:['ألغي بعد تغيّر المحادثة','Canceled after ownership change'],rules:['الأتمتة','Automation'],draft:['مسودة','Draft'],published:['منشور','Published'],paused:['متوقف','Paused'],archived:['مؤرشف','Archived'],
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
 ${contact?`<dt>${sv('مرحلة العميل','Customer stage')}</dt><dd>${esc(({new:sv('جديد','New'),interested:sv('مهتم','Interested'),payment:sv('بانتظار الدفع','Awaiting payment'),customer:sv('عميل','Customer'),uninterested:sv('غير مهتم','Not interested')})[contact.stage]||contact.stage)}</dd><dt>${sv('رقم التواصل','Phone')}</dt><dd><bdi>${esc(contact.phone)}</bdi></dd><dt>${sv('التصنيفات','Tags')}</dt><dd>${esc(contact.tags||'—')}</dd>`:''}
 <dt>${sv('الفريق','Team')}</dt><dd>${esc(t.team||'—')}</dd></dl>${t.summary?`<p dir="auto">${esc(t.summary)}</p>`:''}
 ${(t.linked_tasks||[]).map(x=>`<p>${esc(x.title)} · ${esc(x.status)}</p>`).join('')}</details><details id="contact-history"><summary>${sv('سجل المحادثات المرتبطة','Linked conversation history')}</summary><div role="status"></div></details>`;
 const history=panel.querySelector('#contact-history');
 let pending=false,loaded=false;
 history.addEventListener('toggle',async()=>{
  if(!history.open||pending||loaded)return;
  const region=history.querySelector('[role=status]');
  pending=true;region.classList.add('loading-inline');region.textContent=sv('جارٍ تحميل السجل…','Loading history…');
  try{
   const events=await api('/v2/tickets/'+t.id+'/customer-timeline');
   region.innerHTML=events.map(e=>`<article><strong>${esc(e.channel)} · ${e.direction==='note'?sv('ملاحظة داخلية','Internal note'):e.direction==='in'?sv('من العميل','From customer'):sv('من الفريق','From team')}</strong><p dir="auto">${esc(e.excerpt)}</p><small><bdi>${epoch(e.occurred_at)}</bdi></small></article>`).join('')||esc(sv('لا توجد رسائل مرتبطة بعد.','No linked messages yet.'));
   loaded=true;
  }catch(err){region.textContent=err.message;}finally{pending=false;region.classList.remove('loading-inline');}
 });
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
 let flushBuild=null;
 const refresh=async(id=selected,key=tab)=>{if(flushBuild)await flushBuild();await agentStudioView(main,id,key)};
 const click=(id,fn)=>{main.querySelector('#'+id).onclick=studioActions(main,fn)};
 click('agent-new',async()=>{
  const root=main.querySelector('#agent-body');
  if(flushBuild){await flushBuild();flushBuild=null}
  const presets={
   reception:{name:sv('وكيل الاستقبال','Reception agent'),tone:'friendly',
    instructions:sv('رحّب بالعميل واسأله عن سبب تواصله، ثم وجّهه إلى الفريق المناسب.','Welcome the customer, ask what they need and route them to the appropriate team.'),terms:['موظف استقبال','receptionist']},
   sales:{name:sv('وكيل المبيعات','Sales agent'),tone:'professional',
    instructions:sv('استوضح احتياج العميل وأجب من المعرفة المعتمدة. حوّل طلب عرض السعر إلى موظف المبيعات.','Clarify the customer’s needs and use approved knowledge. Hand quotation requests to sales.'),terms:['عرض سعر','quotation']},
   support:{name:sv('وكيل الدعم','Support agent'),tone:'concise',
    instructions:sv('اسأل عن المشكلة وخطوات حدوثها. استخدم الحلول المعتمدة وحوّل الشكاوى إلى موظف.','Ask what happened and how to reproduce the issue. Use approved solutions and hand complaints to a person.'),terms:['شكوى','complaint']}
  };
  root.innerHTML='<h2>'+sv('وكيل جديد','New agent')+'</h2>'+studioForm('create-agent',
   select('preset',sv('قالب البداية','Starting template'),[['',sv('مسودة فارغة','Blank draft')],...Object.entries(presets).map(([key,p])=>[key,p.name])])+
   field('name',sv('اسم الوكيل','Agent name'))+area('instructions',sv('تعليمات الصياغة','Editorial instructions'),'',false),sv('إنشاء المسودة','Create draft'));
  const form=root.querySelector('form');
  form.elements.preset.onchange=()=>{const p=presets[form.elements.preset.value];form.elements.name.value=p?.name||'';form.elements.instructions.value=p?.instructions||''};
  bindForm(form,async ({preset,name,instructions})=>{
   const p=presets[preset],draft={name,instructions,tone:p?.tone||'professional',handover_terms:p?.terms||[]};
   const r=await send('/v2/agents','POST',draft);await refresh(r.id,'build')
  });
 });
 for(const el of main.querySelectorAll('[data-agent]'))el.onclick=studioActions(main,()=>refresh(el.dataset.agent,'build'));
 const root=main.querySelector('#agent-body');
 if(!a){root.innerHTML=empty(sv('اختر وكيلًا أو أنشئ مسودة','Select an agent or create a draft'));return}
 root.before(Object.assign(document.createElement('h2'),{textContent:a.name}));
 const tabs=document.createElement('nav');tabs.className='agent-tabs';tabs.setAttribute('aria-label',studioLabel);root.before(tabs);
 for(const k of ['build','knowledge','actions','rules','playground','deploy','analytics']){
  const btn=document.createElement('button');btn.type='button';btn.textContent=aw(k);btn.setAttribute('aria-pressed',String(k===tab));btn.onclick=studioActions(main,()=>refresh(selected,k));tabs.append(btn)
 }
 const base='/v2/agents/'+a.id,cfg=a.draft;
 const save=async value=>{await send(base,'PUT',{revision:a.revision,config:value});await refresh()};
 if(tab==='build'){
  root.innerHTML=studioForm('agent-build',field('name',sv('اسم الوكيل','Agent name'),'text',cfg.name)+area('instructions',sv('تعليمات الصياغة للمساعد','Copilot editorial playbook'),cfg.instructions,false)+select('language',sv('اللغة','Language'),[['auto',sv('لغة العميل','Customer language')],['ar','العربية'],['en','English']],cfg.language)+select('tone',sv('النبرة','Tone'),[['professional',sv('مهنية','Professional')],['friendly',sv('ودية','Friendly')],['concise',sv('مختصرة','Concise')]],cfg.tone)+area('terms',sv('عبارات التحويل للموظف، كل عبارة في سطر','Handover phrases, one per line'),cfg.handover_terms.join('\n'),false)+select('follow',sv('إنشاء مهمة عند طلب المتابعة','Create a task when follow-up is requested'),[['0',sv('معطل','Off')],['1',sv('مسموح','Allowed')]],String(Number(cfg.tools.includes('followup')))),sv('حفظ المسودة','Save draft'));
  flushBuild=wirePlaybook(root.querySelector('form'),cfg,a.revision,base);
 }else if(tab==='knowledge'){
  root.innerHTML=cfg.sources.map((s,i)=>`<details class="source-row"><summary>${esc(s.title)}</summary><p>${esc(s.answer)}</p><button type="button" class="light" data-remove="${i}">${sv('إزالة من المسودة','Remove from draft')}</button></details>`).join('')+studioForm('agent-source',field('title',sv('سؤال معتمد','Approved question'))+area('answer',sv('الإجابة المعتمدة','Approved answer'))+area('aliases',sv('صيغ أخرى للسؤال، كل صيغة في سطر','Alternative questions, one per line'),'',false),sv('إضافة إلى المعرفة','Add to knowledge'));
  root.querySelectorAll('[data-remove]').forEach(el=>el.onclick=studioActions(root,()=>save({...cfg,sources:cfg.sources.filter((_,i)=>i!==Number(el.dataset.remove))})));
  bindForm(root.querySelector('form'),d=>save({...cfg,sources:[...cfg.sources,{title:d.title,answer:d.answer,aliases:d.aliases.split('\n').map(x=>x.trim()).filter(Boolean)}]}));
  await mountKnowledge(root,cfg,save,refresh);
 }else if(tab==='actions'){
  await agentToolsView(root,cfg,save,refresh);
 }else if(tab==='rules'){
  await renderRules(root,cfg,save);
 }else if(tab==='playground'){
  root.innerHTML=studioForm('agent-play',area('question',sv('رسالة المحاكاة','Simulated customer message'))+select('channel',sv('قناة المحاكاة','Simulated channel'),['whatsapp','instagram','messenger'])+select('language',sv('لغة المحاكاة','Test language'),['ar','en'])+select('priority',sv('أولوية المحاكاة','Test priority'),['normal','low','high','urgent'])+select('expected',sv('حفظ كحالة اختبار','Save as a test case'),[['',sv('تجربة فقط','Run once')],...agentOpts(['answer','review','handover','followup','availability','order','webhook'])]),sv('اختبر المسودة','Test draft'))+'<output class="agent-preview" aria-live="polite"></output>'+a.scenarios.map(c=>`<p>${esc(c.question)} · ${aw(c.expected)} <button class="light small" data-case="${esc(c.id)}">${sv('إزالة','Remove')}</button></p>`).join('');
  bindForm(root.querySelector('form'),async d=>{const r=await send(base+'/playground','POST',{...d,save:!!d.expected,expected:d.expected||null});if(d.expected)await refresh();const o=main.querySelector('.agent-preview');o.textContent=[aw(r.kind),r.answer,r.source,sv('زمن التنفيذ','Duration')+' '+r.elapsed_ms+' ms',sv('حالات الاختبار الناجحة','Saved scenarios passing')+': '+(r.scenarios_passed?'✓':'—')].filter(Boolean).join('\n')});
  root.querySelectorAll('[data-case]').forEach(el=>el.onclick=studioActions(root,async()=>{await send(base+'/scenarios/'+el.dataset.case,'DELETE',{});await refresh()}));
 }else if(tab==='deploy'){
  root.innerHTML=`<p>${sv('النسخة المنشورة','Published version')} <bdi>${a.published||'—'}</bdi> · ${aw(a.state)}</p>`+studioButton('agent-publish',sv('نشر المسودة المختبرة','Publish tested draft'),false)+studioButton('agent-pause',sv('إيقاف التشغيل','Pause agent'))+studioButton('agent-archive',sv('أرشفة','Archive'))+
   (a.versions.length?studioForm('agent-restore',select('version',sv('الإصدارات','Versions'),a.versions.map(v=>[v.version,'v'+v.version+' · '+date(v.created_at)])),sv('استعادة كمسودة','Restore as draft')):'')+
   (list.accounts.length&&list.policy.live_enabled?studioForm('agent-route',select('account_id',sv('حساب القناة','Channel account'),list.accounts.map(c=>[c.id,c.label+' · '+c.channel]))+select('mode',sv('وضع التشغيل','Operating mode'),agentOpts(['suggest','internal','auto','hybrid'])),sv('ربط الحساب','Connect account')):`<p>${sv('يتطلب الربط حساب قناة متحققًا وإتاحة التشغيل من مدير المنصة.','Live routing requires a verified channel and workspace authorization.')}</p>`)+a.deployments.map(d=>`<p>${esc(d.label)} · ${aw(d.mode)} <button class="light small" data-unbind="${esc(d.account_id)}">${sv('فصل','Disconnect')}</button></p>`).join('');
  main.querySelector('#agent-publish').disabled=a.tested_revision!==a.revision||a.state==='archived';
  click('agent-publish',async()=>{await send(base+'/publish','POST',{revision:a.revision});await refresh()});
  for(const action of ['pause','archive'])click('agent-'+action,async()=>{await send(base+'/state','POST',{action,revision:a.revision});await refresh()});
  if(root.querySelector('#agent-restore')){const preview=document.createElement('details');preview.innerHTML='<summary>'+sv('مقارنة بالمسودة','Compare with draft')+'</summary><pre class="document-preview"></pre>';root.querySelector('#agent-restore').after(preview);preview.ontoggle=async()=>{if(!preview.open)return;try{const v=root.querySelector('#agent-restore select').value;const diff=await api(base+'/versions/'+v);preview.querySelector('pre').textContent=Object.keys(diff).length?JSON.stringify(diff,null,2):sv('لا توجد اختلافات','No differences')}catch(e){preview.querySelector('pre').textContent=serviceError(e)}}}
  if(root.querySelector('#agent-restore'))bindForm(root.querySelector('#agent-restore'),async d=>{await send(base+'/state','POST',{action:'restore',version:Number(d.version),revision:a.revision});await refresh(selected,'build')});
  if(root.querySelector('#agent-route'))bindForm(root.querySelector('#agent-route'),async d=>{await send(base+'/deployment','PUT',d);await refresh()});
  root.querySelectorAll('[data-unbind]').forEach(el=>el.onclick=studioActions(root,async()=>{await send(base+'/deployment/'+el.dataset.unbind,'DELETE',{});await refresh()}));
 }else{
  root.innerHTML=a.metrics.length?table([sv('النتيجة','Result'),sv('العدد','Count'),sv('متوسط المعالجة','Mean processing time')],a.metrics.map(m=>`<tr><td>${aw(m.result)}</td><td>${m.count}</td><td>${Math.round(m.mean_ms)} ms</td></tr>`)):empty(sv('لم يسجل الوكيل عمليات على القنوات بعد','No channel runs yet'));
  const costs=await api('/v2/agent-costs');if(costs.length)root.innerHTML+=`<h3>${sv('استهلاك الشركة هذا الشهر','Workspace usage this month')}</h3>`+table([sv('النموذج','Model'),sv('المهمة','Operation'),sv('رموز الإدخال / الإخراج','Input / output tokens'),'USD'],costs.map(c=>`<tr><td>${esc(c.model)}</td><td>${esc(c.operation)}</td><td>${esc(c.inputs)} / ${esc(c.outputs)}</td><td>${Number(c.priced)===Number(c.calls)?Number(c.cost).toFixed(6):'—'}</td></tr>`));
  root.innerHTML+=a.activity.map(r=>`<p><bdi>${date(r.created_at)}</bdi> · v${r.version} · ${aw(r.result)}</p>`).join('');
 }
}

function addInboxControls(main,data,views,list,open){
 const toolbar=main.querySelector('.service-toolbar');
 const advanced=document.createElement('details');
 advanced.className='inbox-options';
 advanced.innerHTML='<summary>'+sv('فلاتر المحادثات','Conversation filters')+'</summary>';
 toolbar.append(advanced);
 const controls=document.createElement('div');controls.className='service-toolbar inbox-filters';advanced.append(controls);
 const widths=document.createElement('details');widths.className='inbox-widths';widths.innerHTML='<summary>'+sv('عرض الأعمدة','Column widths')+'</summary><label>'+sv('القائمة','List')+'<input type="range" min="170" max="320" value="225" name="list"></label><label>'+sv('ملف العميل','Customer profile')+'<input type="range" min="155" max="260" value="195" name="profile"></label>';advanced.append(widths);
 for(const range of widths.querySelectorAll('input')){const key='labbily-inbox-'+range.name;try{range.value=localStorage.getItem(key)||range.value}catch{}const resize=()=>main.querySelector('.service-workspace').style.setProperty('--inbox-'+range.name,Number(range.value)+'px');resize();range.oninput=()=>{resize();try{localStorage.setItem(key,range.value)}catch{}}}
 const scopeOptions=[['all',sv('الكل','All')],['mine',sv('محادثاتي','Mine')],['unread',sv('غير مقروء','Unread')],['unassigned',sv('غير مسند','Unassigned')],['human',sv('للموظفين','Human-owned')],['snoozed',sv('مؤجل','Snoozed')]];
 controls.innerHTML=select('scope',sv('العرض','View'),scopeOptions)+field('team_filter',sv('اسم الفريق','Team name'),'text','',false)+select('order',sv('الترتيب','Sort'),[['recent',sv('الأحدث','Newest first')],['oldest',sv('الأقدم','Oldest first')]])+select('saved_view',sv('فلاتري','My filters'),[['','—'],...views.map(v=>[v.id,v.name])])+studioButton('save-inbox-view',sv('حفظ الفلتر','Save filter'))+(me.role!=='sales'?studioButton('inbox-bulk',sv('إجراء جماعي','Bulk action')):'');
 main.querySelector('#service-search').oninput=list;main.querySelector('#service-state').onchange=list;
 const scope=controls.querySelector('[name=scope]'),saved=controls.querySelector('[name=saved_view]');scope.onchange=list;
 const team=controls.querySelector('[name=team_filter]'),order=controls.querySelector('[name=order]');
 team.maxLength=120;team.oninput=list;order.onchange=list;
 saved.onchange=()=>{const v=views.find(v=>v.id===saved.value);if(v){main.querySelector('#service-search').value=v.criteria.query;main.querySelector('#service-state').value=v.criteria.status;scope.value=v.criteria.scope;team.value=v.criteria.team||'';order.value=v.criteria.order||'recent';list()}};
 controls.querySelector('#save-inbox-view').onclick=()=>modal(sv('حفظ فلتر','Save filter'),field('name',sv('اسم الفلتر','Filter name')),d=>send('/v2/inbox-views','POST',{name:d.name,criteria:{scope:scope.value,team:team.value.trim(),order:order.value,status:main.querySelector('#service-state').value,query:main.querySelector('#service-search').value}}));
 if(controls.querySelector('#inbox-bulk'))controls.querySelector('#inbox-bulk').onclick=()=>{
  const visible=[...main.querySelectorAll('.service-ticket')].map(x=>data.find(t=>t.id===x.dataset.ticket)).slice(0,50);
  if(!visible.length)return;
  const fields='<fieldset><legend>'+sv('اختر المحادثات','Select conversations')+'</legend>'+visible.map((t,i)=>`<label class="bulk-choice"><input type="checkbox" name="ticket_${i}">${esc(t.name)}</label>`).join('')+'</fieldset>'+select('action',sv('الإجراء','Action'),[['take',sv('تولّي المحادثات','Take ownership')],['wake',sv('إنهاء التأجيل','Clear snooze')],['close',sv('إغلاق','Close')]])+field('resolution',sv('سبب الإغلاق','Closure reason'),'text','',false);
  modal(sv('إجراء جماعي','Bulk action'),fields,d=>send('/v2/inbox-actions','POST',{tickets:visible.flatMap((t,i)=>d['ticket_'+i]?[{id:t.id,version:t.version}]:[]),action:d.action,resolution:d.resolution}));
 };
}
function inboxTicketActions(main,t){
 const slot=main.querySelector('#customer-context details');
 if(!slot)return;
 const buttons=document.createElement('div');buttons.className='agent-form';slot.append(buttons);
 const change=(label,action,extra={})=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className='light small';buttons.append(b);b.onclick=studioActions(buttons,async()=>{await send('/v2/inbox-actions','POST',{action,tickets:[{id:t.id,version:t.version}],...extra});await inboxView(main)})};
 if(!t.automation_paused||!t.assignee_id)change(sv('تولّي المحادثة','Take ownership'),'take');
 if(t.automation_paused&&me.role!=='sales')change(sv('إعادة المحادثة إلى الأتمتة','Release to automation'),'resume');
 if(t.snoozed_until>Date.now()/1000)change(sv('إنهاء التأجيل','Clear snooze'),'wake');
 else{const b=document.createElement('button');b.type='button';b.textContent=sv('تأجيل المحادثة','Snooze conversation');b.className='light small';buttons.append(b);
  b.onclick=()=>modal(b.textContent,field('until',sv('حتى','Until'),'datetime-local'),d=>send('/v2/inbox-actions','POST',{action:'snooze',tickets:[{id:t.id,version:t.version}],until:Math.floor(new Date(d.until).getTime()/1000)}));}
}
async function renderRules(root,cfg,save){
 const rules=cfg.rules||[];
 const fields=[['text',sv('نص الرسالة','Message contains')],['channel',sv('القناة','Channel')],['language',sv('اللغة','Language')],['priority',sv('الأولوية','Priority')]];
 const actions=[['knowledge',aw('knowledge')],...agentOpts(['handover','followup','availability','order','webhook'])];
 root.innerHTML=`<p>${sv('تُقيَّم القواعد بالترتيب عند وصول الرسالة. اسحب لتغيير الترتيب أو استخدم الأسهم.','Rules run in order on incoming messages. Drag or use the arrows to reorder.')}</p>`+rules.map((r,i)=>`<div draggable="true" data-rule="${i}" class="rule-block"><strong>${esc(fields.find(f=>f[0]===r.field)?.[1])} · ${esc(r.value)}</strong><span>↳ ${aw(r.action)} · ${sv('وإلا','Else')} ${r.otherwise==='continue'?sv('القاعدة التالية','Next rule'):aw(r.otherwise)}</span><div><button class="light small" data-move="-1" aria-label="${sv('أعلى','Move up')}" ${i===0?'disabled':''}>↑</button><button class="light small" data-move="1" aria-label="${sv('أسفل','Move down')}" ${i===rules.length-1?'disabled':''}>↓</button><button class="light small" data-remove-rule>${sv('إزالة','Remove')}</button></div></div>`).join('')+
 studioForm('rule-form',select('field',sv('إذا كان','If'),fields)+field('value',sv('القيمة','Value'))+select('action',sv('نفّذ','Then'),actions)+select('otherwise',sv('وإلا','Else'),[['continue',sv('القاعدة التالية','Next rule')],...agentOpts(['knowledge','handover'])]),sv('إضافة قاعدة للمسودة','Add draft rule'));
 const move=(i,j)=>{if(i===j||j<0||j>=rules.length)return;const next=[...rules];next.splice(j,0,...next.splice(i,1));return save({...cfg,rules:next})};
 let from=null;
 root.querySelectorAll('[data-rule]').forEach(el=>{
  const i=Number(el.dataset.rule);el.ondragstart=()=>{from=i};el.ondragover=e=>e.preventDefault();el.ondrop=async e=>{e.preventDefault();if(from!==null)try{await move(from,i)}catch(err){toast(err.message)}from=null};
  el.querySelectorAll('[data-move]').forEach(b=>b.onclick=studioActions(root,()=>move(i,i+Number(b.dataset.move))));
  el.querySelector('[data-remove-rule]').onclick=studioActions(root,()=>save({...cfg,rules:rules.filter((_,n)=>i!==n)}));
 });
 bindForm(root.querySelector('form'),r=>save({...cfg,rules:[...rules,r]}));
}
async function agentToolsView(root,cfg,save,refresh){
 const [connections,approvals]=await Promise.all([api('/v2/agent-connections'),api('/v2/agent-approvals')]);
 const yesno=[['0',sv('معطل','Off')],['1',sv('مسموح','Allowed')]];
 root.innerHTML=studioForm('allowed-tools',select('model_routing',sv('استخدام النموذج المعتمد لمطابقة الأسئلة غير المعروفة','Use the approved model to match unfamiliar questions'),yesno,String(Number(!!cfg.model_routing)))+['followup','availability','order','webhook'].map(k=>select(k,aw(k),yesno,String(Number(cfg.tools.includes(k))))).join(''),sv('حفظ صلاحيات المسودة','Save draft permissions'))+
 `<h3>${sv('الأنظمة المرتبطة بالشركة','Workspace connections')}</h3>`+connections.map(c=>`<p><strong>${aw(c.kind)}</strong> · <bdi>${esc(c.endpoint)}</bdi> ${me.role==='admin'?`<button type="button" class="light" data-disconnect="${esc(c.kind)}">${sv('فصل','Disconnect')}</button>`:''}</p>`).join('')+
 (me.role==='admin'?studioForm('connect-tool',select('kind',sv('نوع الاستعلام','Lookup type'),agentOpts(['availability','order','webhook']))+field('endpoint',sv('رابط واجهة القراءة HTTPS','Read-only HTTPS endpoint'),'url')+`<label class="field">${sv('رمز القراءة أو مفتاح توقيع Webhook','Read token or webhook signing secret')}<input type="password" autocomplete="off" name="token"></label>`,sv('حفظ الاتصال','Save connection')):'');
 const queue=document.createElement('div');root.append(queue);
 if(approvals.length)queue.innerHTML='<h3>'+sv('موافقات الإجراءات','Action approvals')+'</h3>'+approvals.map(j=>`<div class="source-row"><b>${esc(j.name)}</b> · ${aw('webhook')} · <bdi>${esc(j.ticket_id)}</bdi><p>${esc(connections.find(c=>c.kind==='webhook')?.endpoint||'—')}</p>${j.state==='approval'?'<button class="light" data-yes="'+esc(j.id)+'">'+sv('موافقة على الإرسال','Approve dispatch')+'</button><button class="light" data-no="'+esc(j.id)+'">'+sv('رفض','Decline')+'</button>':sv('الحصيلة غير مؤكدة؛ راجع النظام المستلم','Outcome unknown. Reconcile with the receiver.')}</div>`).join('');
 queue.querySelectorAll('button').forEach(b=>b.onclick=studioActions(queue,async()=>{await send('/v2/agent-approvals/'+(b.dataset.yes||b.dataset.no),'POST',{approve:!!b.dataset.yes});await refresh()}));
 bindForm(root.querySelector('#allowed-tools'),d=>save({...cfg,model_routing:d.model_routing==='1',tools:['followup','availability','order','webhook'].filter(k=>d[k]==='1')}));
 if(root.querySelector('#connect-tool'))bindForm(root.querySelector('#connect-tool'),async d=>{await send('/v2/agent-connections/'+d.kind,'PUT',{endpoint:d.endpoint,token:d.token});await refresh()});
 root.querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=studioActions(root,async()=>{await send('/v2/agent-connections/'+b.dataset.disconnect,'DELETE',{});await refresh()}));
}
function wirePlaybook(form,initial,revision,base){
 const out=document.createElement('small');out.setAttribute('role','status');form.append(out);
 let timer,saving=Promise.resolve(),signature=null;
 const collect=()=>{const d=formData(form);return {...initial,name:d.name,instructions:d.instructions,language:d.language,tone:d.tone,handover_terms:d.terms.split('\n').map(x=>x.trim()).filter(Boolean),tools:[...initial.tools.filter(k=>k!=='followup'),...(d.follow==='1'?['followup']:[])]}};
 signature=JSON.stringify(collect());
 const flush=()=>{
  clearTimeout(timer);
  saving=saving.catch(()=>{}).then(async()=>{
   const config=collect(),next=JSON.stringify(config);
   if(signature===next)return;
   if(!form.reportValidity())throw Error(sv('أكمل الحقول المطلوبة','Complete required fields'));
   out.classList.add('loading-inline');out.textContent=sv('جارٍ حفظ المسودة…','Saving draft…');
   try{const r=await send(base,'PUT',{revision,config});revision=r.revision;signature=next;out.textContent=sv('حُفظت المسودة','Draft saved')}
   catch(e){out.textContent=serviceError(e);throw e}
   finally{out.classList.remove('loading-inline')}
  });return saving;
 };
 form.addEventListener('input',()=>{clearTimeout(timer);out.textContent=sv('تغييرات في المسودة','Draft changes');timer=setTimeout(()=>flush().catch(()=>{}),900)});
 bindForm(form,flush);return flush;
}
async function mountKnowledge(root,cfg,save,refresh){
 const docs=await api('/v2/agent-knowledge');
 const block=document.createElement('section');block.className='agent-library';root.append(block);
 block.innerHTML=`<h3>${sv('مكتبة الشركة','Workspace library')}</h3>`+docs.map(d=>`<details class="source-row" data-doc="${esc(d.id)}"><summary>${esc(d.title)} · ${d.status==='approved'?sv('معتمد','Approved'):sv('قيد المراجعة','Needs review')}</summary><div></div></details>`).join('')+
 studioForm('import-source',field('title',sv('عنوان المصدر','Source title'))+area('text',sv('نص المقالة','Article text'),'',false)+field('url',sv('أو رابط صفحة عامة','Or a public page URL'),'url','',false)+`<label class="field">${sv('أو ملف PDF أو Word أو نص حتى 1 MB','Or a PDF, Word or text file up to 1 MB')}<input type="file" name="attachment" accept=".pdf,.docx,.txt"></label>`,sv('استيراد للمراجعة','Import for review'));
 block.querySelector('textarea').maxLength=18000;
 for(const element of block.querySelectorAll('[data-doc]')){
  element.ontoggle=async()=>{
   const pane=element.querySelector('div');if(!element.open||pane.children.length)return;
   try{
    const doc=await api('/v2/agent-knowledge/'+element.dataset.doc);pane.innerHTML=`<p>${sv('الفهرس الدلالي','Semantic index')}: ${esc(doc.index_state||'none')}${doc.sync_error?' · '+esc(doc.sync_error):''}</p><pre class="document-preview">${esc(doc.content)}</pre>`;
    const action=(txt,fn)=>{const b=document.createElement('button');b.type='button';b.className='light small';b.textContent=txt;b.onclick=studioActions(pane,fn);pane.append(b)};
    if(doc.status!=='approved')action(sv('اعتماد النص المعروض','Approve this text'),async()=>{await send('/v2/agent-knowledge/'+doc.id+'/approve','POST',{checksum:doc.checksum});await refresh()});
    const ids=cfg.document_ids||[];
    if(doc.status==='approved'||ids.includes(doc.id))action(ids.includes(doc.id)?sv('فصل عن المسودة','Detach from draft'):sv('استخدام في المسودة','Use in draft'),()=>save({...cfg,document_ids:ids.includes(doc.id)?ids.filter(id=>id!==doc.id):[...ids,doc.id]}));
    action(sv('فهرسة دلالية','Build semantic index'),async()=>{await send('/v2/agent-knowledge/'+doc.id+'/index','POST',{});await refresh()});
    if(doc.source_url){const selectBox=document.createElement('div');selectBox.innerHTML=select('sync',sv('تكرار المزامنة','Refresh schedule'),[['0',sv('يدوي','Manual')],['24',sv('يومي','Daily')],['168',sv('أسبوعي','Weekly')]],String(doc.sync_hours||0));pane.append(selectBox);selectBox.querySelector('select').onchange=async e=>{try{await send('/v2/agent-knowledge/'+doc.id+'/schedule','PUT',{hours:Number(e.target.value)});toast(tr('تم الحفظ بنجاح'))}catch(err){toast(err.message)}}}
    if(doc.source_url)action(sv('مزامنة الصفحة','Refresh page'),async()=>{await send('/v2/agent-knowledge/'+doc.id+'/refresh','POST',{});await refresh()});
   }catch(e){pane.textContent=serviceError(e)}
  };
 }
 const form=block.querySelector('#import-source');bindForm(form,async d=>{
  const file=form.elements.attachment.files[0];
  if(file&&file.size>1048576)throw Error(sv('حد الملف 1 MB','File limit is 1 MB'));
  const encoded=file?await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.slice(r.result.indexOf(',')+1));r.onerror=no;r.readAsDataURL(file)}):'';
  await send('/v2/agent-knowledge/import','POST',{title:d.title,text:d.text,url:d.url,filename:file?.name||'',encoded});await refresh();
 });
}
