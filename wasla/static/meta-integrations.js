'use strict';
// No access tokens, SDK responses or authorization codes enter storage or logs.
let metaSdkPromise;
function metaSdk(appId,version){
 if(!metaSdkPromise)metaSdkPromise=new Promise((resolve,reject)=>{
  window.fbAsyncInit=()=>{FB.init({appId,version,autoLogAppEvents:false,xfbml:false});resolve()};
  const script=document.createElement('script');script.src='https://connect.facebook.net/en_US/sdk.js';script.async=true;
  script.onerror=()=>{metaSdkPromise=null;reject(new Error(sv('تعذر تحميل نافذة Meta. أعد المحاولة.','Could not load Meta. Please retry.')))};
  document.head.appendChild(script);
 });
 return metaSdkPromise;
}
const originalChannelsView=channelsView;
channelsView=async function(main){
 await originalChannelsView(main);
 const [r,usage]=await Promise.all([api('/v2/meta/readiness'),api('/v2/meta/usage')]);
 const section=document.createElement('section');section.className='card';section.id='meta-integration-center';
 section.innerHTML=`<h2>${sv('ربط WhatsApp عبر Meta','Connect WhatsApp through Meta')}</h2><p>${sv('الربط متاح حاليًا لشركات الاختبار المعتمدة داخل وصلة. نجاح التفويض لا يثبت اعتماد Meta أو نجاح المراسلة الحية.','Onboarding is currently limited to designated test workspaces. Authorization does not prove Meta approval or live messaging.')}</p><button id="meta-prepare" ${r.signup_available?'':'disabled'}>${sv('تجهيز الربط الآمن','Prepare secure connection')}</button><button id="meta-launch" hidden>${sv('متابعة إلى Meta','Continue to Meta')}</button><p id="meta-status" role="status" aria-live="polite">${r.signup_available?'':sv('يلزم أن يضبط مدير مقدم الخدمة تطبيق Meta ويحدد مساحة الاختبار أولًا.','The provider administrator must configure Meta and designate this test workspace first.')}</p>`+
 (r.connections.length?table([sv('الحساب','Account'),sv('حساب الأعمال / المراسلة','Business / messaging account'),sv('التسجيل والأحداث','Registration and events'),sv('الإجراءات','Actions')],r.connections.map(a=>`<tr><td>${esc(a.label)}<small>${esc(a.phone_number_id)}</small></td><td>${esc(a.business_account_id)}</td><td>${esc(a.registration_state)} / ${esc(a.subscription_state)}</td><td><button class="light small" data-meta-register="${esc(a.account_id)}">${sv('تسجيل الرقم','Register number')}</button> <button class="light small" data-meta-subscribe="${esc(a.account_id)}">${sv('اشتراك الأحداث','Subscribe webhooks')}</button></td></tr>`)):'')+
 `<h3>${sv('استخدام عمليات الربط خلال 30 يومًا','Onboarding API usage over 30 days')}</h3><p class="micro">${sv('هذه الأعداد تخص عمليات الربط فقط، ولا تمثل إجمالي رسائل Meta أو رسومها.','Counts cover onboarding operations only, not all Meta traffic or charges.')}</p>`+
 (usage.totals.length?table([sv('العملية','Operation'),sv('الطلبات','Requests'),sv('نجاح','Successful'),sv('فشل','Failed')],usage.totals.map(x=>`<tr><td>${esc(x.operation)}</td><td>${x.requests}</td><td>${x.successful}</td><td>${x.failed}</td></tr>`)):empty(sv('لا توجد عمليات ربط مسجلة','No onboarding operations recorded')));
 main.prepend(section);
 const status=section.querySelector('#meta-status'),prepare=section.querySelector('#meta-prepare'),launch=section.querySelector('#meta-launch');
 const add=document.querySelector('#service-add');if(add)add.onclick=()=>section.scrollIntoView({behavior:'smooth'});
 let pending=null,listener=null,timer=null;
 const cleanup=()=>{if(listener)window.removeEventListener('message',listener);listener=null;clearTimeout(timer);pending=null;launch.hidden=true;prepare.disabled=!r.signup_available};
 prepare.onclick=async()=>{const documentPath=new URL(performance.getEntriesByType('navigation')[0]?.name||location.href).pathname;if(documentPath!=='/app'&&!documentPath.startsWith('/app/')){location.assign(location.href);return}prepare.disabled=true;try{pending=await send('/v2/meta/whatsapp/start','POST',{});await metaSdk(pending.app_id,pending.api_version);launch.hidden=false;status.textContent=sv('اضغط متابعة لفتح نافذة Meta الرسمية.','Continue to open the official Meta window.')}catch(e){cleanup();status.textContent=e.message}};
 launch.onclick=()=>{
  if(!pending)return;launch.disabled=true;let code=null,asset=null,submitting=false;
  const finish=async()=>{if(!code||!asset||submitting)return;submitting=true;
   try{await send('/v2/meta/whatsapp/complete','POST',{state:pending.state,code,business_account_id:asset.messaging_account_ids[0],phone_number_id:asset.phone_number_id});cleanup();toast(sv('تم التحقق من التفويض. أكمل تسجيل الرقم واشتراك الأحداث ثم اختبار الوصول.','Authorization verified. Complete number registration, webhook subscription and access testing.'));await channelsView(main)}catch(e){cleanup();status.textContent=e.message}finally{code=null;asset=null;launch.disabled=false}
  };
  listener=event=>{
   if(!['https://www.facebook.com','https://web.facebook.com'].includes(event.origin))return;
   let data;try{data=typeof event.data==='string'?JSON.parse(event.data):event.data}catch{return}
   if(!data||data.type!=='WA_EMBEDDED_SIGNUP')return;
   if(data.event==='CANCEL'||data.event==='ERROR'){cleanup();launch.disabled=false;status.textContent=sv('لم يكتمل التفويض. يمكنك بدء محاولة جديدة.','Authorization was not completed. You can start again.');return}
   if(data.event!=='FINISH'||data.data?.is_on_biz_app!==false)return;
   if(!Array.isArray(data.data.messaging_account_ids)||data.data.messaging_account_ids.length!==1||!/^\d{1,40}$/.test(data.data.messaging_account_ids[0])||!/^\d{1,40}$/.test(data.data.phone_number_id))return;
   asset=data.data;finish();
  };
  window.addEventListener('message',listener);
  timer=setTimeout(()=>{cleanup();launch.disabled=false;status.textContent=sv('انتهت مهلة الربط. ابدأ من جديد.','Connection timed out. Start again.')},600000);
  FB.login(response=>{if(!pending)return;if(response.authResponse?.code){code=response.authResponse.code;finish()}else{cleanup();launch.disabled=false;status.textContent=sv('أُلغي الربط.','Connection cancelled.')}},{config_id:pending.config_id,response_type:'code',override_default_response_type:true,extras:pending.extras});
 };
 section.querySelectorAll('[data-meta-register]').forEach(b=>b.onclick=()=>modal(sv('تسجيل رقم Cloud API','Register Cloud API number'),`<p class="full">${sv('للرقم الجديد في Cloud API فقط. احفظ PIN المكون من ستة أرقام بأمان؛ لا يحفظه وصلة.','For a standard Cloud API number only. Keep your six-digit PIN securely; Wasla does not store it.')}</p>`+secretField('pin',sv('رمز PIN من ستة أرقام','Six-digit PIN')),async d=>{await send('/v2/meta/accounts/'+b.dataset.metaRegister+'/register','POST',d)}));
 section.querySelectorAll('[data-meta-subscribe]').forEach(b=>b.onclick=async()=>{try{await send('/v2/meta/accounts/'+b.dataset.metaSubscribe+'/subscribe','POST',{});await channelsView(main)}catch(e){toast(e.message)}});
};
