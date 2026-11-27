'use strict';
for(const [key,label,symbol] of [
 ['setup',sv('قائمة الإعداد','Getting started'),'dashboard'],
 ['campaigns',sv('الحملات','Campaigns'),'campaigns'],
 ['settings',sv('الإعدادات','Settings'),'settings']
]){
 workspaceIcons[key]=symbol;
 if(key==='setup')menus.admin.splice(1,0,[key,label,'']);else menus.admin.push([key,label,'']);
}
workspaceIcons.lifecycle='analytics';
for(const role of ['admin','supervisor','reader'])menus[role].push(['lifecycle',sv('دورة حياة العميل','Contact lifecycle'),'']);
function workspaceSettings(main){
 const groups=[
  [sv('المؤسسة','Organization'),['account','team','billing','audit']],
  [sv('إدارة العملاء','Customer management'),['contacts','tasks','lifecycle','reports']],
  [sv('المحادثات والأتمتة','Conversations & automation'),['channels','inbox','agents','workflows','campaigns']]
 ];
 const links=new Map(menus[me.role].map(([key,name])=>[key,name]));links.set('account',sv('حسابي','My account'));
 main.innerHTML=heading(sv('الإعدادات','Settings'),sv('إعدادات المؤسسة ومساحة العمل','Organization and workspace settings'))+groups.map(([title,keys])=>'<section class="settings-group"><h2>'+title+'</h2><div class="catalog-grid">'+keys.filter(k=>links.has(k)).map(k=>'<a class="settings-tile" href="/app/'+k+'"><span class="tile-icon">'+icon(workspaceIcons[k])+'</span><strong>'+esc(links.get(k))+'</strong>'+icon('arrow')+'</a>').join('')+'</div></section>').join('');
}
async function workspaceSetup(main){
 const state=await api('/v2/workspace-setup'),steps=[
  ['channel','channels',sv('القناة','Channel'),sv('اربط أول قناة تواصل','Connect your first channel'),sv('اختر واتساب أو إنستغرام أو ماسنجر، ثم راجع جاهزية الحساب.','Select WhatsApp, Instagram or Messenger and review account readiness.')],
  ['team','team',sv('الفريق','Team'),sv('أضف أول عضو في الفريق','Add your first teammate'),sv('حدّد دور العضو والصلاحيات التي يحتاجها.','Choose the member’s role and access.')],
  ['stages','contacts',sv('المراحل','Stages'),sv('خصّص مراحل جهات الاتصال','Customize contact stages'),sv('أضف مرحلة تعبّر عن مسار العميل في مؤسستك.','Create a stage that reflects your customer journey.')],
  ['conversation','inbox',sv('المحادثة','Conversation'),sv('استقبل أول محادثة','Receive a conversation'),sv('تظهر المحادثة عند استقبال حدث من قناة مهيّأة.','Conversations appear when a configured channel receives an event.')],
  ['agent','agents',sv('الوكيل الذكي','AI agent'),sv('جهّز أول وكيل وانشره','Set up and publish an agent'),sv('اختر نموذجًا واختبر إجاباته من المعرفة المعتمدة قبل النشر.','Choose a template and test its answers against approved knowledge before publication.')]
 ];
 const done=steps.filter(([k])=>state[k]).length,next=steps.find(([k])=>!state[k])?.[0];
 main.innerHTML=heading(sv('قائمة الإعداد','Getting started'),sv('إعداد مساحة العمل','Workspace setup'))+
 '<div class="setup-wrap"><section class="setup-hero"><small>Labbily</small><h2>'+sv('مرحبًا بك في مساحة العمل','Welcome to your workspace')+'</h2><p>'+sv('اربط قنواتك وجهّز فريقك لاستقبال العملاء.','Connect your channels and prepare your team to welcome customers.')+'</p><nav>'+
 steps.map(([key,route,label])=>'<a href="/app/'+route+'"><span>'+icon(state[key]?'check':workspaceIcons[route])+'</span>'+label+'</a>').join('')+'</nav><footer>'+sv('الخطوات المكتملة','Completed steps')+' <bdi>'+done+' / 5</bdi></footer></section>'+
 '<section class="setup-checklist">'+steps.map(([key,route,label,title,desc])=>'<details '+(key===next?'open':'')+'><summary><span class="tile-icon">'+icon(state[key]?'check':workspaceIcons[route])+'</span><strong>'+title+'</strong><small>'+ (state[key]?sv('مكتملة','Complete'):key===next?sv('الخطوة التالية','Next step'):'')+'</small></summary><p>'+desc+'</p><a class="button light" href="/app/'+route+'">'+sv('فتح','Open')+' '+label+'</a></details>').join('')+'</section></div>';
}
async function lifecycleReport(main){
 const data=await api('/v2/lifecycle-report');
 const stages=[['new',sv('جديد','New')],['interested',sv('مهتم','Interested')],['payment',sv('بانتظار الدفع','Awaiting payment')],['customer',sv('عميل','Customer')],['uninterested',sv('غير مهتم','Not interested')],...data.stages.map(s=>[s.id,s.name])],labels=new Map(stages);
 const counts=new Map(data.distribution.map(s=>[s.stage,Number(s.total)])),total=[...counts.values()].reduce((a,b)=>a+b,0);
 main.innerHTML=heading(sv('دورة حياة جهة الاتصال','Contact lifecycle'),sv('التوزيع الحالي لجهات الاتصال وآخر تغييرات المراحل','Current contact distribution and latest stage changes'))+
 '<div class="stage-report">'+stages.map(([id,name])=>'<article class="catalog-card"><small>'+esc(name)+'</small><strong>'+ (counts.get(id)||0)+'</strong><progress max="'+(total||1)+'" value="'+(counts.get(id)||0)+'"></progress></article>').join('')+'</div><h2>'+sv('آخر تغييرات المراحل','Latest stage changes')+'</h2>'+
 (data.changes.length?table([sv('العميل','Customer'),sv('المرحلة','Stage'),sv('التاريخ','Date')],data.changes.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(labels.get(c.stage)||c.stage)+'</td><td>'+esc(date(c.changed_at))+'</td></tr>')):empty(sv('لم تُسجّل تغييرات في المراحل بعد','No stage changes recorded yet')));
}
async function campaignDirectory(main){
 const data=await api('/v2/campaigns');
 const states=[['draft',aw('draft')],['planned',sv('مخططة','Planned')],['paused',aw('paused')]],names=new Map(states);
 const channels=[['whatsapp','WhatsApp'],['instagram','Instagram'],['messenger','Messenger']];
 const metrics=[['queued',sv('في الانتظار','Queued')],['accepted',sv('مقبولة','Accepted')],['sent',sv('مرسلة','Sent')],['delivered',sv('مسلّمة','Delivered')],['read',sv('مقروءة','Read')],['failed',sv('فشلت','Failed')]];
 main.innerHTML=heading(sv('الحملات','Campaigns'),sv('تخطيط الحملات ومتابعة رسائل المحادثات المنسوبة إليها','Plan campaigns and track messages from attributed conversations'),studioButton('new-campaign',sv('＋ حملة جديدة','＋ New campaign'),false))+
 '<div class="stage-report">'+metrics.map(([k,l])=>'<article class="catalog-card"><small>'+l+'</small><strong>'+data.metrics.filter(m=>m.status===k).reduce((n,m)=>n+Number(m.total),0)+'</strong></article>').join('')+'</div>'+
 '<div class="studio-tools"><input class="search" type="search" id="campaign-search" aria-label="'+sv('بحث الحملات','Search campaigns')+'" placeholder="'+sv('ابحث في الحملات…','Search campaigns…')+'">'+select('state',sv('الحالة','Status'),[['',sv('الكل','All')],...states])+'</div><section id="campaign-list"></section>';
 function edit(c){
  modal(c?sv('تعديل خطة الحملة','Edit campaign plan'):sv('خطة حملة جديدة','New campaign plan'),
    (c?'<p class="full">'+esc(c.name)+' · '+esc(c.channel)+'</p>':field('name',sv('اسم الحملة','Campaign name'))+select('channel',sv('القناة','Channel'),channels))+
    select('segment_id',sv('الشريحة المستهدفة','Target segment'),[['',sv('كل العملاء','All contacts')],...data.segments.map(x=>[x.id,x.name])],c?.segment_id||'')+
    area('body',sv('نص الرسالة المقترح','Planned message'),c?.body||'')+
    field('planned_at',sv('الموعد المخطط بتوقيت الرياض','Planned time in Riyadh'),'datetime-local',c?.planned_at?riyadhWall(c.planned_at):'',false)+
    select('state',sv('حالة الخطة','Plan status'),states,c?.state||'draft')+'<p class="full">'+sv('يُحفظ الموعد في خطة الحملة. الإرسال الجماعي غير مفعّل في المعاينة.','The date is saved to the campaign plan. Bulk dispatch is unavailable in preview.')+'</p>',
    d=>send('/v2/campaigns'+(c?'/'+c.id:''),c?'PUT':'POST',{...d,name:c?.name||d.name,channel:c?.channel||d.channel,planned_at:d.planned_at?new Date(d.planned_at+'+03:00').toISOString():'',revision:c?.revision||0}));
 }
 main.querySelector('#new-campaign').onclick=()=>edit(null);
 function draw(){
  const q=main.querySelector('#campaign-search').value.trim().toLowerCase(),state=main.querySelector('[name=state]').value;
  const items=data.items.filter(c=>c.name.toLowerCase().includes(q)&&(!state||state===c.state)),list=main.querySelector('#campaign-list');
  list.innerHTML=table([sv('الحملة','Campaign'),sv('القناة','Channel'),sv('الشريحة','Segment'),sv('الموعد المخطط','Planned time'),sv('حالة الخطة','Plan status'),''],items.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+esc(c.channel)+'</td><td>'+esc(c.segment||sv('كل العملاء','All contacts'))+'</td><td>'+esc(c.planned_at?riyadhWall(c.planned_at).replace('T',' '):'—')+'</td><td>'+names.get(c.state)+'</td><td><button class="light" data-campaign="'+esc(c.id)+'">'+sv('تعديل','Edit')+'</button></td></tr>'));
  if(!items.length)list.insertAdjacentHTML('beforeend',empty(data.items.length?sv('لا توجد نتائج','No matching campaigns'):sv('لا توجد حملات بعد','No campaigns yet')));
  list.querySelectorAll('[data-campaign]').forEach(b=>b.onclick=()=>edit(items.find(c=>c.id===b.dataset.campaign)));
 }
 main.querySelector('#campaign-search').oninput=draw;main.querySelector('[name=state]').onchange=draw;draw();
}
