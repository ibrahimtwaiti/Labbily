'use strict';

async function contactsView(main) {
  const settings = await api('/v2/crm/settings');
  const stages = [
    ['new', sv('جديد', 'New')], ['interested', sv('مهتم', 'Interested')],
    ['payment', sv('بانتظار الدفع', 'Awaiting payment')], ['customer', sv('عميل', 'Customer')],
    ['uninterested', sv('غير مهتم', 'Not interested')], ...settings.stages.map(s => [s.id, s.name])
  ];
  const stageName = id => stages.find(s => s[0] === id)?.[1] || id;
  const admin = me.role === 'admin', editable = ['admin','supervisor','sales'].includes(me.role);
  const all = ['', sv('الكل', 'All')];
  main.innerHTML = heading(tr("العملاء"), tr("بيانات التواصل والموافقات داخل مساحة شركتك."), button('add-contact', tr("+ إضافة عميل"))) +
    '<div class="toolbar"><input class="search" id="contact-search" maxlength="100" aria-label="'+tr("بحث العملاء")+'" placeholder="'+sv('ابحث بالاسم أو الرقم أو الوسم أو البريد','Search name, phone, tag or email')+'">'+
    (admin ? '<a class="button outline small" href="/api/contacts/export">'+sv('تصدير CSV','Export CSV')+'</a>' + button('import-csv',sv('استيراد CSV','Import CSV'),'light small') : '') +
    '</div><div class="service-toolbar">'+ select('stage',sv('مرحلة العميل','Lifecycle stage'),[all,...stages])+
    select('consent',tr("موافقة التسويق"),[all,['yes',tr("موافق")],['no',tr("غير موافق / منسحب")]])+
    select('segment',sv('الشريحة المحفوظة','Saved segment'),[all,...settings.segments.map(s=>[s.id,s.name])])+
    (editable ? button('save-segment',sv('حفظ الشريحة','Save segment'),'light small') : '')+
    (admin ? button('add-stage',sv('إضافة مرحلة','Add stage'),'light small') : '')+
    '<div class="switcher">'+studioButton('contacts-list',sv('قائمة','List'))+studioButton('contacts-board',sv('لوحة المراحل','Stage board'))+'</div></div><div id="contacts-table"></div><button id="more-contacts" class="light" hidden>'+sv('تحميل المزيد','Load more')+'</button>';
  const search=main.querySelector('#contact-search'), stage=main.querySelector('[name=stage]'),
    consent=main.querySelector('[name=consent]'), segment=main.querySelector('[name=segment]'),
    more=main.querySelector('#more-contacts'), grid=main.querySelector('#contacts-table');
  let items=[], cursor=null, request=0, timer;
  const filters=()=>({q:search.value.trim(),stage:stage.value,consent:consent.value});
  async function load(append=false) {
    const current=++request, criteria=filters(), params=new URLSearchParams(criteria);
    if(append && cursor) params.set('before',cursor);
    more.disabled=true;
    try {
      const page=await api('/v2/crm/contacts?'+params);
      if(current!==request || !grid.isConnected) return;
      items=append ? items.concat(page.items) : page.items;
      cursor=page.next;
      more.hidden=!cursor;
      const active=Object.values(criteria).some(Boolean);
      const board=sessionStorage.getItem('labbily.contacts.view')==='board';
      for(const mode of ['list','board']){
        const control=main.querySelector('#contacts-'+mode);
        control.setAttribute('aria-pressed',String((mode==='board')===board));
        control.onclick=()=>{sessionStorage.setItem('labbily.contacts.view',mode);load().catch(e=>toast(e.message))};
      }
      grid.innerHTML=board?'<div class="stage-board">'+stages.filter(([id])=>!stage.value||id===stage.value).map(([id,name])=>{
        const matches=items.filter(c=>c.stage===id);
        return '<section><h3>'+esc(name)+' <small>'+matches.length+'</small></h3>'+matches.map(c=>'<button class="light contact-tile" data-profile="'+esc(c.id)+'"><b>'+esc(c.name)+'</b><small dir="ltr">'+esc(c.phone)+'</small></button>').join('')+'</section>';
      }).join('')+'</div>':items.length ? table([tr("العميل"),tr("رقم التواصل"),sv('المرحلة','Stage'),tr("الوسوم"),tr("موافقة التسويق"),''],items.map(c=>
        '<tr><td class="table-title">'+esc(c.name)+'<small>'+esc(c.email)+'</small></td><td dir="ltr">'+esc(c.phone)+'</td><td>'+esc(stageName(c.stage))+'</td><td>'+esc(c.tags||'—')+'</td><td>'+
        (c.marketing_consent?tr("موافق"):tr("غير موافق / منسحب"))+'</td><td><button class="small light" data-profile="'+esc(c.id)+'">'+sv('الملف','Profile')+'</button> <button class="small light" data-consent="'+esc(c.id)+'">'+tr("الموافقة")+'</button></td></tr>')) :
        empty(active?tr("لا توجد نتائج مطابقة"):tr("لا توجد جهات اتصال"),active?tr("جرّب اسمًا أو رقم هاتف آخر."):tr("أضف أول عميل. رقم الهاتف وحده لا يعني موافقة تسويقية."),'/static/labbily/contact-book.svg');
      wireRows('data-profile',async id=>{
        const c=items.find(x=>x.id===id), history=await api('/v2/crm/contacts/'+id+'/history');
        if(!grid.isConnected) return;
        const timeline=history.length?'<ol class="full">'+history.map(h=>'<li>'+esc(stageName(h.stage))+' · '+esc(date(h.changed_at))+'</li>').join('')+'</ol>':'';
        if(!editable) {
          modal(c.name,'<p>'+esc(stageName(c.stage))+' · '+esc(c.email||'—')+'</p>'+timeline,async()=>{});
          return;
        }
        modal(c.name,select('stage',sv('مرحلة العميل','Lifecycle stage'),stages,c.stage)+field('email',sv('البريد','Email'),'email',c.email,false)+field('tags',tr("الوسوم"),'text',c.tags,false)+(me.role==='sales'?'':select('delivery',sv('الرسائل الصادرة','Outbound messages'),[['allow',sv('مسموحة','Allowed')],['block',sv('محظورة','Blocked')]],c.blocked?'block':'allow'))+timeline,
          ({delivery,...d})=>send('/v2/crm/contacts/'+id,'PUT',{...d,...(delivery?{blocked:delivery==='block'}:{}),revision:c.revision}));
      });
      wireRows('data-consent',id=>{
        const c=items.find(x=>x.id===id);
        modal(tr("موافقة ")+c.name,select('marketing_consent',tr("حالة الموافقة"),[['no',tr("غير موافق / انسحاب")],['yes',tr("موافقة موثقة")]],c.marketing_consent?'yes':'no')+
          area('consent_source',tr("نص الموافقة ومصدر إثباتها"),c.consent_source,false),d=>send('/contacts/'+id+'/consent','PATCH',{...d,marketing_consent:d.marketing_consent==='yes'}));
      });
    } finally { if(current===request) more.disabled=false; }
  }
  function change(delay=0) {
    ++request; clearTimeout(timer); more.hidden=true;
    timer=setTimeout(()=>load().catch(e=>toast(e.message)),delay);
  }
  search.oninput=()=>{segment.value='';change(180)};
  stage.onchange=consent.onchange=()=>{segment.value='';change()};
  segment.onchange=()=>{
    const f=settings.segments.find(s=>s.id===segment.value)?.filters || {};
    search.value=f.q||'';stage.value=f.stage||'';consent.value=f.consent||'';change();
  };
  more.onclick=()=>load(true).catch(e=>toast(e.message));
  if(editable) main.querySelector('#save-segment').onclick=()=>modal(sv('حفظ الشريحة','Save segment'),
    field('name',sv('اسم الشريحة','Segment name')),d=>send('/v2/crm/segments','POST',{...d,filters:filters()}));
  if(admin) {
    main.querySelector('#add-stage').onclick=()=>modal(sv('مرحلة جديدة','New stage'),field('name',sv('اسم المرحلة','Stage name')),d=>send('/v2/crm/stages','POST',d));
    main.querySelector('#import-csv').onclick=openContactImport;
  }
  main.querySelector('#add-contact').onclick=()=>modal(tr("عميل جديد"),field('name',tr("اسم العميل"))+field('phone',tr("رقم دولي"),'tel')+
    field('tags',tr("الوسوم — اختياري"),'text','',false)+tMarkup("<p class=\"full micro\">يضاف العميل دون موافقة تسويقية افتراضيًا. سجّل الموافقة لاحقًا عند توفر إثباتها.</p>"),d=>send('/contacts','POST',d));
  await load();
}

function openContactImport() {
  let reviewed=null;
  const title=sv('استيراد عملاء من CSV','Import contacts from CSV');
  modal(title,'<label class="field full">'+sv('اختر ملفًا يتضمن name وphone وعمود tags اختياريًا، حتى 100 صف.','Choose a file with name, phone and optional tags, up to 100 rows.')+
    '<input type="file" accept=".csv,text/csv" required></label><button type="button" id="preview-import" class="light">'+sv('معاينة الصفوف','Preview rows')+'</button><div class="full" id="import-results" aria-live="polite"></div>',
    async()=>{if(!reviewed)throw new Error(sv('عاين الصفوف أولًا','Preview the rows first'));const r=await send('/v2/crm/import','POST',{csv_text:reviewed,apply:true});toast(sv('تمت الإضافة','Added')+' '+r.added+' · '+sv('تم التخطي','Skipped')+' '+r.skipped)});
  const input=dialog.querySelector('[type=file]'), results=dialog.querySelector('#import-results'), save=dialog.querySelector('[type=submit]');
  save.disabled=true;
  input.onchange=()=>{reviewed=null;save.disabled=true;results.replaceChildren()};
  dialog.querySelector('#preview-import').onclick=async()=>{
    const file=input.files[0];
    if(!file)return;
    try {
      if(file.size>60000)throw new Error(sv('الملف كبير. قسّمه إلى ملفات أصغر.','File too large. Split it into smaller files.'));
      const csv_text=await file.text(), preview=await send('/v2/crm/import','POST',{csv_text});
      if(input.files[0]!==file||!input.isConnected)return;
      const labels={ready:sv('جاهز','Ready'),duplicate:sv('مكرر','Duplicate'),invalid:sv('غير صالح','Invalid')};
      results.innerHTML=table([sv('الصف','Row'),tr("العميل"),tr("رقم التواصل"),sv('النتيجة','Result')],preview.rows.map(r=>'<tr><td>'+r.row+'</td><td>'+esc(r.name||'—')+'</td><td>'+esc(r.phone||'—')+'</td><td>'+labels[r.status]+'</td></tr>'));
      if(!preview.rows.some(r=>r.status==='invalid')&&preview.rows.some(r=>r.status==='ready')){reviewed=csv_text;save.disabled=false}
    } catch(e){results.textContent=e.message}
  };
}
