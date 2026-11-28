'use strict';
for(const [key,label,symbol] of [
 ['setup',sv('قائمة الإعداد','Getting started'),'setup-checklist'],
 ['campaigns',sv('الحملات','Campaigns'),'campaigns'],
 ['settings',sv('الإعدادات','Settings'),'settings']
]){
 workspaceIcons[key]=symbol;
 if(key==='setup')menus.admin.splice(1,0,[key,label,'']);else menus.admin.push([key,label,'']);
}
workspaceIcons.lifecycle='analytics';
for(const role of ['admin','supervisor','reader'])menus[role].push(['lifecycle',sv('دورة حياة العميل','Contact lifecycle'),'']);
async function workspaceSetup(main){
 const state=await api('/v2/workspace-setup'),steps=[
  ['channel','channels',sv('القناة','Channel'),sv('اربط أول قناة تواصل','Connect your first channel'),sv('اختر واتساب أو إنستغرام أو ماسنجر، ثم راجع جاهزية الحساب.','Select WhatsApp, Instagram or Messenger and review account readiness.')],
  ['team','settings?section=members',sv('الفريق','Team'),sv('أضف أول عضو في الفريق','Add your first teammate'),sv('حدّد دور العضو والصلاحيات التي يحتاجها.','Choose the member’s role and access.')],
  ['stages','contacts',sv('المراحل','Stages'),sv('خصّص مراحل جهات الاتصال','Customize contact stages'),sv('أضف مرحلة تعبّر عن مسار العميل في مؤسستك.','Create a stage that reflects your customer journey.')],
  ['conversation','inbox',sv('المحادثة','Conversation'),sv('استقبل أول محادثة','Receive a conversation'),sv('تظهر المحادثة عند استقبال حدث من قناة مهيّأة.','Conversations appear when a configured channel receives an event.')],
  ['agent','agents',sv('الوكيل الذكي','AI agent'),sv('جهّز أول وكيل وانشره','Set up and publish an agent'),sv('اختر نموذجًا واختبر إجاباته من المعرفة المعتمدة قبل النشر.','Choose a template and test its answers against approved knowledge before publication.')]
 ];
 const done=steps.filter(([k])=>state[k]).length,next=steps.find(([k])=>!state[k])?.[0];
 main.innerHTML=heading(sv('قائمة الإعداد','Getting started'),sv('إعداد مساحة العمل','Workspace setup'))+
 '<div class="setup-wrap"><section class="setup-hero"><small>Labbily</small><h2>'+sv('مرحبًا بك في مساحة العمل','Welcome to your workspace')+'</h2><p>'+sv('اربط قنواتك وجهّز فريقك لاستقبال العملاء.','Connect your channels and prepare your team to welcome customers.')+'</p><nav>'+
 steps.map(([key,route,label])=>'<a href="/app/'+route+'"><span>'+icon(state[key]?'check':(key==='team'?'team':workspaceIcons[route]))+'</span>'+label+'</a>').join('')+'</nav><footer>'+sv('الخطوات المكتملة','Completed steps')+' <bdi>'+done+' / 5</bdi></footer></section>'+
 '<section class="setup-checklist">'+steps.map(([key,route,label,title,desc])=>'<details '+(key===next?'open':'')+'><summary><span class="tile-icon">'+icon(state[key]?'check':(key==='team'?'team':workspaceIcons[route]))+'</span><strong>'+title+'</strong><small>'+ (state[key]?sv('مكتملة','Complete'):key===next?sv('الخطوة التالية','Next step'):'')+'</small></summary><p>'+desc+'</p><a class="button light" href="/app/'+route+'">'+sv('فتح','Open')+' '+label+'</a></details>').join('')+'</section></div>';
}
async function lifecycleReport(main){
 const data=await api('/v2/lifecycle-report');
 const stages=[['new',sv('جديد','New')],['interested',sv('مهتم','Interested')],['payment',sv('بانتظار الدفع','Awaiting payment')],['customer',sv('عميل','Customer')],['uninterested',sv('غير مهتم','Not interested')],...data.stages.map(s=>[s.id,s.name])],labels=new Map(stages);
 const counts=new Map(data.distribution.map(s=>[s.stage,Number(s.total)])),total=[...counts.values()].reduce((a,b)=>a+b,0);
 main.innerHTML=heading(sv('دورة حياة جهة الاتصال','Contact lifecycle'),sv('التوزيع الحالي لجهات الاتصال وآخر تغييرات المراحل','Current contact distribution and latest stage changes'))+
 '<div class="stage-report">'+stages.map(([id,name])=>'<article class="catalog-card"><small>'+esc(name)+'</small><strong>'+ (counts.get(id)||0)+'</strong><progress max="'+(total||1)+'" value="'+(counts.get(id)||0)+'"></progress></article>').join('')+'</div><h2>'+sv('آخر تغييرات المراحل','Latest stage changes')+'</h2>'+
 (data.changes.length?table([sv('العميل','Customer'),sv('المرحلة','Stage'),sv('التاريخ','Date')],data.changes.map(c=>'<tr><td>'+(c.has_image?'<img class="campaign-thumb" loading="lazy" alt="" src="/api/v2/campaigns/'+esc(c.id)+'/image">':'')+esc(c.name)+'</td><td>'+esc(labels.get(c.stage)||c.stage)+'</td><td>'+esc(date(c.changed_at))+'</td></tr>')):empty(sv('لم تُسجّل تغييرات في المراحل بعد','No stage changes recorded yet')));
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
  let picture=null;
  const current=c?.has_image?'/api/v2/campaigns/'+encodeURIComponent(c.id)+'/image':'';

  modal(c?sv('تعديل خطة الحملة','Edit campaign plan'):sv('خطة حملة جديدة','New campaign plan'),
    (c?'<p class="full">'+esc(c.name)+' · '+esc(c.channel)+'</p>':field('name',sv('اسم الحملة','Campaign name'))+select('channel',sv('القناة','Channel'),channels))+
    select('segment_id',sv('الشريحة المستهدفة','Target segment'),[['',sv('كل العملاء','All contacts')],...data.segments.map(x=>[x.id,x.name])],c?.segment_id||'')+
    area('body',sv('نص الرسالة المقترح','Planned message'),c?.body||'',false)+
    '<fieldset class="full campaign-picture"><legend>'+sv('صورة الحملة','Campaign image')+'</legend><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="'+sv('اختيار صورة','Choose image')+'"><img alt="'+sv('معاينة الصورة','Image preview')+'" '+(current?'src="'+current+'"':'hidden')+'><button type="button" class="light small" id="remove-picture" '+(current?'':'hidden')+'>'+sv('إزالة الصورة','Remove image')+'</button><small>JPG · PNG · WebP</small></fieldset>'+

    field('planned_at',sv('الموعد المخطط بتوقيت الرياض','Planned time in Riyadh'),'datetime-local',c?.planned_at?riyadhWall(c.planned_at):'',false)+
    select('state',sv('حالة الخطة','Plan status'),states,c?.state||'draft')+'<p class="full">'+sv('يُحفظ الموعد في خطة الحملة. الإرسال الجماعي غير مفعّل في المعاينة.','The date is saved to the campaign plan. Bulk dispatch is unavailable in preview.')+'</p>',
    async d=>send('/v2/campaigns'+(c?'/'+c.id:''),c?'PUT':'POST',{...d,image:picture,name:c?.name||d.name,channel:c?.channel||d.channel,planned_at:d.planned_at?new Date(d.planned_at+'+03:00').toISOString():'',revision:c?.revision||0}));
  const file=dialog.querySelector('[type=file]'), preview=dialog.querySelector('.campaign-picture img'), remove=dialog.querySelector('#remove-picture');
  let generation=0;
  remove.onclick=()=>{generation++;picture='';preview.hidden=true;preview.removeAttribute('src');file.value='';remove.hidden=true;dialog.querySelector('[type=submit]').disabled=false};
  file.onchange=async()=>{
   const selected=file.files[0];if(!selected)return;
   const turn=++generation,save=dialog.querySelector('[type=submit]');save.disabled=true;
   try{
    if(selected.size>12*1024*1024||!['image/jpeg','image/png','image/webp'].includes(selected.type))throw Error();
    const bitmap=await createImageBitmap(selected),ratio=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    const url=canvas.toDataURL('image/jpeg',.77);
    if(url.length>1400000)throw Error();
    if(turn===generation){picture=url.split(',')[1];preview.src=url;preview.hidden=false;remove.hidden=false;dialog.querySelector('.error').textContent=''}
   }catch{if(turn===generation){file.value='';dialog.querySelector('.error').textContent=sv('تعذرت قراءة الصورة. اختر صورة JPG أو PNG أو WebP حتى 12 ميغابايت.','Choose a readable JPG, PNG or WebP up to 12 MB.')}}
   finally{if(turn===generation)save.disabled=false}
  };

 }
 main.querySelector('#new-campaign').onclick=()=>edit(null);
 function draw(){
  const q=main.querySelector('#campaign-search').value.trim().toLowerCase(),state=main.querySelector('[name=state]').value;
  const items=data.items.filter(c=>c.name.toLowerCase().includes(q)&&(!state||state===c.state)),list=main.querySelector('#campaign-list');
  list.innerHTML=table([sv('الحملة','Campaign'),sv('القناة','Channel'),sv('الشريحة','Segment'),sv('الموعد المخطط','Planned time'),sv('حالة الخطة','Plan status'),''],items.map(c=>'<tr><td>'+(c.has_image?'<img class="campaign-thumb" loading="lazy" alt="" src="/api/v2/campaigns/'+esc(c.id)+'/image">':'')+esc(c.name)+'</td><td>'+esc(c.channel)+'</td><td>'+esc(c.segment||sv('كل العملاء','All contacts'))+'</td><td>'+esc(c.planned_at?riyadhWall(c.planned_at).replace('T',' '):'—')+'</td><td>'+names.get(c.state)+'</td><td><button class="light" data-campaign="'+esc(c.id)+'">'+sv('تعديل','Edit')+'</button></td></tr>'));
  if(!items.length)list.insertAdjacentHTML('beforeend',empty(data.items.length?sv('لا توجد نتائج','No matching campaigns'):sv('لا توجد حملات بعد','No campaigns yet')));
  list.querySelectorAll('[data-campaign]').forEach(b=>b.onclick=()=>edit(items.find(c=>c.id===b.dataset.campaign)));
 }
 main.querySelector('#campaign-search').oninput=draw;main.querySelector('[name=state]').onchange=draw;draw();
}
