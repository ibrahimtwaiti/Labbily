'use strict';
flowTemplates.push(
 [sv('تنظيم جهة اتصال جديدة','Classify a new contact'),'contact_created',[{action:'condition',field:'source',value:'manual',otherwise:3},{action:'tag',value:'new-lead'}]],
 [sv('متابعة عميل مهتم','Follow up an interested customer'),'manual',[{action:'stage',value:'interested'},{action:'assign',value:'sales'}]],
 [sv('توجيه الطلب العاجل','Route urgent requests'),'opened',[{action:'condition',field:'priority',value:'urgent',otherwise:3},{action:'assign',value:'support'}]]
);
async function workflowDirectory(main){
 const flows=await api('/v2/workflows');
 main.innerHTML=heading(sv('سير العمل','Workflows'),sv('إدارة المسودات والإصدارات النشطة','Manage drafts and active versions'),'<div class="actions">'+studioButton('flow-templates',sv('قوالب جاهزة','Templates'))+studioButton('new-flow',sv('＋ إنشاء سير عمل','＋ New workflow'),false)+'</div>')+
 '<div class="studio-tools"><input type="search" class="search" id="flow-search" placeholder="'+sv('ابحث عن سير عمل…','Search workflows…')+'" aria-label="'+sv('بحث','Search')+'">'+select('active',sv('الحالة','Status'),[['',sv('الكل','All')],['active',sv('نشط','Active')],['draft',aw('draft')]])+'</div><section id="flow-list"></section>';
 const open=(id=null,preset=null)=>workflowsView(main,id,preset);
 main.querySelector('#new-flow').onclick=studioActions(main,()=>open());
 main.querySelector('#flow-templates').onclick=()=>{
  dialog.innerHTML='<div class="dialog-header"><h2 id="dialog-title">'+sv('قوالب الأتمتة','Automation templates')+'</h2>'+studioButton('templates-close',sv('إغلاق','Close'))+'</div><div class="catalog-grid">'+flowTemplates.map(([name,trigger,steps],i)=>'<article class="catalog-card"><span class="tile-icon '+['blue','violet','mint'][i%3]+'">'+icon('workflow')+'</span><h3>'+name+'</h3><small>'+flowTriggers[trigger]+'</small><p>'+steps.map(s=>flowActions[s.action]).join(' · ')+'</p><button class="light" data-template="'+i+'">'+sv('استخدام القالب','Use template')+'</button></article>').join('')+'</div>';
  dialog.classList.add('template-dialog');
  dialog.addEventListener('close',()=>dialog.classList.remove('template-dialog'),{once:true});
  dialog.querySelector('#templates-close').onclick=()=>dialog.close();
  dialog.querySelectorAll('[data-template]').forEach(b=>b.onclick=studioActions(main,async()=>{dialog.close();await open(null,Number(b.dataset.template))}));
  dialog.showModal();
 };
 function draw(){
  const q=main.querySelector('#flow-search').value.trim().toLowerCase(),state=main.querySelector('[name=active]').value;
  const filtered=flows.filter(f=>f.name.toLowerCase().includes(q)&&(!state||state===(f.active_trigger?'active':'draft')));
  const list=main.querySelector('#flow-list');
  list.innerHTML=table([sv('اسم سير العمل','Workflow name'),sv('المحفّز','Trigger'),sv('الإصدار','Revision'),sv('الحالة','Status'),sv('الإجراءات','Actions')],filtered.map(f=>'<tr><td><strong>'+esc(f.name)+'</strong></td><td>'+esc(flowTriggers[f.trigger_type])+'</td><td>'+f.revision+'</td><td>'+esc(f.active_trigger?sv('نشط','Active'):aw('draft'))+'</td><td><button class="light" data-flow="'+esc(f.id)+'">'+sv('فتح المحرر','Open editor')+'</button></td></tr>'));
  if(!filtered.length)list.insertAdjacentHTML('beforeend',empty(flows.length?sv('لا توجد نتائج مطابقة','No matching workflows'):sv('لم تنشئ أي سير عمل بعد','Create your first workflow'),sv('ابدأ بقالب أو أنشئ مسارًا مخصصًا.','Start from a template or build a custom workflow.')));
  list.querySelectorAll('[data-flow]').forEach(b=>b.onclick=studioActions(main,()=>open(b.dataset.flow)));
 }
 main.querySelector('#flow-search').oninput=draw;main.querySelector('[name=active]').onchange=draw;draw();
}
function channelLogo(key){
 const shapes={
  whatsapp:'<path fill="none" stroke="currentColor" stroke-width="1.9" d="M20.7 11.7a8.7 8.7 0 0 1-12.9 7.7l-4.6 1.3 1.3-4.5a8.7 8.7 0 1 1 16.2-4.5Z"/><path fill="currentColor" d="M8.4 6.8c-.8 0-1.5 1-1.5 2.1 0 2.4 3.7 6.7 7.4 7.5 1.6.4 3.1-.8 3-2 0-.3-.3-.4-.7-.6l-2-1c-.5-.2-.6.1-1.1.8-.2.3-.5.3-.8.2-1.5-.6-2.8-1.7-3.6-3.1-.2-.3 0-.5.3-.8.5-.6.6-.8.4-1.2l-.7-1.6c-.2-.4-.4-.4-.7-.3Z"/>',
  messenger:'<path fill="currentColor" d="M12 2.3C6.6 2.3 2.4 6.2 2.4 11.5c0 2.8 1.1 5.1 3.2 6.8l.2 2.5c0 .6.6 1 1.2.7l2.6-1.4c.8.2 1.6.3 2.4.3 5.5 0 9.6-3.9 9.6-9 0-5.2-4.1-9.1-9.6-9.1Z"/><path fill="white" d="m5.9 14.3 4.5-6 3.3 2.4 4.4-2.7-4.5 6-3.3-2.4Z"/>',
  instagram:'<g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/></g><circle fill="currentColor" cx="17.3" cy="6.8" r="1.3"/>',
  snapchat:'<path fill="white" stroke="currentColor" stroke-width="1.35" d="M6.9 10c-.6-3.8 1.3-7 5.1-7s5.7 3.2 5.1 7c1.2.3 2-.9 2.5-.1.5 1-1.4 1.7-2.2 2.1.4 2.2 2.3 3.9 4.1 4.4-.3 1-1.4 1.2-2.6 1.4l-.5 1.4c-1.3-.3-2.2-.4-3.3.4-1.8 1.5-4.4 1.5-6.2 0-1.1-.8-2-.7-3.3-.4l-.5-1.4c-1.2-.2-2.3-.4-2.6-1.4 1.8-.5 3.7-2.2 4.1-4.4-.8-.4-2.7-1.1-2.2-2.1.5-.8 1.3.4 2.5.1Z"/>',
  tiktok:'<path fill="currentColor" d="M14 2h3.2c.2 2.5 1.7 4.3 4.4 4.6v3.3a8.5 8.5 0 0 1-4.4-1.6V16a6 6 0 1 1-7-5.9v3.4a2.8 2.8 0 1 0 3.8 2.6Z"/>'
 };
 return '<svg viewBox="0 0 24 24" aria-hidden="true">'+shapes[key]+'</svg>';
}
const connectedChannelDetails=channelsView;
channelsView=async function(main){
 await connectedChannelDetails(main);
 const grid=main.querySelector('.service-accounts');
 if(!grid)return;
 const headingEl=main.querySelector('.page-heading'),directory=document.createElement('div');
 directory.className='channel-directory';
 directory.innerHTML='<nav class="channel-nav" aria-label="'+sv('القنوات والتطبيقات','Channels and apps')+'"><h3>'+sv('القنوات والتطبيقات','Channels and apps')+'</h3>'+studioButton('channel-apps',sv('دليل التطبيقات','App directory'))+studioButton('channel-accounts',sv('الحسابات والتشغيل','Accounts and operations'))+'</nav><section class="channel-apps"><header class="studio-tools"><h2>'+sv('التطبيقات','Apps')+'</h2><input class="search" type="search" id="app-search" aria-label="'+sv('بحث في التطبيقات','Search apps')+'" placeholder="'+sv('ابحث عن تطبيق…','Search apps…')+'"></header></section>';
 const sections=Array.from(main.children).filter(el=>el!==headingEl&&el!==grid);
 const setupPanels=['#meta-prepare','#facebook-prepare','#instagram-connect'].map(s=>main.querySelector(s)?.closest('section'));
 main.prepend(headingEl,directory);
 const catalog=directory.querySelector('.channel-apps'),nav=directory.querySelector('nav');
 const ops=document.createElement('section');ops.className='channel-operations';directory.append(ops);
 sections.filter(el=>!setupPanels.includes(el)).forEach(el=>ops.append(el));
 const detail=document.createElement('div');detail.className='channel-details';catalog.append(grid,detail);
 for(const panel of setupPanels)if(panel){panel.hidden=true;detail.append(panel)}
 const names={whatsapp:'WhatsApp Business',instagram:'Instagram',messenger:'Facebook Messenger',snapchat:'Snapchat',tiktok:'TikTok'};
 const selectors={whatsapp:'#meta-prepare',instagram:'#instagram-connect',messenger:'#facebook-prepare'};
 const order=['whatsapp','messenger','instagram','snapchat','tiktok'];
 const cards=Array.from(grid.querySelectorAll('article')).sort((a,b)=>order.indexOf(a.querySelector('.service-channel').textContent)-order.indexOf(b.querySelector('.service-channel').textContent));
 cards.forEach(card=>grid.append(card));
 for(const card of cards){
  const key=card.querySelector('.service-channel').textContent.toLowerCase();
  const title=card.querySelector('h2'),kind=title.textContent;title.textContent=names[key]||key;
  card.classList.add('catalog-card');card.querySelector('.service-channel').remove();
  const badge=document.createElement('span');badge.className='channel-mark '+key;badge.innerHTML=channelLogo(key);card.prepend(badge);
  const label=document.createElement('small');label.textContent=kind;title.after(label);
  if(selectors[key]){
   const go=document.createElement('button');go.className='light';go.textContent=sv('إعداد الاتصال','Set up connection');card.append(go);
   go.dataset.connect=key;go.onclick=()=>openConnector(key);
  }
 }
 const guides={
  messenger:[[sv('صلاحية إدارة الصفحة','Page access'),sv('استخدم حساب فيسبوك الذي يدير الصفحة المطلوبة.','Use the Facebook account that manages the Page.')],[sv('اختيار الصفحة','Choose a Page'),sv('وافق على التفويض ثم حدّد صفحة العمل من الحسابات المتاحة.','Authorize access and choose your business Page.')],[sv('التحقق من الأحداث','Check events'),sv('فعّل الاشتراك ثم أرسل رسالة إلى الصفحة من حساب اختبار.','Subscribe to events and message the Page from a test account.')]],
  instagram:[[sv('حساب احترافي','Professional account'),sv('جهّز حساب الأعمال أو المنشئ المراد ربطه.','Use the business or creator account you want to connect.')],[sv('تفويض Instagram','Authorize Instagram'),sv('سجّل الدخول في نافذة Instagram وامنح الصلاحيات المطلوبة.','Sign in to Instagram and grant the requested permissions.')],[sv('اختبار الرسائل','Test messaging'),sv('أرسل رسالة إلى الحساب وافتح صندوق الوارد للتحقق من وصولها.','Message the account and check the inbox for delivery.')]]
 };
 function openConnector(key){
  const control=main.querySelector(selectors[key]),panel=control.closest('section');
  showApps(true);grid.hidden=true;catalog.querySelector('header').hidden=true;none.hidden=true;
  detail.hidden=false;panel.hidden=false;
  if(!panel.querySelector('.connector-header')){
   const header=document.createElement('header');header.className='connector-header';
   header.innerHTML='<span class="channel-mark '+key+'">'+channelLogo(key)+'</span><div><small>Meta Business</small><h2>'+names[key]+'</h2></div>'+studioButton('back-'+key,sv('دليل التطبيقات','App directory'));
   panel.querySelector('h2')?.remove();panel.prepend(header);header.querySelector('button').onclick=()=>{showApps(true);grid.querySelector('[data-connect='+key+']')?.focus()};
   if(guides[key]){const guide=document.createElement('ol');guide.className='connection-steps';guide.innerHTML=guides[key].map(([t,d],i)=>'<li><b>'+String(i+1).padStart(2,'0')+'</b><div><strong>'+t+'</strong><p>'+d+'</p></div></li>').join('');header.after(guide);
    if(control.disabled){const note=document.createElement('p');note.className='connector-note';note.textContent=sv('الخطوة المطلوبة من مدير مقدم الخدمة: تجهيز تطبيق القناة وعنوان العودة وإتاحة مساحة العمل.','The service provider must configure the channel app, its callback and workspace access.');guide.after(note)}
   }
  }
  panel.tabIndex=-1;panel.focus({preventScroll:true});headerIntoView(panel);
 }
 function headerIntoView(el){el.scrollIntoView({block:'start'})}
 const widget=document.createElement('article');widget.className='catalog-card';
 widget.innerHTML='<span class="channel-mark whatsapp">'+channelLogo('whatsapp')+'</span><h2>'+sv('زر واتساب للموقع','Website WhatsApp button')+'</h2><p>'+sv('أنشئ رابط محادثة برقم العمل ورسالة افتتاحية.','Create a chat link with your business number and an opening message.')+'</p>'+studioButton('wa-link-tool',sv('إنشاء رابط','Create link'));
 grid.append(widget);cards.push(widget);
 widget.querySelector('button').onclick=()=>{
  dialog.innerHTML='<div class="dialog-header"><h2 id="dialog-title">'+sv('رابط واتساب للموقع','Website WhatsApp link')+'</h2>'+studioButton('close-link',sv('إغلاق','Close'))+'</div>'+studioForm('wa-link-form',field('phone',sv('الرقم الدولي','International number'),'tel')+field('message',sv('رسالة افتتاحية','Opening message'),'text','',false),sv('إنشاء رابط','Create link'))+'<output id="wa-link-output" aria-live="polite"></output>';
  dialog.querySelector('#close-link').onclick=()=>dialog.close();
  bindForm(dialog.querySelector('form'),d=>{
   const number=d.phone.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[ ()-]/g,'').replace(/^(?:[+]|00)/,'');
   if(!/^[1-9][0-9]{6,14}$/.test(number))throw new Error(sv('أدخل الرقم مع رمز الدولة','Enter the number with its country code'));
   const url=new URL('https://wa.me/'+number);if(d.message.trim())url.searchParams.set('text',d.message.trim());
   const output=dialog.querySelector('output');output.innerHTML='<a target="_blank" rel="noopener noreferrer" dir="ltr"></a> '+studioButton('copy-link',sv('نسخ الرابط','Copy link'));
   const link=output.querySelector('a');link.href=url.href;link.textContent=url.href;
   output.querySelector('button').onclick=studioActions(output,async()=>{await navigator.clipboard.writeText(url.href);toast(sv('نُسخ الرابط','Link copied'))});
  });dialog.showModal();
 };
 const search=catalog.querySelector('input'),none=document.createElement('p');none.textContent=sv('لا توجد تطبيقات تطابق البحث','No matching apps');none.hidden=true;grid.after(none);
 search.oninput=()=>{for(const card of cards)card.hidden=!card.textContent.toLowerCase().includes(search.value.trim().toLowerCase());none.hidden=cards.some(c=>!c.hidden)};
 function showApps(show){
  catalog.hidden=!show;ops.hidden=show;detail.hidden=true;grid.hidden=false;catalog.querySelector('header').hidden=false;setupPanels.forEach(p=>{if(p)p.hidden=true});search.oninput();
  nav.querySelector('#channel-apps').setAttribute('aria-pressed',String(show));nav.querySelector('#channel-accounts').setAttribute('aria-pressed',String(!show));
 }
 nav.querySelector('#channel-apps').onclick=()=>showApps(true);nav.querySelector('#channel-accounts').onclick=()=>showApps(false);
 const add=main.querySelector('#service-add');if(add){add.textContent=sv('اختيار قناة','Choose channel');add.onclick=()=>{showApps(true);search.focus()}}
 showApps(true);
 const requested=new URLSearchParams(location.search).get('app');if(selectors[requested])openConnector(requested);
};
