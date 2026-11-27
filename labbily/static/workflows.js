'use strict';
const flowTitle=sv('مسارات الأتمتة','Workflows');
for(const role of ['admin','supervisor']) menus[role].splice(3,0,['workflows',flowTitle,'']);
workspaceIcons.workflows='workflow';
const flowTriggers={
  manual:sv('تشغيل يدوي','Manual'),opened:sv('فتح المحادثة','Conversation opened'),closed:sv('إغلاق المحادثة','Conversation closed'),
  field_changed:sv('تغيير بيانات عميل مرتبط','Linked customer updated'),stage_changed:sv('انتقال مرحلة العميل','Customer stage changed')
};
const flowActions={
  message:sv('إرسال رسالة','Send message'),question:sv('طرح سؤال وانتظار الرد','Ask and await reply'),
  condition:sv('شرط وتفرع','Condition'),assign:sv('تسليم إلى الفريق','Hand over to team'),tag:sv('إضافة وسم','Add tag'),
  stage:sv('تحديث المرحلة','Change stage'),wait:sv('انتظار بالدقائق','Wait in minutes'),close:sv('إغلاق المحادثة','Close conversation')
};
const flowFields={channel:sv('القناة','Channel'),team:sv('الفريق','Team'),priority:sv('الأولوية','Priority'),
  status:sv('الحالة','Status'),language:sv('اللغة','Language'),office_hours:sv('ضمن ساعات العمل (yes/no)','Within working hours (yes/no)')};
const flowTemplates=[
  [sv('ترحيب','Welcome'),'opened',[{action:'message',value:sv('أهلًا بك! كيف نقدر نساعدك؟','Welcome! How can we help?')}]],
  [sv('خارج الدوام','Outside working hours'),'opened',[{action:'condition',field:'office_hours',value:'no',otherwise:3},{action:'message',value:sv('شكرًا لتواصلك. سيراجع الفريق رسالتك عند عودة الدوام.','Thanks for contacting us. Our team will review your message during business hours.')}]],
  [sv('توجيه للفريق','Route to team'),'manual',[{action:'assign',value:'support'}]],
  [sv('تأهيل وتسليم','Qualify and hand over'),'manual',[{action:'question',value:sv('ما الخدمة التي تهمك؟','Which service are you interested in?')},{action:'tag',value:'qualified'},{action:'assign',value:'sales'}]]
];
async function workflowsView(main, ident=null) {
  const [list,flow,crm,team]=await Promise.all([api('/v2/workflows'),ident?api('/v2/workflows/'+ident):null,api('/v2/crm/settings'),api('/team')]);
  const stages=[['new',sv('جديد','New')],['interested',sv('مهتم','Interested')],['payment',sv('بانتظار الدفع','Awaiting payment')],['customer',sv('عميل','Customer')],['uninterested',sv('غير مهتم','Not interested')],...crm.stages.map(s=>[s.id,s.name])];
  main.innerHTML=heading(flowTitle,sv('اختبر المسار ثم فعّله للمحادثات المؤهلة.','Test a workflow before activating it for eligible conversations.'),button('new-flow',sv('مسار جديد','New workflow')))+
    '<div class="agent-shell"><aside class="agent-list"></aside><section class="agent-board" id="flow-board"></section></div>';
  const nav=main.querySelector('.agent-list'),board=main.querySelector('#flow-board');
  const wrap=fn=>async e=>{const el=e.currentTarget;el.disabled=true;try{await fn()}catch(err){toast(err.message)}finally{el.disabled=false}};
  let dirty=false;
  function leave(next){if(!dirty||confirm(sv('تجاهل تعديلات المسودة؟','Discard draft edits?')))return workflowsView(main,next)}
  main.querySelector('#new-flow').onclick=wrap(()=>leave(null));
  for(const item of list){
    const b=document.createElement('button');b.className='agent-item';b.textContent=item.name+' · '+(item.active_trigger?sv('نشط','Active'):aw('draft'));
    b.onclick=wrap(()=>leave(item.id));nav.append(b);
  }
  board.innerHTML='<form class="agent-form" id="flow-form">'+errorBox+
    (flow?'':select('template',sv('قالب البداية','Starting template'),[['',sv('مسار مخصص','Custom workflow')],...flowTemplates.map(([name],i)=>[String(i),name])]))+
    field('name',sv('اسم المسار','Workflow name'),'text',flow?.name||'')+
    select('trigger',sv('المشغّل','Trigger'),Object.entries(flowTriggers),flow?.trigger_type||'manual')+
    '<ol class="flow-steps"></ol><div class="actions">'+button('add-step',sv('إضافة خطوة','Add step'),'light')+
    '<button type="submit">'+sv('حفظ المسودة','Save draft')+'</button></div></form><section id="flow-run"></section>';
  const form=board.querySelector('form'),nodes=form.querySelector('ol'),run=board.querySelector('#flow-run');
  let steps=flow?.draft||[{action:'message',value:''}];
  function draw(){
    nodes.replaceChildren();
    steps.forEach((step,i)=>{
      const node=document.createElement('li');node.className='flow-node';
      node.innerHTML=select('kind',sv('الخطوة','Step')+' '+(i+1),Object.entries(flowActions),step.action)+
        (step.action==='condition'?select('match',sv('الحقل','Field'),Object.entries(flowFields),step.field||'channel'):'')+
        (step.action==='stage'?select('value',sv('المرحلة','Stage'),stages,step.value||'new'):
        field('value',({wait:sv('عدد الدقائق','Minutes'),assign:sv('اختر موظفًا أو اكتب اسم الفريق','Choose a staff member or type a team name'),close:sv('سبب الإغلاق','Closure reason'),condition:sv('القيمة المطابقة','Matching value')})[step.action]||sv('القيمة أو النص','Value or text'),step.action==='wait'?'number':'text',step.value))+
        (step.action==='condition'?field('otherwise',sv('عند عدم التطابق انتقل إلى الخطوة (بعد الأخيرة = إنهاء)','If false go to step (after the last = finish)'),'number',step.otherwise||i+2):'')+
        '<button type="button" class="light small">'+sv('حذف الخطوة','Remove step')+'</button>';
      if(step.action==='assign'){
        const entries=document.createElement('datalist');entries.id='flow-assignees-'+i;
        for(const person of team.filter(p=>p.active&&['admin','supervisor','sales'].includes(p.role))){
          const option=document.createElement('option');option.value='user:'+person.id;option.label=person.name;entries.append(option)
        }
        node.append(entries);node.querySelector('[name=value]').setAttribute('list',entries.id);
      }
      const inputs=node.querySelectorAll('input,select');
      node.querySelector('[name=kind]').onchange=e=>{steps[i]={action:e.target.value,value:e.target.value==='stage'?'new':''};dirty=true;draw()};
      for(const input of inputs){if(input.name==='kind')continue;
        const key=input.name==='match'?'field':input.name;const capture=()=>{step[key]=key==='otherwise'?Number(input.value):input.value};
        capture();input.oninput=capture;
      }
      node.querySelector('button').onclick=()=>{steps.splice(i,1);dirty=true;draw()};
      nodes.append(node);
    });
  }
  draw();form.oninput=()=>{dirty=true};
  if(form.elements.template)form.elements.template.onchange=e=>{const template=flowTemplates[e.target.value];if(template){form.elements.name.value=template[0];form.elements.trigger.value=template[1];steps=structuredClone(template[2]);dirty=true;draw()}};
  const add=form.querySelector('#add-step');add.type='button';add.onclick=()=>{if(steps.length<12){steps.push({action:'message',value:''});dirty=true;draw()}};
  bindForm(form,async()=>{
    const r=await send('/v2/workflows'+(ident?'/'+ident:''),ident?'PUT':'POST',{name:form.elements.name.value,trigger:form.elements.trigger.value,revision:flow?.revision||0,steps});
    await workflowsView(main,r.id);
  });
  if(!flow)return;
  const base='/v2/workflows/'+ident;
  run.innerHTML='<h3>'+sv('اختبار المسودة','Test draft')+' · v'+flow.revision+'</h3><form class="agent-form" id="simulate-flow">'+errorBox+
    select('channel',sv('القناة','Channel'),['whatsapp','instagram','messenger'])+select('office_hours',sv('ضمن الدوام','Within working hours'),['yes','no'])+
    field('team',sv('الفريق','Team'),'text','support')+select('priority',sv('الأولوية','Priority'),['normal','low','high','urgent'])+
    select('language',sv('اللغة','Language'),['ar','en'])+select('status',sv('الحالة','Status'),['new','in_progress','waiting_internal','waiting_customer','resolved','closed'])+
    '<button type="submit">'+sv('محاكاة الخطوات','Simulate steps')+'</button></form><p aria-live="polite" id="flow-trace"></p><div class="actions">'+
    button('publish-flow',sv('تفعيل الإصدار المختبَر','Activate tested version'))+(flow.active_trigger?button('pause-flow',sv('إيقاف','Pause'),'light'):'')+'</div>';
  const publish=run.querySelector('#publish-flow');publish.disabled=flow.tested_revision!==flow.revision;
  function saved(){if(dirty)throw new Error(sv('احفظ تعديلات المسودة أولًا','Save draft edits first'))}
  bindForm(run.querySelector('form'),async d=>{
    saved();const result=await send(base+'/simulate','POST',{...d,revision:flow.revision});
    run.querySelector('#flow-trace').textContent=result.trace.map(t=>t.step+'. '+flowActions[t.action]).join(' ← ');publish.disabled=false;
  });
  for(const action of ['publish','pause']){
    const b=run.querySelector('#'+action+'-flow');if(b)b.onclick=wrap(async()=>{saved();await send(base+'/'+action,'POST',{revision:flow.revision});await workflowsView(main,ident)});
  }
  if(flow.active_trigger==='manual'){
    const tickets=await api('/v2/tickets?limit=100');
    if(tickets.length){const box=document.createElement('div');box.className='service-toolbar';
      box.innerHTML=select('ticket',sv('المحادثة','Conversation'),tickets.map(t=>[t.id,t.name+' · '+t.account_label]))+button('run-manual',sv('تشغيل الإصدار النشط','Run active version'),'light');
      run.append(box);let key=crypto.randomUUID();box.querySelector('select').onchange=()=>{key=crypto.randomUUID()};
      box.querySelector('button').onclick=wrap(async()=>{saved();await send(base+'/tickets/'+box.querySelector('select').value,'POST',{}, {'Idempotency-Key':key});await workflowsView(main,ident)});
    }
  }
  if(flow.runs.length)run.insertAdjacentHTML('beforeend','<h3>'+sv('سجل التنفيذ','Run history')+'</h3>'+table([sv('الوقت','Time'),sv('الإصدار','Version'),sv('خطوات منفذة','Steps processed'),sv('الحالة','State')],flow.runs.map(r=>'<tr><td>'+epoch(r.created_at)+'</td><td>'+r.revision+'</td><td>'+r.position+'</td><td>'+esc(r.state)+' '+esc(r.detail)+'</td></tr>')));
}
