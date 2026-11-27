'use strict';
const flowTitle=sv('مسارات الأتمتة','Workflows');
for(const role of ['admin','supervisor']) menus[role].splice(3,0,['workflows',flowTitle,'']);
workspaceIcons.workflows='workflow';
const flowTriggers={
  contact_created:sv('إنشاء جهة اتصال','Contact created'),manual:sv('تشغيل يدوي','Manual'),opened:sv('فتح المحادثة','Conversation opened'),closed:sv('إغلاق المحادثة','Conversation closed'),
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
async function workflowsView(main, ident=null, preset=null) {
  const [flow,crm,team]=await Promise.all([ident?api('/v2/workflows/'+ident):null,api('/v2/crm/settings'),api('/team')]);
  const stages=[['new',sv('جديد','New')],['interested',sv('مهتم','Interested')],['payment',sv('بانتظار الدفع','Awaiting payment')],['customer',sv('عميل','Customer')],['uninterested',sv('غير مهتم','Not interested')],...crm.stages.map(s=>[s.id,s.name])];
  const wrap=fn=>studioActions(main,fn);
  let dirty=false;
  main.innerHTML='<section id="flow-board" class="flow-editor"></section>';
  const board=main.querySelector('#flow-board');
  const blank=sv('مسار مخصص','Custom workflow');
  board.innerHTML='<form id="flow-form">'+errorBox+'<header class="flow-bar">'+studioButton('flow-back',sv('سير العمل','Workflows'))+
    field('name',sv('اسم سير العمل','Workflow name'),'text',flow?.name||'')+
    '<span class="flow-state">'+(flow?.active_trigger?sv('نشط','Active'):aw('draft'))+'</span>'+
    '<button type="submit">'+sv('حفظ كمسودة','Save draft')+'</button></header>'+
    '<div class="flow-paper"><div class="flow-controls">'+
    studioButton('zoom-in','＋')+'<output id="flow-scale">100%</output>'+studioButton('zoom-out','−')+studioButton('zoom-reset','⊙')+
    studioButton('flow-undo','↶')+studioButton('flow-redo','↷')+'</div><div class="flow-scroll"><div class="flow-stack">'+
    '<details class="flow-trigger" open><summary><span class="node-icon">'+icon('automation')+'</span><span><small>'+sv('المحفّز','Trigger')+'</small><strong id="trigger-title"></strong></span></summary><div>'+
    select('trigger',sv('عند حدوث','When this happens'),Object.entries(flowTriggers),flow?.trigger_type||'contact_created')+
    (flow?'':select('template',sv('قالب البداية','Starting template'),[['',blank],...flowTemplates.map(([name],i)=>[String(i),name])]))+
    '</div></details><ol class="flow-steps"></ol>'+studioButton('add-step',sv('＋ إضافة خطوة','＋ Add step'))+
    '</div></div></div></form><section id="flow-run"></section>';
  const form=board.querySelector('form'),nodes=form.querySelector('ol'),run=board.querySelector('#flow-run');
  let steps=flow?.draft||[{action:'condition',field:'source',value:'manual',otherwise:2}];
  const crmTrigger=()=>form.elements.trigger.value==='contact_created';
  const sources=[['manual',sv('إدخال يدوي','Manual entry')],['import',sv('استيراد CSV','CSV import')],['channel',sv('قناة تواصل','Messaging channel')]];
  const snapshot=()=>JSON.stringify({name:form.elements.name.value,trigger:form.elements.trigger.value,template:form.elements.template?.value,steps});
  let past=[],future=[],last,scale=100;
  const undo=board.querySelector('#flow-undo'),redo=board.querySelector('#flow-redo');
  function historyControls(){undo.disabled=!past.length;redo.disabled=!future.length}
  function remember(){
    const next=snapshot();
    if(next===last)return;
    past.push(last);if(past.length>60)past.shift();future=[];last=next;dirty=true;historyControls();
  }
  function restore(from,to){
    if(!from.length)return;
    to.push(last);last=from.pop();const state=JSON.parse(last);
    form.elements.name.value=state.name;form.elements.trigger.value=state.trigger;
    if(form.elements.template)form.elements.template.value=state.template;
    steps=state.steps;dirty=true;draw();historyControls();
  }
  undo.onclick=()=>restore(past,future);redo.onclick=()=>restore(future,past);
  const labels={'flow-undo':sv('تراجع','Undo'),'flow-redo':sv('إعادة','Redo'),'zoom-in':sv('تكبير','Zoom in'),'zoom-out':sv('تصغير','Zoom out'),'zoom-reset':sv('الحجم الأصلي','Reset zoom')};
  for(const [id,label] of Object.entries(labels)){
    const el=board.querySelector('#'+id);el.title=label;el.setAttribute('aria-label',label);
    if(id.startsWith('zoom'))el.onclick=()=>{scale=id==='zoom-reset'?100:Math.max(60,Math.min(150,scale+(id==='zoom-in'?10:-10)));board.querySelector('.flow-stack').style.zoom=scale+'%';board.querySelector('#flow-scale').textContent=scale+'%'};
  }
  board.querySelector('#flow-back').onclick=wrap(async()=>{if(!dirty||confirm(sv('تجاهل تعديلات المسودة؟','Discard draft edits?')))await workflowDirectory(main)});
  form.addEventListener('invalid',e=>{const group=e.target.closest('details');if(group)group.open=true},true);
  function draw(openIndex=-1){
    board.querySelector('#trigger-title').textContent=flowTriggers[form.elements.trigger.value];
    nodes.replaceChildren();
    steps.forEach((step,i)=>{
      const node=document.createElement('li');node.className='flow-node';
      node.dataset.kind=step.action;
      node.innerHTML='<details '+(openIndex===i?'open':'')+'><summary><span class="node-icon">'+icon(step.action==='condition'?'workflow':'messages')+'</span><span><small>'+sv('الخطوة','Step')+' '+(i+1)+'</small><strong>'+esc(flowActions[step.action])+'</strong></span></summary><p class="node-description">'+esc(step.value||sv('انقر للإعداد','Click to configure'))+'</p><div class="node-fields">'+select('kind',sv('الخطوة','Step')+' '+(i+1),Object.entries(flowActions).filter(([k])=>!crmTrigger()||['tag','stage','condition'].includes(k)),step.action)+
        (step.action==='condition'?select('match',sv('الحقل','Field'),crmTrigger()?[['source',sv('مصدر جهة الاتصال','Contact source')]]:Object.entries(flowFields),step.field||'channel'):'')+
        (step.action==='condition'&&crmTrigger()?select('value',sv('المصدر','Source'),sources,step.value||'manual'):step.action==='stage'?select('value',sv('المرحلة','Stage'),stages,step.value||'new'):
        field('value',({wait:sv('عدد الدقائق','Minutes'),assign:sv('اختر موظفًا أو اكتب اسم الفريق','Choose a staff member or type a team name'),close:sv('سبب الإغلاق','Closure reason'),condition:sv('القيمة المطابقة','Matching value')})[step.action]||sv('القيمة أو النص','Value or text'),step.action==='wait'?'number':'text',step.value))+
        (step.action==='condition'?field('otherwise',sv('عند عدم التطابق انتقل إلى الخطوة (بعد الأخيرة = إنهاء)','If false go to step (after the last = finish)'),'number',step.otherwise||i+2):'')+
        '<button type="button" class="light small">'+sv('حذف الخطوة','Remove step')+'</button></div></details>';
      if(step.action==='assign'){
        const entries=document.createElement('datalist');entries.id='flow-assignees-'+i;
        for(const person of team.filter(p=>p.active&&['admin','supervisor','sales'].includes(p.role))){
          const option=document.createElement('option');option.value='user:'+person.id;option.label=person.name;entries.append(option)
        }
        node.append(entries);node.querySelector('[name=value]').setAttribute('list',entries.id);
      }
      const inputs=node.querySelectorAll('input,select');
      node.querySelector('[name=kind]').onchange=e=>{steps[i]={action:e.target.value,value:e.target.value==='stage'?'new':''};draw(i);remember()};
      for(const input of inputs){if(input.name==='kind')continue;
        const key=input.name==='match'?'field':input.name;const capture=()=>{step[key]=key==='otherwise'?Number(input.value):input.value};
        capture();input.oninput=()=>{capture();node.querySelector('.node-description').textContent=step.value;remember()};
      }
      node.querySelector('button').onclick=()=>{steps.splice(i,1);draw();remember()};
      nodes.append(node);
    });
  }
  function useTemplate(key){
    const template=key===''?null:flowTemplates[key];
    if(!template)return;
    form.elements.template.value=String(key);form.elements.name.value=template[0];form.elements.trigger.value=template[1];steps=structuredClone(template[2]);draw();
  }
  if(preset!==null)useTemplate(preset);
  draw();last=snapshot();historyControls();
  form.elements.name.onchange=remember;
  form.elements.name.oninput=()=>{dirty=true};
  form.elements.trigger.onchange=()=>{
    const previous=JSON.parse(last).trigger;
    if((previous==='contact_created')!==crmTrigger()&&steps.length){
      if(!confirm(sv('تغيير نوع المحفّز يستلزم إعادة إعداد الخطوات. متابعة؟','Switch trigger type and reset the steps?'))){form.elements.trigger.value=previous;return}
      steps=[];
    }
    draw();remember();
  };
  if(form.elements.template)form.elements.template.onchange=e=>{useTemplate(e.target.value);remember()};
  const add=form.querySelector('#add-step');
  add.onclick=()=>{if(steps.length<12){steps.push({action:crmTrigger()?'tag':'message',value:''});draw(steps.length-1);remember()}else toast(sv('الحد 12 خطوة','Maximum 12 steps'))};
  bindForm(form,async()=>{
    const r=await send('/v2/workflows'+(ident?'/'+ident:''),ident?'PUT':'POST',{name:form.elements.name.value,trigger:form.elements.trigger.value,revision:flow?.revision||0,steps});
    await workflowsView(main,r.id);
  });
  if(!flow)return;
  const base='/v2/workflows/'+ident;
  run.innerHTML='<h3>'+sv('اختبار المسودة','Test draft')+' · v'+flow.revision+'</h3><form class="agent-form" id="simulate-flow">'+errorBox+
    (flow.trigger_type==='contact_created'?select('source',sv('مصدر جهة الاتصال','Contact source'),sources):select('channel',sv('القناة','Channel'),['whatsapp','instagram','messenger'])+select('office_hours',sv('ضمن الدوام','Within working hours'),['yes','no'])+
    field('team',sv('الفريق','Team'),'text','support')+select('priority',sv('الأولوية','Priority'),['normal','low','high','urgent'])+
    select('language',sv('اللغة','Language'),['ar','en'])+select('status',sv('الحالة','Status'),['new','in_progress','waiting_internal','waiting_customer','resolved','closed']))+
    '<button type="submit">'+sv('محاكاة الخطوات','Simulate steps')+'</button></form><p aria-live="polite" id="flow-trace"></p><div class="actions">'+
    button('publish-flow',sv('تفعيل الإصدار المختبَر','Activate tested version'))+(flow.active_trigger?button('pause-flow',sv('إيقاف','Pause'),'light'):'')+'</div>';
  const publish=run.querySelector('#publish-flow');publish.type='button';
  board.querySelector('.flow-bar').append(publish);
  publish.disabled=flow.tested_revision!==flow.revision;
  function saved(){if(dirty)throw new Error(sv('احفظ تعديلات المسودة أولًا','Save draft edits first'))}
  bindForm(run.querySelector('form'),async d=>{
    saved();const result=await send(base+'/simulate','POST',{...d,revision:flow.revision});
    run.querySelector('#flow-trace').textContent=result.trace.map(t=>t.step+'. '+flowActions[t.action]).join(' ← ');publish.disabled=false;
  });
  for(const action of ['publish','pause']){
    const b=board.querySelector('#'+action+'-flow');if(b)b.onclick=wrap(async()=>{saved();await send(base+'/'+action,'POST',{revision:flow.revision});await workflowsView(main,ident)});
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
