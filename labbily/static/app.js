'use strict';
const app=document.querySelector('#app'),dialog=document.querySelector('#dialog');
let me=null,catalog=null,currentView='',selectedConversation=null;
let pageLeaving=false;
addEventListener('pagehide',()=>{pageLeaving=true});
addEventListener('pageshow',()=>{pageLeaving=false});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={new:tr("جديد"),review:tr("قيد المراجعة"),information:tr("يحتاج معلومات"),quoted:tr("تم إعداد عرض"),accepted:tr("مقبول"),rejected:tr("مرفوض"),closed:tr("مغلق"),qualified:tr("مؤهلة"),meeting:tr("اجتماع"),proposal:tr("عرض"),negotiation:tr("تفاوض"),won:tr("رابحة"),lost:tr("خاسرة"),setup:tr("قيد التجهيز"),active:tr("نشط"),suspended:tr("معلق"),requirements:tr("المتطلبات"),testing:tr("قيد الاختبار"),ready:tr("جاهز"),blocked:tr("متعثر"),complete:tr("مكتمل"),pending:tr("بانتظار التنفيذ"),submitted:tr("تم التسليم"),approved:tr("معتمد"),revision:tr("مطلوب تعديل"),open:tr("مفتوح"),waiting:tr("انتظار العميل"),done:tr("مكتملة"),unverified:tr("بانتظار اختبار الربط"),disconnected:tr("غير متصل"),provider:tr("مدير مقدم الخدمة"),admin:tr("مدير الشركة"),supervisor:tr("مشرف الفريق"),sales:tr("موظف المبيعات"),marketing:tr("مسؤول التسويق"),services:tr("مسؤول الخدمات"),reader:tr("قارئ التقارير"),internal:tr("ملاحظة داخلية"),received:tr("واردة"),processed:tr("تمت المعالجة"),dead:tr("تحتاج مراجعة")};
const status=s=>`<span class="status ${esc(s)}">${esc(labels[s]||s)}</span>`;
const date=s=>s?new Intl.DateTimeFormat(LANG==='en'?'en-GB':'ar-SA',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(new Date(s)):'—';
const logo=()=>brandLogo();
// Retired identifiers remain readable on existing provider requests.
const previousServiceNames = {
  "whatsapp-sales": [
    "إدارة مبيعات واتساب",
    "WhatsApp sales management"
  ],
  "sales-system": [
    "بناء نظام مبيعات",
    "Build a sales system"
  ],
  "platform": [
    "اشتراك منصة Labbily",
    "Labbily platform subscription"
  ],
  "stores": [
    "إدارة المتاجر",
    "Store management"
  ],
  "training": [
    "تدريب المبيعات",
    "Sales training"
  ],
  "consulting": [
    "استشارات المبيعات",
    "Sales consulting"
  ],
  "assessment": [
    "تقييم المبيعات",
    "Sales assessment"
  ],
  "recruitment": [
    "توظيف المبيعات",
    "Sales recruitment"
  ],
  "sales-plan": [
    "تصميم خطط المبيعات",
    "Sales planning"
  ],
  "whatsapp-api": [
    "ربط WhatsApp API",
    "WhatsApp API integration"
  ]
};
const serviceName = id => catalog.services.find(s => s.id === id)?.name || previousServiceNames[id]?.[LANG === 'en' ? 1 : 0] || id;
const field=(name,label,type='text',value='',required=true)=>`<label class="field">${esc(label)}<input name="${esc(name)}" ${['url','email'].includes(type)?'dir="ltr"':''} type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='password'?'minlength="12" maxlength="128" autocomplete="new-password"':''} ${type==='tel'?'dir="ltr" placeholder="+966…"':''} ${type==='number'?'step="0.01" min="0"':''} ${type!=='password'?'maxlength="400"':''}></label>`;
const area=(name,label,value='',required=true)=>`<label class="field full">${esc(label)}<textarea dir="auto" name="${esc(name)}" ${required?'required':''} maxlength="4000">${esc(value)}</textarea></label>`;
const select=(name,label,options,value='')=>`<label class="field">${esc(label)}<select name="${name}">${options.map(o=>{const [v,t]=Array.isArray(o)?o:[o,labels[o]||o];return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`}).join('')}</select></label>`;
const empty=(title,body=tr("ستظهر البيانات هنا بعد إضافتها."),illustration='/static/labbily/digital/light/empty.svg')=>
  `<div class="empty"><img class="state-art" src="${illustration}" width="96" height="80" alt=""><h3>${title}</h3><p>${body}</p></div>`;
const heading=(title,subtitle,action='')=>`<div class="page-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
const button=(id,label,cls='')=>`<button id="${id}" class="${cls}">${label}</button>`;
const table=(headers,body)=>`<div class="table-scroll"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body.join('')}</tbody></table></div>`;
const errorBox='<div class="error" role="alert"></div>';
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),4500)}
// Requests can overlap when a provider dashboard loads several panels together.
let pendingRequests=0, activityTimer, activityIndicator;
function placeActivity(){
 if(activityIndicator)(document.querySelector('dialog[open]')||document.body).append(activityIndicator);
}
document.addEventListener('toggle',event=>{if(event.target.tagName==='DIALOG')placeActivity()},true);
document.addEventListener('close',placeActivity,true);
async function withLoading(operation){
 if(++pendingRequests===1){
  activityTimer=setTimeout(()=>{
   activityIndicator=document.createElement('div');
   activityIndicator.className='request-activity';
   activityIndicator.setAttribute('role','status');
   activityIndicator.textContent=LANG==='ar'?'جارٍ المعالجة…':'Working…';
   placeActivity();
  },180);
 }
 try{return await operation()}
 finally{
  if(--pendingRequests===0){
   clearTimeout(activityTimer);
   activityIndicator?.remove();
   activityIndicator=null;
  }
 }
}
function api(path,options={}){
 return withLoading(()=>requestJson(path,options));
}
async function requestJson(path,options){
 const headers={'Content-Type':'application/json',...(me?{'X-CSRF-Token':me.csrf}:{}),...options.headers};
 const response=await fetch('/api'+path,{...options,headers,credentials:'same-origin'});
 const data=await response.json().catch(()=>({detail:tr("تعذر قراءة استجابة الخادم")}));
 if(!response.ok){const e=new Error(typeof data.detail==='string'?tr(data.detail):tr("تحقق من البيانات المدخلة"));e.status=response.status;throw e}return data;
}
const send=(path,method,data,headers={})=>api(path,{method,body:JSON.stringify(data),headers});
const formData=f=>Object.fromEntries(new FormData(f));
function bindForm(form,handler){form.addEventListener('submit',async e=>{e.preventDefault();const submit=form.querySelector('button[type=submit]'),err=form.querySelector('.error');if(err)err.textContent='';if(submit)submit.disabled=true;try{await handler(formData(form),form)}catch(error){if(err)err.textContent=error.message;else toast(error.message)}finally{if(submit)submit.disabled=false}})}
function modal(title,html,onSubmit){dialog.innerHTML=`<div class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="icon" id="close-dialog" type="button" aria-label="${tr("إغلاق")}">×</button></div><form>${errorBox}<div class="form-grid">${html}</div><div class="actions"><button type="submit">${tr("حفظ التغييرات")}</button><button class="outline" type="button" id="cancel-dialog">${tr("إلغاء")}</button></div></form>`;dialog.querySelector('#close-dialog').onclick=()=>dialog.close();dialog.querySelector('#cancel-dialog').onclick=()=>dialog.close();bindForm(dialog.querySelector('form'),async(d,f)=>{await onSubmit(d,f);dialog.close();toast(tr("تم الحفظ بنجاح"));await renderDashboard(currentView)});dialog.showModal()}
function publicShell(body){app.innerHTML=`<div class="wrap"><header class="public-header">${logo()}<nav class="nav" aria-label="${tr("التنقل الرئيسي")}"><a href="/services">${tr("الحلول والخدمات")}</a><a href="/platform">${tr("المنصة")}</a><a href="/how-it-works">${tr("كيف نعمل")}</a><a href="/about">${tr("عن Labbily")}</a></nav><a class="button small" href="/request">${tr("ابدأ مع Labbily ")}<span>←</span></a></header><main id="main">${body}</main><footer class="footer"><div class="footer-main"><div>${logo()}<p class="small-text">${tr("نصل المحادثة بالفرصة، والفريق بالنتيجة.")}</p></div><div class="footer-links"><a href="/request">${tr("طلب عرض")}</a><a href="/faq">${tr("الأسئلة الشائعة")}</a><a href="/privacy">${tr("الخصوصية")}</a><a href="/terms">${tr("الشروط")}</a><a href="/login">${tr("تسجيل الدخول")}</a></div></div><div class="copyright">© ${new Date().getFullYear()} ${tr("Labbily ")}<span> — ${tr("حلول المبيعات والتواصل")}</span></div></footer></div>`}

let home;
function intro(tag,title,desc){return `<div class="page-intro"><p class="eyebrow">${tag}</p><h1>${title}</h1><p>${desc}</p></div>`}
function solutionStatus(s) {
  const labels = {
    ready: sv('متاح', 'Available'),
    limited: sv('متاح جزئيًا', 'Limited availability'),
    planned: sv('مخطط له', 'Planned')
  };
  return `<span class="solution-status" data-status="${s.status}">${labels[s.status]}</span>`;
}

function solutionDirectory() {
  const groups = [
    ['all', sv('كل الحلول', 'All solutions')],
    ['service', sv('المحادثات وخدمة العملاء', 'Conversations and service')],
    ['automation', sv('الأتمتة والذكاء الاصطناعي', 'Automation and AI')],
    ['marketing', sv('التسويق والتحليلات', 'Marketing and analytics')],
    ['integrations', sv('الربط والتكامل', 'Channels and integrations')],
    ['governance', sv('الأمان والحوكمة', 'Security and governance')]
  ];
  const buttons = groups.map(([key, name]) => `<button type="button" data-filter="${key}" aria-controls="service-grid" aria-pressed="${key === 'all'}">${name}</button>`).join('');
  return `<div class="filters solution-filters" role="group" aria-label="${sv('تصنيف الحلول', 'Filter solutions')}">${buttons}</div>
    <div class="solution-grid" id="service-grid">${catalog.services.map(serviceTile).join('')}</div>`;
}

function bindSolutionFilters() {
  const filters = document.querySelector('.solution-filters');
  if (!filters) return;
  const buttons = [...filters.querySelectorAll('[data-filter]')];
  const cards = document.querySelectorAll('#service-grid [data-group]');
  function show(group) {
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.filter === group));
    for (const card of cards) card.hidden = group !== 'all' && card.dataset.group !== group;
  }
  const initial = new URLSearchParams(location.search).get('group');
  if (buttons.some(button => button.dataset.filter === initial)) show(initial);
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (button) show(button.dataset.filter);
  });
}

function services() {
  publicShell(intro(esc(brandName()), sv('حلول ذكية لتواصل أفضل مع عملائك', 'Better conversations with your customers'),
    sv('أدر محادثاتك، وأتمت التواصل، ونظّم فريقك وعلاقاتك مع العملاء.', 'Manage conversations, automate communication and organize your customer service team.')) + solutionDirectory());
  bindSolutionFilters();
}
function serviceDetail(id) {
  const s = catalog.services.find(item => item.id === id);
  if (!s) return notFound();
  const directory = sv('حلولنا', 'Our solutions');
  const planned = s.status === 'planned';
  const action = planned
    ? `<a class="button outline" href="/services">${sv('استكشف الحلول الأخرى', 'Explore other solutions')}</a>`
    : `<a class="button" href="/request?service=${encodeURIComponent(s.id)}">${tr("اطلب عرضًا توضيحيًا")}</a>`;
  const features = s.features.length
    ? `<section class="card"><h2>${sv('المزايا المتاحة', 'Available features')}</h2><ul class="clean">${s.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></section>`
    : '';
  const related = s.related.map(key => catalog.services.find(item => item.id === key)).filter(Boolean);
  publicShell(`<nav class="solution-breadcrumb" aria-label="${sv('مسار التنقل', 'Breadcrumb')}"><a href="/services">${directory}</a> / <span aria-current="page">${esc(s.name)}</span></nav>
    ${intro(solutionStatus(s), esc(s.name), esc(s.summary))}
    <div class="two-col"><div class="stack">${features}
      <section class="card"><h2>${planned ? sv('سيناريو مخطط', 'Planned scenario') : sv('كيف يعمل؟', 'How it works')}</h2><p>${esc(s.use_case)}</p></section></div>
      <aside class="card"><h2>${esc(s.subtitle)}</h2><p>${esc(s.scope)}</p>${action}</aside></div>
    <section class="section"><h2>${sv('حلول ذات صلة', 'Related solutions')}</h2><div class="solution-grid">${related.map(serviceTile).join('')}</div></section>
    <div class="section-end">${action}</div>`);
}
function requestPage(){if(!catalog.request_ready){publicShell(intro('Labbily',tr('استقبال الطلبات لم يُفعّل بعد؛ يرجى المحاولة لاحقًا'),'')+`<a class="button" href="/services">${tr('اكتشف الحلول')}</a>`);return}let key=sessionStorage.getItem('labbily.request.key')||crypto.randomUUID();sessionStorage.setItem('labbily.request.key',key);const selected=new URLSearchParams(location.search).get('service')||'unified-inbox';publicShell(intro(tr("ابدأ مع Labbily"),tr("لنتعرف على عملك."),tr("أرسل احتياجك لنراجع النطاق والخدمة المناسبة. ستحصل على رقم مرجعي بعد حفظ طلبك."))+`<div class="two-col"><form id="request-form" class="card">${errorBox}<div class="form-grid">${field('name',tr("الاسم"))}${field('company',tr("اسم الشركة"))}${field('phone',tr("رقم التواصل الدولي"),'tel')}${field('country',tr("الدولة"))}${field('activity',tr("نشاط الشركة"))}${field('email',tr("البريد الإلكتروني — اختياري"),'email','',false)}${select('service',tr("الخدمة المطلوبة"),catalog.services.filter(s=>s.status!=='planned').map(s=>[s.id,s.name]),selected)}${area('need',tr("صف احتياجك باختصار"))}</div><label class="check"><input type="checkbox" name="contact_consent" required><span>${esc(catalog.consent)} <a href="/privacy">${tr("تفاصيل الخصوصية")}</a></span></label><label class="check"><input type="checkbox" name="marketing_consent"><span>${tr("أرغب في استقبال أخبار وعروض تسويقية — اختياري، ويمكنني الانسحاب لاحقًا.")}</span></label><button type="submit">${tr("أرسل طلبك ←")}</button></form><aside class="card"><p class="eyebrow">${tr("ماذا يحدث بعد الإرسال؟")}</p><h3>${tr("طلب محفوظ. متابعة واضحة.")}</h3><p>${tr("١. نسجل طلبك برقم مرجعي.")}</p><p>${tr("٢. يراجع المسؤول الخدمة والاحتياج.")}</p><p>${tr("٣. نتواصل لاستكمال التفاصيل وإعداد العرض.")}</p><hr><p class="small-text">${tr("لا توجد أسعار أو رسوم تلقائية عند إرسال الطلب. تفاصيل الاتفاق تعتمد قبل التشغيل.")}</p></aside></div>`);const form=document.querySelector('#request-form');const saved=sessionStorage.getItem('labbily.request.draft');if(saved){try{const d=JSON.parse(saved);for(const [k,v] of Object.entries(d))if(form.elements[k]&&k!=='service')form.elements[k].value=v}catch{}}form.addEventListener('input',()=>{const d=formData(form);delete d.contact_consent;delete d.marketing_consent;sessionStorage.setItem('labbily.request.draft',JSON.stringify(d))});bindForm(form,async(d)=>{const result=await send('/requests','POST',{...d,contact_consent:!!d.contact_consent,marketing_consent:!!d.marketing_consent,source:new URLSearchParams(location.search).get('utm_source')||''},{'Idempotency-Key':key});sessionStorage.removeItem('labbily.request.draft');sessionStorage.removeItem('labbily.request.key');form.innerHTML=`<div class="success"><h2>${tr("تم حفظ طلبك بنجاح")}</h2><p>${tr("احتفظ برقم طلبك للمتابعة مع الفريق.")}</p><strong>${esc(result.reference)}</strong><div class="actions"><a class="button" href="/">${tr("العودة للرئيسية")}</a></div></div>`})}
function loginPage(){publicShell(`<div class="card login">${brandLogo()}<p class="eyebrow">${tr("مساحة العمل")}</p><h1>${tr("أهلًا بعودتك.")}</h1><p>${tr("سجّل الدخول لمتابعة عملائك وفريقك.")}</p><form id="login-form">${errorBox}${field('email',tr("البريد الإلكتروني"),'email')}<label class="field">${tr("كلمة المرور")}<input type="password" name="password" required maxlength="128" autocomplete="current-password"></label><button type="submit">${tr("الدخول إلى مساحة العمل ←")}</button></form><p class="micro">${tr("يُنشئ المدير حسابك. لاستعادة الوصول، تواصل مع مسؤول المساحة.")}</p></div>`);bindForm(document.querySelector('#login-form'),async d=>{await send('/auth/login','POST',d);location.href='/app'})}
const faqs = [
  [tr("ما الحل المناسب لفريقي؟"), tr("ابدأ بالمحادثات إن كنت تحتاج إلى تنظيم الردود، أو استكشف الأتمتة إذا أردت توزيع الاستفسارات تلقائيًا.")],
  [tr("كيف أعرف ما هو متاح؟"), tr("توضح كل بطاقة حالة الحل. وتعرض صفحة التفاصيل المزايا المتاحة وشروط تشغيلها.")],
  [tr("هل الربط بواتساب فوري؟"), tr("الربط يحتاج حسابًا مخولًا ومتطلبات المزود واختبارات فعلية؛ لا يُعد إدخال الرقم دليل اتصال.")],
  [tr("هل يمكن طلب عرض لحل محدد؟"), tr("افتح تفاصيل الحل المتاح واختر طلب عرض توضيحي. سيظهر اسم الحل في نموذج الطلب.")],
  [tr("هل تُعرض بيانات شركة على شركة أخرى؟"), tr("تُفصل السجلات بحسب الشركة وتُفحص الصلاحيات في الخادم لكل عملية.")]
];
function informational(path){let body='';if(path==='/platform')body=intro(tr("المنصة"),tr("مساحة تنظم العلاقات والمتابعة."),sv('استكشف أدوات المحادثات وإدارة العملاء المتاحة لفريقك.', 'Explore the conversation and customer management tools available to your team.'))+`<div class="grid">${[[tr("العملاء"),tr("بيانات موحدة ووسوم وموافقة موثقة لكل شركة.")],[tr("فرص البيع"),tr("مراحل وقيم وعملات ومواعيد متابعة وأسباب إغلاق.")],[tr("المحادثات"),tr("استقبال نصوص بعد إعداد القناة والأحداث، وإسناد وملاحظات داخلية.")],[tr("الفريق والصلاحيات"),tr("أدوار محددة وإيقاف وصول وسجل تدقيق.")],[tr("مشروعات الخدمات"),tr("مراحل ومخرجات ومراجعة واعتماد التسليم.")],[tr("التقارير الأساسية"),tr("قراءة للفرص والمحادثات دون الخلط بين قيمة الفرصة والتحصيل.")]].map(([t,p])=>`<div class="card"><h3>${t}</h3><p>${p}</p></div>`).join('')}</div><div class="notice">${tr("تتطلب القنوات الخارجية تفويض الحساب والتحقق من الاتصال قبل التشغيل.")}</div><a class="button" href="/services">${tr("اكتشف الحلول")}</a>`;
if(path==='/how-it-works')body=intro(tr("رحلة العمل"),tr("وضوح من الطلب إلى التسليم."),tr("كل مرحلة لها مسؤول ومخرج واعتماد، حتى تعرف ما تم وما الخطوة التالية."))+`<div class="grid">${[['01',tr("استكشاف الاحتياج"),tr("طلب خدمة محفوظ ثم مراجعة وجلسة لفهم الفريق والأهداف.")],['02',tr("عرض واتفاق"),tr("مخرجات ونطاق واستثناءات ورسوم ومتطلبات عميل واضحة.")],['03',tr("تجهيز وتنفيذ"),tr("مساحة شركة عند الحاجة، ومشروع بمراحل ومخرجات.")],['04',tr("اختبار واعتماد"),tr("مراجعة التسليم وطلب تعديل أو اعتماد النتيجة.")],['05',tr("تشغيل محدود"),tr("اختبار واقع العمل وحصر الملاحظات قبل التوسع.")],['06',tr("مراجعة وتحسين"),tr("متابعة مؤشرات متفق عليها وخطوات تطوير.")]].map(([n,t,p])=>`<article class="card"><span class="card-number">${n}</span><h3>${t}</h3><p>${p}</p></article>`).join('')}</div>`;
if(path==='/about')body=intro(tr("عن Labbily"),tr("نصل التواصل بالعمل المنظّم."),esc(catalog.content.about||tr("يجمع فريقك المحادثات وبيانات العملاء في مساحة واحدة، مع توزيع الاستفسارات ومتابعة الردود.")))+`<div class="card policy"><h2>${tr("فكرتنا")}</h2><p>${tr("أن يكون لكل طلب مسؤول، ولكل فرصة خطوة تالية، ولكل خدمة مخرج يمكن مراجعته. بيانات الفريق وقصص النجاح ستُنشر بعد اعتمادها.")}</p><h3>${tr("تواصل معنا")}</h3>${catalog.content.contact_email?`<p>${esc(catalog.content.contact_email)}</p>`:''}${catalog.content.contact_phone?`<p dir="ltr">${esc(catalog.content.contact_phone)}</p>`:''}${catalog.content.working_hours?`<p>${esc(catalog.content.working_hours)}</p>`:''}<a class="button" href="/request">${tr("أرسل طلبك")}</a></div>`;
if(path==='/faq')body=intro(tr("المعرفة والأسئلة"),tr("قبل أن تبدأ."),tr("إجابات عن الخدمات والربط وطريقة التعاقد."))+`<div class="faq">${faqs.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
if(path==='/pricing')body=intro(tr("عرض السعر"),tr("نطاق يناسب احتياجك."),tr("يتحدد النطاق وفق عدد المستخدمين والقنوات واحتياجات الربط."))+`<div class="card policy"><h2>${tr("ما الذي يحدد العرض؟")}</h2><ul class="clean"><li>${tr("عدد المستخدمين وأرقام القنوات والخدمات.")}</li><li>${tr("حجم المحادثات وساعات التشغيل المطلوبة.")}</li><li>${tr("إعداد الحسابات والتكاملات المطلوبة.")}</li></ul><a class="button" href="/request">${tr("طلب عرض سعر")}</a></div>`;
if(path==='/privacy'||path==='/terms'){policyPage(path);return}
publicShell(body||empty(tr("الصفحة غير موجودة")))}
function notFound(){publicShell(intro('404',tr("لم نجد هذه الصفحة."),tr("يمكنك العودة للرئيسية أو استكشاف الخدمات."))+tMarkup("<a class=\"button\" href=\"/\">الرئيسية</a>"))}
const menus={provider:[['integrations',LANG==='en'?'Integrations center':'مركز الربط والمنصات','⇄'],['overview',tr("نظرة عامة"),'◈'],['requests',tr("طلبات الخدمات"),'▤'],['projects',tr("المشروعات"),'□'],['tenants',tr("الشركات"),'▥'],['content',tr("محتوى الموقع"),'✎'],['operations',tr("صحة التشغيل"),'⇄'],['audit',tr("سجل التدقيق"),'≡']],admin:[['overview',tr("نظرة عامة"),'◈'],['inbox',tr("المحادثات"),'▣'],['contacts',tr("العملاء"),'◉'],['opportunities',tr("فرص البيع"),'←'],['tasks',tr("مهامي"),'☑'],['projects',tr("مشروعات الخدمات"),'□'],['reports',tr("التقارير"),'▥'],['team',tr("الفريق"),'♧'],['channels',tr("القنوات"),'⇄'],['audit',tr("سجل التدقيق"),'≡']],supervisor:[['overview',tr("نظرة عامة"),'◈'],['inbox',tr("المحادثات"),'▣'],['contacts',tr("العملاء"),'◉'],['opportunities',tr("فرص البيع"),'←'],['tasks',tr("مهامي"),'☑'],['reports',tr("التقارير"),'▥']],sales:[['overview',tr("نظرة عامة"),'◈'],['inbox',tr("محادثاتي"),'▣'],['contacts',tr("العملاء"),'◉'],['opportunities',tr("فرصي"),'←'],['tasks',tr("مهامي"),'☑']],marketing:[['contacts',tr("العملاء"),'◉']],services:[['projects',tr("مشروعات الخدمات"),'□']],reader:[['reports',tr("التقارير"),'▥']]};
const workspaceIcons = {overview:'dashboard',inbox:'messages',contacts:'contacts',team:'team',channels:'api-connection',integrations:'integrations',reports:'reports',audit:'security',tasks:'calendar',privacy:'security',privacyops:'security',content:'settings',account:'user-profile',requests:'customer-support',opportunities:'analytics',projects:'workflow',billing:'reports',commerce:'settings',operations:'automation',tenants:'team',metadata:'integrations'};
function bindSidebar() {
  const layout = document.querySelector('.app-layout'), toggle = document.querySelector('#sidebar-toggle');
  const mobile = matchMedia('(max-width:760px)');
  let expanded = !mobile.matches && sessionStorage.getItem('labbily.sidebar.collapsed') !== '1';
  function paint() {
    layout.classList.toggle('sidebar-collapsed', !expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? sv('طي قائمة التنقل', 'Collapse navigation') : sv('فتح قائمة التنقل', 'Expand navigation'));
  }
  toggle.onclick = () => {
    expanded = !expanded;
    if (!mobile.matches) sessionStorage.setItem('labbily.sidebar.collapsed', expanded ? '0' : '1');
    paint();
  };
  paint();
}
function dashboardShell(view){const menu=menus[me.role];app.innerHTML=`<div class="app-layout" data-view="${esc(view)}"><aside id="workspace-sidebar" class="sidebar">${brandLogo(true,true)}<div class="sidebar-label">${tr("مساحة العمل")}</div><nav id="workspace-nav" aria-label="${tr("تنقل مساحة العمل")}">${menu.map(([v,t,i])=>`<a href="/app/${v}" class="${view===v?'active':''}" ${view===v?'aria-current="page"':''} aria-label="${esc(t)}" title="${esc(t)}"><span class="nav-symbol">${icon(workspaceIcons[v]||'dashboard')}</span><span class="nav-text">${t}</span></a>`).join('')}</nav><div class="sidebar-bottom">${tr("Labbily · الإصدار الثاني")}<a href="/">${tr("زيارة الموقع ←")}</a><a href="/app/account">${tr("إعدادات حسابي")}</a></div></aside><div><header class="app-top"><button id="sidebar-toggle" type="button" class="outline small" aria-controls="workspace-nav">☰</button><div class="workspace-location"><b>${esc(menu.find(m=>m[0]===view)?.[1]||tr("الحساب"))}</b></div><div class="user-pill"><span class="avatar">${esc(me.name[0])}</span><div class="small-text"><a href="/app/account"><b>${esc(me.name)}</b></a><br><span class="muted">${esc(labels[me.role])}</span></div>${languageLink()}<button id="logout" class="outline small">${tr("خروج")}</button></div></header><main id="main" class="app-main"><div class="loading" role="status">${tr("جارٍ تحميل البيانات…")}</div></main></div>`;bindSidebar();document.querySelector('#logout').onclick=async()=>{try{await send('/auth/logout','POST',{});location.href='/login'}catch(e){toast(e.message)}}}
function wireRows(attr,callback){document.querySelectorAll(`[${attr}]`).forEach(el=>el.onclick=()=>{Promise.resolve(callback(el.getAttribute(attr))).catch(e=>toast(e.message))})}
function overviewHero(title,accent,description,actions,metrics,period='') {
  const links=actions.map(([label,url],i)=>`<a class="${i?'hero-secondary':'button'}" href="${url}">${label}${i?'':icon('arrow')}</a>`).join('');
  const tiles=metrics.map(([label,value,glyph])=>
    `<div class="overview-metric"><span>${icon(glyph)}${esc(label)}</span><strong><bdi>${esc(String(value??'—'))}</bdi></strong></div>`).join('');
  return `<section class="workspace-hero conversation-hero">
    <div class="hero-copy"><h1>${title} <em>${accent}</em></h1><p class="lead">${description}</p><div class="actions">${links}</div></div>
    ${conversationArtwork()}
    ${tiles?`<div class="workspace-metrics">${tiles}</div>`:''}
    ${period?`<p class="metrics-period">${period}</p>`:''}
  </section>`;
}

async function overview(main) {
  if (me.role==='provider') {
    const [requests,projects,tenants]=await Promise.all([api('/admin/requests'),api('/projects'),api('/admin/tenants')]);
    const metrics=[
      [tr("طلبات الخدمة"),requests.length,'messages'],
      [tr("المشروعات"),projects.length,'workflow'],
      [tr("الشركات"),tenants.length,'team'],
      [sv('طلبات جديدة','New requests'),requests.filter(r=>r.status==='new').length,'notifications']
    ];
    main.innerHTML=overviewHero(sv('أدر خدمات','Manage your'),sv('منصتك.','platform.'),
      tr("صورة واضحة لطلباتك ومشروعاتك والشركات."),
      [[tr("طلبات الخدمة"),'/app/requests'],[tr("المشروعات"),'/app/projects']],metrics)+`<div class="card"><div class="split-head"><h3>${tr("أحدث طلبات الخدمات")}</h3><a href="/app/requests" class="card-link">${tr("عرض الجميع ←")}</a></div>${requests.length?table([tr("الشركة"),tr("الخدمة"),tr("الحالة")],requests.slice(0,5).map(r=>`<tr><td>${esc(r.company)}</td><td>${esc(serviceName(r.service))}</td><td>${status(r.status)}</td></tr>`)):empty(tr("لم تصل طلبات بعد"),tr("ستظهر الطلبات المحفوظة من نموذج الموقع هنا."))} </div><div class="notice">${tr("تنبيهات الطلبات داخلية ومحفوظة. البريد والدعوات الإلكترونية غير مفعلة في هذا الإصدار.")}</div>`;
    return;
  }
  const menu=menus[me.role];
  const canReport=menu.some(([key])=>key==='reports');
  const actions=[[tr("المحادثات"),'/app/inbox']];
  let metrics=[], period='';
  if (canReport) {
    actions.push([tr("التقارير"),'/app/reports']);
    try {
      const report=await api('/v2/reports');
      const number=new Intl.NumberFormat(LANG,{maximumFractionDigits:1});
      const measure=(v,unit='')=>Number.isFinite(v)?number.format(v)+unit:'—';
      metrics=[
        [sv('المحادثات','Conversations'),measure(report.tickets),'messages'],
        [sv('بانتظار المعالجة','Backlog'),measure(report.backlog),'workflow'],
        [sv('رضا العملاء','Customer satisfaction'),measure(report.csat_percent,'%'),'team'],
        [sv('وسيط أول رد بشري','Median first reply'),Number.isFinite(report.first_human_median_seconds)?measure(report.first_human_median_seconds/60,sv(' د',' min')):'—','reports']
      ];
      period=sv('مؤشرات خدمة العملاء · آخر ٣٠ يومًا','Customer service metrics · Last 30 days');
    } catch (error) {
      if (error.status===401) throw error;
      period=sv('تعذّر تحميل المؤشرات. افتح التقارير لإعادة المحاولة.','Metrics could not load. Open reports to retry.');
    }
  } else {
    actions.push([tr("مهام المتابعة"),'/app/tasks']);
  }
  main.innerHTML=overviewHero(sv('محادثات عملائك','Customer conversations'),
    sv('في مساحة واحدة.','in one workspace.'),sv('تابع رسائل عملائك وأداء الفريق، وانتقل مباشرةً إلى المحادثة التي تحتاجك.','Review messages and team activity, then jump into the conversation that needs you.'),
    actions,metrics,period)+`<div class="grid"><a class="card" href="/app/inbox">${icon('messages')}<h3>${tr("المحادثات")}</h3><p>${tr("راجع السجل، وأسند المحادثات وتابع الملاحظات.")}</p></a><a class="card" href="/app/opportunities">${icon('analytics')}<h3>${tr("فرص البيع")}</h3><p>${tr("حدّد المرحلة والمسؤول وموعد الخطوة التالية.")}</p></a><a class="card" href="/app/tasks">${icon('calendar')}<h3>${tr("مهام المتابعة")}</h3><p>${tr("احفظ مواعيدك وأنجز المهام المرتبطة بعملك.")}</p></a></div>`;
}
async function requestsView(main){const data=await api('/admin/requests');main.innerHTML=heading(tr("طلبات الخدمات"),tr("من أول احتياج إلى عرض معتمد ومشروع تنفيذ."))+`<div class="toolbar"><input id="request-search" class="search" aria-label="${tr("بحث في الطلبات")}" placeholder="${tr("ابحث بالشركة أو الرقم المرجعي…")}"></div><div id="requests-table"></div>`;const paint=q=>{const filtered=data.filter(r=>(r.company+r.reference+r.name).includes(q));document.querySelector('#requests-table').innerHTML=filtered.length?table([tr("الطلب"),tr("الشركة"),tr("الخدمة"),tr("الحالة"),tr("المسؤول"),''],filtered.map(r=>`<tr><td>${esc(r.reference)}</td><td class="table-title">${esc(r.company)}${r.duplicate_phone?tMarkup("<br><small class=\"muted\">رقم تواصل موجود بطلب آخر</small>"):''}</td><td>${esc(serviceName(r.service))}</td><td>${status(r.status)}</td><td>${esc(r.owner_name)}</td><td><button class="light small" data-request="${r.id}">${tr("التفاصيل")}</button></td></tr>`)):empty(tr("لا توجد طلبات مطابقة"));wireRows('data-request',id=>{const r=data.find(x=>x.id===id);modal(tr("طلب ")+r.reference,`<div class="full notice"><b>${esc(r.name)} — ${esc(r.company)}</b><br>${esc(r.phone)} · ${esc(r.email)}<br>${esc(r.country)} · ${esc(r.activity)}<br>${esc(r.need)}<br><small>${tr("موافقة التواصل: ")}${esc(date(r.consented_at))} · ${tr("التسويق: ")}${r.marketing_consent?tr("نعم"):tr("لا")}</small></div>${select('status',tr("حالة الطلب"),['new','review','information','quoted','accepted','rejected','closed'],r.status)}${field('payment_reference',tr("مرجع التحصيل — اختياري"),'text',r.payment_reference,false)}${area('quote',tr("عرض السعر: النطاق والمخرجات والمدة والرسوم"),r.quote,false)}<p class="full micro">${tr("قبول العرض ينشئ مشروعًا بمراحل تلقائيًا. لا يعتبر مبلغًا محصلًا.")}</p>`,d=>send('/admin/requests/'+id,'PATCH',d))})};paint('');document.querySelector('#request-search').oninput=e=>paint(e.target.value)}
async function tenantsView(main){const data=await api('/admin/tenants');main.innerHTML=heading(tr("الشركات"),tr("مساحات مستقلة مع تفعيل إداري."),button('add-tenant',tr("+ إضافة شركة")))+(data.length?table([tr("الشركة"),tr("الحالة"),tr("تاريخ الإنشاء"),''],data.map(t=>`<tr><td class="table-title">${esc(t.name)}</td><td>${status(t.status)}</td><td>${date(t.created_at)}</td><td><button data-tenant="${t.id}" class="small light">${tr("إدارة الحالة")}</button></td></tr>`)):empty(tr("ابدأ بأول شركة"),tr("أنشئ مساحة وحساب مدير، ثم أكمل التجهيز.")));document.querySelector('#add-tenant').onclick=()=>modal(tr("شركة جديدة"),field('name',tr("اسم الشركة"))+field('owner',tr("اسم مدير الشركة"))+field('email',tr("بريد المدير"),'email')+field('password',tr("كلمة مرور أولية — 12 حرفًا على الأقل"),'password')+tMarkup("<p class=\"full micro\">سلّم بيانات الدخول بطريقة آمنة. يستطيع المدير تغيير كلمة المرور من إعدادات الحساب.</p>"),d=>send('/admin/tenants','POST',d));wireRows('data-tenant',id=>modal(tr("حالة الشركة"),select('status',tr("الحالة"),['setup','active','suspended'],data.find(t=>t.id===id).status),d=>send('/admin/tenants/'+id,'PATCH',d)))}
async function projectsView(main){const data=await api('/projects');let tenants=[];if(me.role==='provider')tenants=await api('/admin/tenants');main.innerHTML=heading(tr("مشروعات الخدمات"),tr("مخرجات واضحة، ومراجعة محفوظة لكل مرحلة."))+(data.length?data.map(p=>`<article class="card project"><div class="project-top"><div><h3>${esc(p.name)}</h3>${status(p.status)}</div>${me.role==='provider'?`<button class="light small" data-project="${p.id}">${tr("تحديث وربط شركة")}</button>`:''}</div>${p.milestones.map(m=>`<div class="milestone"><div><b>${esc(m.title)}</b><small>${esc(m.deliverable||tr("لم يُرفع وصف المخرج بعد"))}</small>${m.feedback?`<small>${tr("ملاحظات: ")}${esc(m.feedback)}</small>`:''}</div><div>${status(m.status)} <button class="outline small" data-milestone="${m.id}">${tr("مراجعة")}</button></div></div>`).join('')}</article>`).join(''):empty(tr("لا توجد مشروعات"),tr("ينشأ المشروع من طلب مقبول، ويمكن ربطه بمساحة الشركة.")));wireRows('data-project',id=>{const p=data.find(x=>x.id===id);modal(tr("إدارة المشروع"),select('status',tr("حالة التجهيز"),['requirements','setup','testing','ready','active','blocked','complete'],p.status)+select('tenant_id',tr("مساحة الشركة — اختياري"),[['',tr("مشروع خدمة فقط")],...tenants.map(t=>[t.id,t.name])],p.tenant_id||''),d=>send('/projects/'+id,'PATCH',d))});wireRows('data-milestone',id=>{const m=data.flatMap(p=>p.milestones).find(x=>x.id===id);modal(m.title,select('status',tr("حالة المخرج"),me.role==='services'?['pending','submitted','revision']:['pending','submitted','approved','revision'],m.status)+area('deliverable',tr("وصف المخرج وتسليمه"),m.deliverable,false)+area('feedback',tr("ملاحظات المراجعة"),m.feedback,false),d=>send('/milestones/'+id,'PATCH',d))})}
async function contactsView(main){const data=await api('/contacts');main.innerHTML=heading(tr("العملاء"),tr("بيانات التواصل والموافقات داخل مساحة شركتك."),button('add-contact',tr("+ إضافة عميل")))+`<div class="toolbar"><input id="contact-search" class="search" placeholder="${tr("ابحث بالاسم أو الرقم…")}" aria-label="${tr("بحث العملاء")}">${me.role==='admin'?tMarkup("<a class=\"button outline small\" href=\"/api/contacts/export\">تصدير CSV</a>"):''}</div><div id="contacts-table"></div>`;const paint=q=>{const filtered=data.filter(c=>(c.name+c.phone).includes(q));document.querySelector('#contacts-table').innerHTML=filtered.length?table([tr("العميل"),tr("رقم التواصل"),tr("الوسوم"),tr("موافقة التسويق"),''],filtered.map(c=>`<tr><td class="table-title">${esc(c.name)}</td><td dir="ltr">${esc(c.phone)}</td><td>${esc(c.tags||'—')}</td><td>${c.marketing_consent?tr("موافق"):tr("غير موافق / منسحب")}</td><td><button class="small light" data-consent="${c.id}">${tr("الموافقة")}</button></td></tr>`)):empty(q?tr("لا توجد نتائج مطابقة"):tr("لا توجد جهات اتصال"),q?tr("جرّب اسمًا أو رقم هاتف آخر."):tr("أضف أول عميل. رقم الهاتف وحده لا يعني موافقة تسويقية."),'/static/labbily/contact-book.svg');wireRows('data-consent',id=>{const c=data.find(x=>x.id===id);modal(tr("موافقة ")+c.name,select('marketing_consent',tr("حالة الموافقة"),[['no',tr("غير موافق / انسحاب")],['yes',tr("موافقة موثقة")]],c.marketing_consent?'yes':'no')+area('consent_source',tr("نص الموافقة ومصدر إثباتها"),c.consent_source,false),d=>send('/contacts/'+id+'/consent','PATCH',{...d,marketing_consent:d.marketing_consent==='yes'}))})};paint('');document.querySelector('#contact-search').oninput=e=>paint(e.target.value);document.querySelector('#add-contact').onclick=()=>modal(tr("عميل جديد"),field('name',tr("اسم العميل"))+field('phone',tr("رقم دولي"),'tel')+field('tags',tr("الوسوم — اختياري"),'text','',false)+tMarkup("<p class=\"full micro\">يضاف العميل دون موافقة تسويقية افتراضيًا. سجّل الموافقة لاحقًا عند توفر إثباتها.</p>"),d=>send('/contacts','POST',d))}
async function opportunitiesView(main){const data=await api('/opportunities');const contacts=await api('/contacts');const team=await api('/team');main.innerHTML=heading(tr("فرص البيع"),tr("فرصة بمالك واحد وموعد متابعة ونتيجة موثقة."),button('add-opportunity',tr("+ فرصة جديدة")))+`<div class="kanban">${[['new','qualified'],['meeting','proposal'],['negotiation'],['won','lost']].map((stages,i)=>`<section class="kanban-column"><h3>${[tr("جديدة ومؤهلة"),tr("اجتماعات وعروض"),tr("تفاوض"),tr("مغلقة")][i]} <span>${data.filter(o=>stages.includes(o.stage)).length}</span></h3>${data.filter(o=>stages.includes(o.stage)).map(o=>`<article class="kanban-card">${status(o.stage)}<h4>${esc(o.title)}</h4><p>${esc(o.contact_name)}</p><p class="amount">${(o.value_minor/100).toLocaleString('ar-SA')} ${esc(o.currency)}</p><p>${tr("متابعة: ")}${o.follow_up?date(o.follow_up):tr("لم تحدد")}</p><button class="light small" data-opportunity="${o.id}">${tr("تحديث الفرصة")}</button></article>`).join('')}</section>`).join('')}</div><p class="micro">${tr("قيمة الفرصة لا تمثل إيرادًا محصلًا. العملات تعرض منفصلة دون تحويل تلقائي.")}</p>`;document.querySelector('#add-opportunity').onclick=()=>{if(!contacts.length)return toast(tr("أضف عميلًا أولًا"));modal(tr("فرصة جديدة"),field('title',tr("عنوان الفرصة"))+select('contact_id',tr("العميل"),contacts.map(c=>[c.id,c.name]))+field('amount',tr("قيمة الفرصة"),'number','0')+field('currency',tr("رمز العملة (مثال SAR)"))+field('follow_up',tr("موعد متابعة — اختياري"),'datetime-local','',false),d=>{const n=Number(d.amount);if(!Number.isFinite(n)||n<0)throw new Error(tr("قيمة الفرصة غير صالحة"));return send('/opportunities','POST',{...d,value_minor:Math.round(n*100),follow_up:d.follow_up?new Date(d.follow_up).toISOString():''})})};wireRows('data-opportunity',id=>{const o=data.find(x=>x.id===id);modal(tr("تحديث الفرصة"),select('stage',tr("المرحلة"),['new','qualified','meeting','proposal','negotiation','won','lost'],o.stage)+select('owner_id',tr("المسؤول"),team.filter(t=>t.active&&(me.role!=='sales'||t.id===me.id)).map(t=>[t.id,t.name]),o.owner_id)+field('follow_up',tr("موعد المتابعة — اختياري"),'datetime-local',localDate(o.follow_up),false)+area('reason',tr("سبب الخسارة أو مرجع إثبات الفوز"),o.reason,false),d=>send('/opportunities/'+id,'PATCH',{...d,follow_up:d.follow_up?new Date(d.follow_up).toISOString():''}))})}
function localDate(value){if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
async function tasksView(main){const data=await api('/tasks');main.innerHTML=heading(tr("مهامي"),tr("خطوات المتابعة المسندة إليك."),button('add-task',tr("+ مهمة جديدة")))+(data.length?table([tr("المهمة"),tr("الموعد"),tr("الحالة"),''],data.map(t=>`<tr><td>${esc(t.title)}</td><td>${date(t.due_at)}</td><td>${status(t.status)}</td><td><button class="light small" data-task="${t.id}">${t.status==='open'?tr("إنهاء المهمة"):tr("إعادة فتح")}</button></td></tr>`)):empty(tr("لا توجد مهام بعد")));document.querySelector('#add-task').onclick=()=>modal(tr("مهمة متابعة"),field('title',tr("عنوان المهمة"))+field('due_at',tr("الموعد"),'datetime-local'),d=>send('/tasks','POST',{...d,due_at:new Date(d.due_at).toISOString()}));wireRows('data-task',async id=>{await send('/tasks/'+id,'PATCH',{status:data.find(t=>t.id===id).status==='open'?'done':'open'});await renderDashboard('tasks')})}
async function teamView(main){const data=await api('/team');main.innerHTML=heading(tr("فريق العمل"),tr("أنشئ الحسابات واضبط الدور وأوقف الوصول عند الحاجة."),button('add-member',tr("+ إضافة عضو")))+table([tr("الاسم"),tr("البريد"),tr("الدور"),tr("الحالة"),''],data.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.email)}</td><td>${esc(labels[t.role])}</td><td>${t.active?tr("نشط"):tr("موقوف")}</td><td>${t.id!==me.id?`<button class="light small" data-member="${t.id}">${tr("تعديل")}</button>`:tr("أنت")}</td></tr>`));document.querySelector('#add-member').onclick=()=>modal(tr("عضو جديد"),field('name',tr("الاسم"))+field('email',tr("البريد"),'email')+select('role',tr("الدور"),['sales','supervisor','marketing','services','reader','admin'])+field('password',tr("كلمة مرور أولية"),'password'),d=>send('/team','POST',d));wireRows('data-member',id=>{const t=data.find(x=>x.id===id);modal(tr("تعديل ")+t.name,select('role',tr("الدور"),['sales','supervisor','marketing','services','reader','admin'],t.role)+select('active',tr("الوصول"),[['yes',tr("نشط")],['no',tr("موقوف")]],t.active?'yes':'no'),d=>send('/team/'+id,'PATCH',{...d,active:d.active==='yes'}))})}
async function reportsView(main){const r=await api('/reports');const closed=r.pipeline.filter(p=>['won','lost'].includes(p.stage)).reduce((s,p)=>s+p.count,0),won=r.pipeline.filter(p=>p.stage==='won').reduce((s,p)=>s+p.count,0);main.innerHTML=heading(tr("التقارير الأساسية"),tr("الفترة: منذ إنشاء المساحة · المصدر: قاعدة بيانات Labbily · الأوقات المحفوظة UTC"))+`<div class="stats"><div class="stat"><span>${tr("العملاء")}</span><strong>${r.contacts}</strong></div><div class="stat"><span>${tr("الفرص المغلقة")}</span><strong>${closed}</strong></div><div class="stat"><span>${tr("تحويل الفرص الرابحة / المغلقة")}</span><strong>${closed?Math.round(won/closed*100)+tr("٪"):'—'}</strong></div></div><div class="notice">${esc(r.note)}</div>`+(r.pipeline.length?table([tr("المرحلة"),tr("العدد"),tr("القيمة"),tr("العملة")],r.pipeline.map(p=>`<tr><td>${status(p.stage)}</td><td>${p.count}</td><td>${(p.value_minor/100).toLocaleString('ar-SA')}</td><td>${esc(p.currency)}</td></tr>`)):empty(tr("لا توجد بيانات فرص بعد")))}
async function channelsView(main){const data=await api('/channels');main.innerHTML=heading(tr("قنوات واتساب"),tr("تسجيل القناة خطوة تجهيز، ولا يعني أنها متصلة."),button('add-channel',tr("+ تسجيل قناة")))+`<div class="notice">${tr("يلزم إعداد أسرار المزود وWebhook والعامل الخلفي على الخادم. استقبال النصوص قابل للاختبار؛ الإرسال الخارجي معطل في V1. لن تظهر حالة «متصل» تلقائيًا.")}</div>`+(data.length?table([tr("معرف رقم واتساب"),tr("الحالة")],data.map(c=>`<tr><td>${esc(c.phone_id)}</td><td>${status(c.status)}</td></tr>`)):empty(tr("لا توجد قناة مسجلة"),tr("سجّل Phone Number ID من حساب Meta المخول.")));document.querySelector('#add-channel').onclick=()=>modal(tr("تسجيل قناة"),field('phone_id','Phone Number ID')+tMarkup("<p class=\"full micro\">لا تضع رموز الوصول أو App Secret في هذا النموذج. تحفظ الأسرار في بيئة الخادم فقط.</p>"),d=>send('/channels','POST',d))}
async function auditView(main){const data=await api('/audit');main.innerHTML=heading(tr("سجل التدقيق"),tr("آخر 200 عملية ضمن نطاق صلاحيتك. الأوقات بتوقيت الرياض."))+(data.length?table([tr("العملية"),tr("المستخدم"),tr("المعرف"),tr("التفاصيل"),tr("الوقت")],data.map(a=>`<tr><td>${esc(a.action)}</td><td>${esc(a.actor_name||tr("طلب عام"))}</td><td>${esc(a.entity_id.slice(0,12))}</td><td>${esc(a.detail||'—')}</td><td>${date(a.created_at)}</td></tr>`)):empty(tr("لا توجد عمليات مسجلة")))}
async function contentView(main){catalog=await api('/catalog?lang='+LANG);main.innerHTML=heading(tr("محتوى الموقع"),tr("أضف المعلومات المعتمدة فقط. الهوية البصرية ستضاف لاحقًا."))+`<div class="stack">${[['about',tr("عن Labbily")],['contact_email',tr("بريد التواصل")],['contact_phone',tr("رقم التواصل")],['working_hours',tr("ساعات العمل")],['about_en','About (English)'],['working_hours_en','Working hours (English)'],['legal_entity',LANG==='en'?'Legal operating entity':'الجهة المشغلة'],['privacy',LANG==='en'?'Privacy policy (Arabic)':'نص سياسة الخصوصية'],['privacy_en','Privacy policy (English)'],['terms',LANG==='en'?'Terms (Arabic)':'نص شروط الاستخدام'],['terms_en','Terms (English)']].map(([k,t])=>`<form class="card content-form" data-key="${k}">${errorBox}${area('value',t,(catalog.content_original||catalog.content)[k]||'',false)}<div class="actions"><button type="submit">${tr("حفظ")}</button></div></form>`).join('')}</div>`;document.querySelectorAll('.content-form').forEach(f=>bindForm(f,async d=>{await send('/admin/content','PUT',{key:f.dataset.key,value:d.value});toast(tr("تم تحديث المحتوى"))}))}
async function inboxView(main){const data=await api('/conversations');const team=await api('/team');main.innerHTML=heading(tr("صندوق المحادثات"),tr("سجل العميل والإسناد والملاحظات الداخلية في مكان واحد."))+`<div class="notice">${tr("الرسائل الواردة تحتاج ربطًا فعليًا. الرد الخارجي غير مفعل؛ الملاحظات الداخلية لا تصل إلى العميل.")}</div><div class="inbox"><div class="conversation-list">${data.length?data.map(c=>`<button class="conversation-item" data-conversation="${c.id}"><b>${esc(c.contact_name)}</b><small>${esc(c.phone)} · ${esc(labels[c.status])}</small></button>`).join(''):empty(tr("لا توجد محادثات"),tr("ستظهر الرسائل بعد إعداد الاستقبال."))}</div><div class="chat" id="chat">${empty(tr("اختر محادثة"),tr("لعرض سجل الرسائل ومتابعة العميل."))}</div></div>`;async function open(id){selectedConversation=id;const c=data.find(x=>x.id===id),messages=await api('/conversations/'+id+'/messages');document.querySelectorAll('[data-conversation]').forEach(b=>b.classList.toggle('active',b.dataset.conversation===id));document.querySelector('#chat').innerHTML=`<div class="chat-header"><b>${esc(c.contact_name)}</b><button id="manage-conversation" class="light small">${tr("الحالة والإسناد")}</button></div><div class="messages">${messages.map(m=>`<div class="message ${esc(m.direction)}">${esc(m.body)}<small>${esc(labels[m.status]||m.status)} · ${date(m.created_at)}</small></div>`).join('')}</div><form class="composer" id="note-form">${errorBox}<label for="note-body" class="small-text">${tr("ملاحظة داخلية للفريق")}</label><textarea id="note-body" name="body" required maxlength="4000" placeholder="${tr("اكتب ملاحظة… لا تُرسل إلى العميل")}"></textarea><div class="actions"><button type="submit">${tr("حفظ الملاحظة")}</button><span class="micro">${tr("الإرسال الخارجي غير مفعل")}</span></div></form>`;document.querySelector('#manage-conversation').onclick=()=>modal(tr("إدارة المحادثة"),select('status',tr("الحالة"),['open','waiting','closed'],c.status)+select('owner_id',tr("المسؤول"),[['',tr("غير مسند")],...team.filter(t=>t.active).map(t=>[t.id,t.name])],c.owner_id||'')+area('close_reason',tr("سبب الإغلاق"),c.close_reason,false),d=>send('/conversations/'+id,'PATCH',d));let key=crypto.randomUUID();const form=document.querySelector('#note-form');const draftKey='labbily.note.'+id;form.elements.body.value=sessionStorage.getItem(draftKey)||'';form.elements.body.oninput=e=>sessionStorage.setItem(draftKey,e.target.value);bindForm(form,async d=>{await send('/conversations/'+id+'/messages','POST',{body:d.body,direction:'note'},{'Idempotency-Key':key});sessionStorage.removeItem(draftKey);await open(id)})}wireRows('data-conversation',open);if(selectedConversation&&data.some(c=>c.id===selectedConversation))await open(selectedConversation)}
async function operationsView(main){const r=await api('/admin/operations');main.innerHTML=heading(tr("صحة التشغيل"),tr("أحداث الاستقبال المحفوظة دون كشف محتوى محادثات الشركات."))+`<div class="stats">${r.webhook_counts.map(x=>`<div class="stat"><span>${esc(labels[x.status]||x.status)}</span><strong>${x.count}</strong></div>`).join('')}</div>`+(r.failed_events.length?table([tr("الحدث"),tr("المحاولات"),tr("الوقت"),''],r.failed_events.map(x=>`<tr><td>${esc(x.id.slice(0,12))}</td><td>${x.attempts}</td><td>${date(x.created_at)}</td><td><button class="light small" data-retry="${x.id}">${tr("إعادة المعالجة")}</button></td></tr>`)):empty(tr("لا توجد أخطاء مستنفدة"),tr("راجع أيضًا تشغيل العامل الخلفي عند تراكم أحداث الانتظار.")));wireRows('data-retry',async id=>{await send('/admin/operations/'+id+'/retry','POST',{});await renderDashboard('operations')})}
function accountView(main){main.innerHTML=heading(tr("إعدادات الحساب"),tr("تغيير كلمة المرور يلغي جميع الجلسات، بما فيها هذه الجلسة."))+`<form id="password-form" class="card login">${errorBox}${field('current_password',tr("كلمة المرور الحالية"),'password')}${field('new_password',tr("كلمة المرور الجديدة"),'password')}<button type="submit">${tr("تحديث كلمة المرور")}</button></form>`;bindForm(document.querySelector('#password-form'),async d=>{await send('/auth/password','POST',d);location.href='/login'})}
async function renderDashboard(view){currentView=view;dashboardShell(view);const main=document.querySelector('#main');try{const renderers={agents:agentStudioView,agentpolicy:agentPolicyView,metadata:metaDataView,privacy:privacyView,privacyops:privacyOpsView,billing:billingView,commerce:commerceView,integrations:providerIntegrationsView,overview,requests:requestsView,tenants:tenantsView,projects:projectsView,contacts:contactsView,opportunities:opportunitiesView,tasks:tasksView,team:teamView,reports:reportsView,channels:channelsView,audit:auditView,content:contentView,operations:operationsView,inbox:inboxView,account:accountView};if(view!=='account'&&!menus[me.role].some(m=>m[0]===view))throw new Error(tr("هذه الصفحة غير متاحة لدورك"));await(renderers[view]||overview)(main)}catch(e){if(e.status===401){location.href='/login';return}main.innerHTML=`<div class="error">${esc(e.message)}</div><button id="retry">${tr("إعادة المحاولة")}</button>`;document.querySelector('#retry').onclick=()=>renderDashboard(view)}}
async function start(){try{catalog=await api('/catalog?lang='+LANG);const path=location.pathname.replace(/\/$/,'')||'/';if(path.startsWith('/app')){try{me=await api('/me')}catch(e){if(pageLeaving||e.name==='AbortError')return;if(e.status===401){location.replace('/login');return}throw e}await renderDashboard(path.split('/')[2]||menus[me.role][0][0]);return}if(path==='/verify-email')await verificationPage();else if(path==='/deletion-status')await deletionStatusPage();else if(path==='/signup')await signupPage();else if(path==='/setup')setupPage();else if(path==='/')home();else if(path==='/services')services();else if(path.startsWith('/services/'))serviceDetail(path.slice('/services/'.length));else if(path==='/request')requestPage();else if(path==='/login')loginPage();else if(path==='/platform'||['/how-it-works','/about','/faq','/pricing','/privacy','/terms'].includes(path))informational(path);else notFound()}catch(e){app.innerHTML=`<main id="main" class="wrap section"><h1>${tr("تعذر تحميل الصفحة")}</h1><p>${esc(e.message)}</p><button id="reload">${tr("إعادة المحاولة")}</button></main>`;document.querySelector('#reload').onclick=()=>location.reload()}}
