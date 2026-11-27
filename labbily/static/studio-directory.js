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
 for(const panel of setupPanels)if(panel)detail.append(panel);
 const names={whatsapp:'WhatsApp Business',instagram:'Instagram',messenger:'Facebook Messenger',snapchat:'Snapchat',tiktok:'TikTok'};
 const selectors={whatsapp:'#meta-prepare',instagram:'#instagram-connect',messenger:'#facebook-prepare'};
 const order=['whatsapp','messenger','instagram','snapchat','tiktok'];
 const cards=Array.from(grid.querySelectorAll('article')).sort((a,b)=>order.indexOf(a.querySelector('.service-channel').textContent)-order.indexOf(b.querySelector('.service-channel').textContent));
 cards.forEach(card=>grid.append(card));
 for(const card of cards){
  const key=card.querySelector('.service-channel').textContent.toLowerCase();
  const title=card.querySelector('h2'),kind=title.textContent;title.textContent=names[key]||key;
  card.classList.add('catalog-card');card.querySelector('.service-channel').remove();
  const badge=document.createElement('span');badge.className='channel-mark '+key;badge.textContent=({whatsapp:'WA',instagram:'IG',messenger:'M',snapchat:'S',tiktok:'♪'})[key]||'•';card.prepend(badge);
  const label=document.createElement('small');label.textContent=kind;title.after(label);
  if(selectors[key]){
   const go=document.createElement('button');go.className='light';go.textContent=sv('إعداد الاتصال','Set up connection');card.append(go);
   go.onclick=()=>{const panel=main.querySelector(selectors[key]).closest('section');panel.tabIndex=-1;panel.focus({preventScroll:true});panel.scrollIntoView({block:'start'})};
  }
 }
 const widget=document.createElement('article');widget.className='catalog-card';
 widget.innerHTML='<span class="tile-icon mint">'+icon('chat')+'</span><h2>'+sv('زر واتساب للموقع','Website WhatsApp button')+'</h2><p>'+sv('أنشئ رابط محادثة برقم العمل ورسالة افتتاحية.','Create a chat link with your business number and an opening message.')+'</p>'+studioButton('wa-link-tool',sv('إنشاء رابط','Create link'));
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
  catalog.hidden=!show;ops.hidden=show;
  nav.querySelector('#channel-apps').setAttribute('aria-pressed',String(show));nav.querySelector('#channel-accounts').setAttribute('aria-pressed',String(!show));
 }
 nav.querySelector('#channel-apps').onclick=()=>showApps(true);nav.querySelector('#channel-accounts').onclick=()=>showApps(false);
 const add=main.querySelector('#service-add');if(add){add.textContent=sv('اختيار قناة','Choose channel');add.onclick=()=>{showApps(true);search.focus()}}
 showApps(true);
};
