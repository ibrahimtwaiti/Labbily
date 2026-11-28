'use strict';
const settingsGroups=[
 [sv('المؤسسة','Organization'),'team',[
  ['organization',sv('عام','General'),sv('اسم المؤسسة والمنطقة الزمنية','Organization name and time zone')],
  ['members',sv('الأعضاء','Members'),sv('الحسابات والأدوار وحالة الوصول','Accounts, roles and access')],
  ['teams',sv('الفرق','Teams'),sv('توزيع أعضاء المؤسسة على فرق العمل','Organize colleagues into teams')],
  ['hours',sv('ساعات العمل','Business hours'),sv('أيام الدوام ومواعيد الاستجابة بتوقيت الرياض','Working days and hours in Riyadh')]]],
 [sv('جهات الاتصال','Contacts'),'contacts',[
  ['stages',sv('مراحل جهات الاتصال','Contact stages'),sv('مراحل المسار المعروضة في لوحة العملاء','Stages used by the contact board')],
  ['fields',sv('حقول العملاء المخصصة','Custom contact fields'),sv('الخصائص التي تظهر في ملف العميل','Properties shown on each contact profile')]]],
 [sv('صندوق الوارد','Inbox'),'messages',[
  ['replies',sv('الردود السريعة','Quick replies'),sv('رسائل محفوظة متاحة لموظفي المحادثات','Saved messages for the conversation composer')],
  ['notifications',sv('إعدادات الإشعارات','Notifications'),sv('تنبيهات الإشارة إليك في ملاحظات الفريق','Mentions in internal notes')]]],
 [sv('مدير واتساب','WhatsApp manager'),'integrations',[
  ['templates',sv('قوالب واتساب','WhatsApp templates'),sv('المسودات والقوالب المتزامنة مع Meta','Local drafts and templates synchronized from Meta')],
  ['library',sv('مكتبة القوالب','Template library'),sv('نماذج رسائل قابلة للتخصيص حسب النشاط','Industry-specific message starters')],
  ['costs',sv('استهلاك رسائل Meta','Meta messaging costs'),sv('حجم الرسائل وتكلفتها من حساب واتساب للأعمال','Volume and costs from the WhatsApp business account')]]]
];
function settingsHref(key){const url=new URL('/app/settings',location.origin);url.searchParams.set('section',key);url.searchParams.set('lang',LANG);return url.pathname+url.search}
const settingLink=(key,label)=>'<a href="'+settingsHref(key)+'">'+esc(label)+'</a>';
function messagePreview(body){return '<div class="wa-preview"><div class="wa-bubble" dir="auto">'+esc(body).replace(/\{\{\d+\}\}/g,v=>'<mark>'+v+'</mark>')+'</div></div>'}
function templateEditor(t,existing=false){
 modal(existing?sv('تعديل المسودة','Edit draft'):sv('استخدام النموذج','Use template'),
 (existing?'<p class="full"><bdi>'+esc(t.name)+'</bdi> · '+esc(t.language)+'</p>':field('name',sv('اسم القالب بالحروف اللاتينية','Template identifier'),'text',t.name)+select('language',sv('لغة القالب','Template language'),[['ar','العربية'],['en','English']],t.language))+
 select('category',sv('فئة الرسالة','Category'),[['UTILITY',sv('خدمي','Utility')],['MARKETING',sv('تسويقي','Marketing')]],t.category)+area('body',sv('نص الرسالة','Message body'),t.body),
 d=>send('/v2/workspace/template-drafts'+(existing?'/'+t.id:''),existing?'PUT':'POST',{...d,name:d.name||t.name,language:d.language||t.language}));
 dialog.querySelector('textarea').maxLength=1024;
}
function templateLibrary(panel){
 let group='',query='';
 panel.innerHTML='<div class="library-layout"><nav class="industry-list"></nav><section><input class="search" type="search" id="template-search" aria-label="'+sv('بحث في القوالب','Search templates')+'" placeholder="'+sv('ابحث باسم النموذج أو نص الرسالة…','Search names and messages…')+'"><div class="library-cards"></div></section></div>';
 const nav=panel.querySelector('nav'),grid=panel.querySelector('.library-cards');
 const all=industryCatalog.flatMap(([id,label,items])=>items.map(([name,title,body,marketing])=>({id,label,name,title,body,category:marketing?'MARKETING':'UTILITY',language:'ar'})));
 function draw(){
  nav.innerHTML=[['',sv('كل الأنشطة','All industries'),all],...industryCatalog].map(([id,label,items])=>'<button class="light" data-industry="'+id+'" aria-pressed="'+(group===id)+'">'+label+' <small>'+items.length+'</small></button>').join('');
  nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{group=b.dataset.industry;draw()});
  const filtered=all.filter(t=>(!group||t.id===group)&&(t.title+' '+t.name+' '+t.body).toLowerCase().includes(query));
  grid.innerHTML=filtered.map(t=>'<article class="template-card"><small>'+t.label+' · '+(t.category==='UTILITY'?sv('خدمي','Utility'):sv('تسويقي','Marketing'))+' · AR</small><h3>'+t.title+'</h3><bdi>'+t.name+'</bdi>'+messagePreview(t.body)+'<button data-model="'+t.name+'">'+sv('استخدم النموذج','Use template')+'</button></article>').join('')||empty(sv('لا توجد قوالب مطابقة','No matching templates'));
  grid.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>templateEditor(all.find(t=>t.name===b.dataset.model)));
 }
 panel.querySelector('input').oninput=e=>{query=e.target.value.trim().toLowerCase();draw()};draw();
}
async function workspaceSettings(main){
 const key=new URLSearchParams(location.search).get('section')||'home';
 const match=settingsGroups.flatMap(g=>g[2]).find(i=>i[0]===key);
 const home=sv('إعدادات مساحة العمل','Workspace settings');
 main.innerHTML='<div class="settings-shell"><aside class="settings-nav"><h2>'+sv('الإعدادات','Settings')+'</h2>'+settingLink('home',sv('الرئيسية','Settings home'))+settingsGroups.map(([label,symbol,items])=>'<details '+(items.some(i=>i[0]===key)?'open':'')+'><summary>'+icon(symbol)+label+'</summary>'+items.map(([id,title])=>'<a href="'+settingsHref(id)+'" '+(id===key?'aria-current="page"':'')+'>'+title+'</a>').join('')+'</details>').join('')+'</aside><section class="settings-content"><header><button id="settings-toggle" type="button" class="light" aria-label="'+sv('تبديل الشريط الجانبي الفرعي','Toggle settings sidebar')+'">'+icon('settings')+'</button><h1>'+esc(match?.[1]||home)+'</h1></header><section id="settings-panel"></section></section></div>';
 const shell=main.firstElementChild,panel=main.querySelector('#settings-panel'),toggle=main.querySelector('#settings-toggle');
 let collapsed=sessionStorage.getItem('labbily.settings.collapsed')==='1'||(matchMedia('(max-width:760px)').matches&&!!match);
 function paint(){shell.classList.toggle('settings-collapsed',collapsed);toggle.setAttribute('aria-expanded',String(!collapsed))}
 toggle.onclick=()=>{collapsed=!collapsed;sessionStorage.setItem('labbily.settings.collapsed',collapsed?'1':'0');paint()};paint();
 if(!match){
  panel.innerHTML=settingsGroups.map(([group,symbol,items])=>'<section class="settings-group"><h2>'+group+'</h2><div class="catalog-grid">'+items.map(([id,name,desc])=>'<a class="settings-tile" href="'+settingsHref(id)+'"><span class="tile-icon">'+icon(symbol)+'</span><span><strong>'+name+'</strong><small>'+desc+'</small></span>'+icon('arrow')+'</a>').join('')+'</div></section>').join('');return;
 }
 if(key==='library'){templateLibrary(panel);return}
 if(key==='members'){await teamView(panel);return}
 const save=sv('حفظ التغييرات','Save changes');
 function action(id,fn){panel.querySelector('#'+id).onclick=studioActions(panel,fn)}
 if(key==='organization'){
  const org=await api('/v2/workspace/organization');panel.innerHTML=studioForm('org-form',field('name',sv('اسم المؤسسة','Organization name'),'text',org.name)+'<p><bdi>'+esc(org.timezone)+'</bdi></p>',save);
  bindForm(panel.querySelector('form'),async d=>{await send('/v2/workspace/organization','PUT',d);toast(sv('تم حفظ اسم المؤسسة','Organization name saved'))});return;
 }
 if(key==='stages'){
  const crm=await api('/v2/crm/settings'),defaultStages=LANG==='en'?['New','Interested','Awaiting payment','Customer','Not interested']:['جديد','مهتم','بانتظار الدفع','عميل','غير مهتم'];
  panel.innerHTML=studioButton('create-stage',sv('إضافة مرحلة','Add stage'),false)+table([sv('المرحلة','Stage'),sv('النوع','Type')],[...defaultStages.map(t=>[t,sv('افتراضية','Default')]),...crm.stages.map(s=>[s.name,sv('مخصصة','Custom')])].map(([name,type])=>'<tr><td>'+esc(name)+'</td><td>'+type+'</td></tr>'));
  action('create-stage',()=>modal(sv('إضافة مرحلة','Add stage'),field('name',sv('اسم المرحلة','Stage name')),d=>send('/v2/crm/stages','POST',d)));return;
 }
 if(key==='teams'){
  const [teams,members]=await Promise.all([api('/v2/workspace/teams'),api('/team')]);
  function edit(t){modal(t?t.name:sv('إنشاء فريق','Create team'),field('name',sv('اسم الفريق','Team name'),'text',t?.name||'')+'<fieldset class="full check-options"><legend>'+sv('الأعضاء','Members')+'</legend>'+members.filter(m=>m.active).map(m=>'<label><input type="checkbox" name="member" value="'+esc(m.id)+'" '+(t?.members.includes(m.id)?'checked':'')+'>'+esc(m.name)+'</label>').join('')+'</fieldset>',(d,f)=>send('/v2/workspace/teams'+(t?'/'+t.id:''),t?'PUT':'POST',{name:d.name,members:new FormData(f).getAll('member'),revision:t?.revision||0}))}
  panel.innerHTML=studioButton('add-team',sv('إنشاء فريق','Create team'),false)+table([sv('الفريق','Team'),sv('الأعضاء','Members'),''],teams.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+members.filter(m=>t.members.includes(m.id)).map(m=>esc(m.name)).join('، ')+'</td><td><button class="light" data-edit="'+esc(t.id)+'">'+sv('تعديل','Edit')+'</button></td></tr>'));
  action('add-team',()=>edit(null));panel.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(teams.find(t=>t.id===b.dataset.edit)));return;
 }
 if(key==='fields'){
  const fields=await api('/v2/workspace/fields'),types=[['text',sv('نص','Text')],['number',sv('رقم','Number')],['date',sv('تاريخ','Date')]];
  panel.innerHTML=studioButton('new-field',sv('إضافة حقل','Add field'),false)+table([sv('اسم الحقل','Field name'),sv('النوع','Type')],fields.map(f=>'<tr><td>'+esc(f.name)+'</td><td>'+new Map(types).get(f.kind)+'</td></tr>'));
  action('new-field',()=>modal(sv('حقل جديد','New field'),field('name',sv('اسم الحقل','Field name'))+select('kind',sv('النوع','Type'),types),d=>send('/v2/workspace/fields','POST',d)));return;
 }
 if(key==='hours'){
  const c=await api('/v2/settings'),days=LANG==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد'];
  panel.innerHTML=studioForm('business-hours','<p>Asia/Riyadh · UTC+3</p><fieldset class="check-options"><legend>'+sv('أيام العمل','Working days')+'</legend>'+days.map((day,i)=>'<label><input type="checkbox" name="day" value="'+i+'" '+(c.workdays.includes(i)?'checked':'')+'>'+day+'</label>').join('')+'</fieldset>'+field('start_hour',sv('ساعة بداية الدوام','Opening hour'),'number',c.start_hour)+field('end_hour',sv('ساعة نهاية الدوام','Closing hour'),'number',c.end_hour),save);
  bindForm(panel.querySelector('form'),async(d,f)=>{await send('/v2/workspace/hours','PUT',{workdays:new FormData(f).getAll('day').map(Number),start_hour:Number(d.start_hour),end_hour:Number(d.end_hour)});toast(save)});return;
 }
 if(key==='notifications'){await notificationSettings(panel);return}
 if(key==='replies'){
  const replies=await api('/v2/replies');
  function edit(r){modal(sv('الرد السريع','Quick reply'),field('title',sv('العنوان','Title'),'text',r?.title||'')+area('body',sv('نص الرد','Reply text'),r?.body||''),d=>send('/v2/replies'+(r?'/'+r.id:''),r?'PUT':'POST',d))}
  panel.innerHTML=studioButton('new-reply',sv('إضافة رد سريع','Add quick reply'),false)+table([sv('العنوان','Title'),sv('الرسالة','Message'),''],replies.map(r=>'<tr><td>'+esc(r.title)+'</td><td>'+esc(r.body)+'</td><td><button data-reply="'+esc(r.id)+'" class="light">'+sv('تعديل','Edit')+'</button></td></tr>'));
  action('new-reply',()=>edit(null));panel.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>edit(replies.find(r=>r.id===b.dataset.reply)));return;
 }
 const accounts=(await api('/v2/accounts')).accounts.filter(a=>a.channel==='whatsapp'&&a.state!=='disconnected');
 const accountSelect=select('account',sv('رقم واتساب','WhatsApp number'),accounts.map(a=>[a.id,a.label+' · '+a.provider_id]));
 const noAccount='<p>'+sv('اربط حساب واتساب للأعمال من دليل التطبيقات لقراءة بياناته.','Connect a WhatsApp business account to read its data.')+'</p><a class="button light" href="/app/channels?app=whatsapp">'+sv('ربط واتساب','Connect WhatsApp')+'</a>';
 if(key==='templates'){
  const [templates,drafts,readiness]=await Promise.all([api('/v2/templates'),api('/v2/workspace/template-drafts'),api('/v2/meta/readiness')]);
  const connections=readiness.connections||[];

  panel.innerHTML='<div class="setting-block">'+(accounts.length?studioForm('sync-templates',accountSelect+field('business_account_id',sv('معرّف حساب واتساب للأعمال (WABA)','WhatsApp business account ID')) ,sv('مزامنة من Meta','Sync from Meta')):noAccount)+'</div><h2>'+sv('قوالب الحساب','Account templates')+'</h2>'+table([sv('الاسم','Name'),sv('اللغة','Language'),sv('الحالة لدى Meta','Meta status')],templates.map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+esc(t.language)+'</td><td>'+esc(t.status)+'</td></tr>'))+'<h2>'+sv('مسودات المؤسسة','Workspace drafts')+'</h2>'+settingLink('library',sv('اختيار نموذج من المكتبة','Choose from the library'))+table([sv('الاسم','Name'),sv('النص','Body'),''],drafts.map(d=>'<tr><td>'+esc(d.name)+'</td><td>'+esc(d.body)+'</td><td><button class="light" data-draft="'+esc(d.id)+'">'+sv('تعديل','Edit')+'</button> '+(connections.length?'<button class="light" data-review="'+esc(d.id)+'">'+sv('إرسال للمراجعة','Submit for review')+'</button>':'')+'</td></tr>'));
  const form=panel.querySelector('form');if(form){
   const fill=()=>{form.elements.business_account_id.value=connections.find(c=>c.account_id===form.elements.account.value)?.business_account_id||''};
   form.elements.account.onchange=fill;fill();
  }
  panel.querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{
   const draft=drafts.find(d=>d.id===b.dataset.review),params=[...new Set(draft.body.match(/\{\{\d+\}\}/g)||[])].sort((a,b)=>Number(a.slice(2,-2))-Number(b.slice(2,-2)));
   modal(sv('إرسال القالب إلى Meta للمراجعة','Submit template to Meta for review'),select('account_id',sv('الحساب','Account'),connections.map(c=>[c.account_id,c.label]))+messagePreview(draft.body)+params.map((v,i)=>field('sample'+i,sv('مثال للمتغير','Example for')+' '+v)).join(''),async d=>{const out=await send('/v2/workspace/template-drafts/'+draft.id+'/submit','POST',{account_id:d.account_id,examples:params.map((_,i)=>d['sample'+i])});toast(esc(out.status))});
  });
  if(form)bindForm(form,async d=>{const r=await send('/v2/accounts/'+d.account+'/templates/sync','POST',{business_account_id:d.business_account_id});toast(sv('تمت مزامنة القوالب','Templates synchronized')+' · '+r.count);await workspaceSettings(main)});
  panel.querySelectorAll('[data-draft]').forEach(b=>b.onclick=()=>templateEditor(drafts.find(d=>d.id===b.dataset.draft),true));return;
 }
 if(key==='costs'){
  panel.innerHTML='<div class="setting-block"><p>'+sv('التكلفة التقريبية لحساب واتساب للأعمال كما ترد من Meta بعملة الحساب.','Estimated cost for the business account, reported by Meta in its account currency.')+'</p>'+(accounts.length?studioForm('read-costs',accountSelect+select('days',sv('الفترة','Period'),[['7',sv('آخر 7 أيام','Last 7 days')],['30',sv('آخر 30 يومًا','Last 30 days')]]),sv('جلب الاستهلاك','Load usage')):noAccount)+'</div><div id="cost-results" aria-live="polite"></div>';
  const form=panel.querySelector('form');if(form)bindForm(form,async d=>{const out=panel.querySelector('#cost-results');out.replaceChildren();const r=await api('/v2/workspace/accounts/'+d.account+'/costs?days='+d.days);
   out.innerHTML=r.points.length?table([sv('اليوم','Day'),sv('عدد الرسائل','Volume'),sv('التكلفة','Cost')+' '+esc(r.currency||'')],r.points.map(p=>'<tr><td>'+esc(epoch(p.start))+'</td><td>'+esc(p.volume??'—')+'</td><td>'+esc(p.cost??'—')+'</td></tr>')):empty(sv('لم تُرجع Meta بيانات لهذه الفترة','Meta returned no data for this period'))});return;
 }
}

async function notificationSettings(panel){
 const c=await api('/v2/workspace/notifications'),hours=[['',sv('بدون كتم مجدول','No quiet period')],...Array.from({length:24},(_,h)=>[String(h),String(h).padStart(2,'0')+':00'])];
 panel.innerHTML=studioForm('notification-prefs',select('mentions',sv('إشعارات الإشارة إليّ في الملاحظات الداخلية','Notify me about mentions in internal notes'),[['yes',sv('مفعلة','On')],['no',sv('مكتومة','Muted')]],c.mentions?'yes':'no')+
 select('quiet_start',sv('بداية ساعات الهدوء · الرياض','Quiet hours start · Riyadh'),hours,String(c.quiet_start??''))+select('quiet_end',sv('نهاية ساعات الهدوء · الرياض','Quiet hours end · Riyadh'),hours,String(c.quiet_end??'')),sv('حفظ التفضيلات','Save preferences'));
 bindForm(panel.querySelector('form'),async d=>{await send('/v2/workspace/notifications','PUT',{mentions:d.mentions==='yes',quiet_start:d.quiet_start===''?null:Number(d.quiet_start),quiet_end:d.quiet_end===''?null:Number(d.quiet_end)});toast(sv('حُفظ تفضيلك','Preference saved'))});
}
