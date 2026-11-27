'use strict';
const calendarDay=86400000;
const riyadhWall=instant=>new Date(new Date(instant).getTime()+3*3600000).toISOString().slice(0,16);
const calendarDate=key=>new Date(key+'T00:00:00Z');
const dayKey=d=>d.toISOString().slice(0,10);
const offsetDay=(key,n)=>dayKey(new Date(calendarDate(key).getTime()+n*calendarDay));
const calendarPrefs=new Map();
async function tasksView(main){
 const manager=['admin','supervisor'].includes(me.role);
 const s=calendarPrefs.get(me.id)||{view:'week',anchor:riyadhWall(Date.now()).slice(0,10),q:'',priority:'',status:'',owner:manager?'':'mine'};
 calendarPrefs.set(me.id,s);
 const [rows,team]=await Promise.all([api('/tasks?scope='+(manager?'team':'mine')),manager?api('/team'):[]]);
 const owners=team.filter(u=>u.active&&['admin','supervisor','sales'].includes(u.role)).map(u=>[u.id,u.name]);
 const priorities=[['normal',sv('عادية','Normal')],['high',sv('عالية','High')],['low',sv('منخفضة','Low')]];
 const states=[['open',sv('مفتوحة','Open')],['done',sv('مكتملة','Done')]];
 const views=[['week',sv('أسبوع','Week')],['month',sv('شهر','Month')],['list',sv('قائمة','List')],['board',sv('لوحة','Board')]];
 const all=sv('الكل','All'),today=riyadhWall(Date.now()).slice(0,10),locale=LANG==='en'?'en-GB':'ar-SA-u-ca-gregory';
 const fmt=(key,options)=>calendarDate(key).toLocaleDateString(locale,{...options,timeZone:'UTC'});
 main.innerHTML=heading(sv('المهام','Tasks'),sv('المواعيد بتوقيت الرياض','Schedule in Riyadh time'),button('add-task',sv('＋ إضافة مهمة','＋ Add task')))+
 '<div class="studio-tools"><input type="search" id="task-search" class="search" aria-label="'+sv('بحث في المهام','Search tasks')+'" placeholder="'+sv('ابحث في المهام…','Search tasks…')+'" value="'+esc(s.q)+'">'+
 (manager?select('owner',sv('المسؤول','Assignee'),[['',sv('كل الفريق','Entire team')],...owners],s.owner):'')+
 select('priority',sv('الأولوية','Priority'),[['',all],...priorities],s.priority)+select('status',sv('الحالة','Status'),[['',all],...states],s.status)+'</div>'+
 '<section class="schedule"><header><div class="schedule-dates">'+button('cal-today',sv('اليوم','Today'),'light')+
 '<button class="light" id="cal-prev" aria-label="'+sv('السابق','Previous')+'">'+(LANG==='en'?'‹':'›')+'</button><button class="light" id="cal-next" aria-label="'+sv('التالي','Next')+'">'+(LANG==='en'?'›':'‹')+'</button><strong id="cal-caption"></strong></div><div class="switcher">'+
 views.map(([k,l])=>'<button type="button" class="light" data-mode="'+k+'">'+l+'</button>').join('')+'</div></header><div id="cal-body"></div></section>';
 function edit(task,wall){
  modal(task?sv('تعديل المهمة','Edit task'):sv('إضافة مهمة','Add task'),
    field('title',sv('عنوان المهمة','Task title'),'text',task?.title||'')+field('due_at',sv('الموعد بتوقيت الرياض','Due in Riyadh'),'datetime-local',task?riyadhWall(task.due_at):wall)+
    select('priority',sv('الأولوية','Priority'),priorities,task?.priority||'normal')+
    (manager?select('owner_id',sv('المسؤول','Assignee'),task&&!owners.some(([id])=>id===task.owner_id)?[...owners,[task.owner_id,task.owner_name]]:owners,task?.owner_id||s.owner||me.id):'')+
    (task?select('status',sv('الحالة','Status'),states,task.status):''),async d=>{
      await send('/tasks'+(task?'/'+task.id:''),task?'PATCH':'POST',{...d,due_at:new Date(d.due_at+'+03:00').toISOString()});
      s.anchor=d.due_at.slice(0,10);
    });
 }
 main.querySelector('#add-task').onclick=()=>edit(null,s.anchor+'T09:00');
 const jobs=rows.map(t=>({...t,wall:riyadhWall(t.due_at)})).sort((a,b)=>a.wall.localeCompare(b.wall));
 const card=t=>'<button type="button" class="light cal-job" data-priority="'+esc(t.priority)+'" data-task="'+esc(t.id)+'"><time dir="ltr">'+t.wall.slice(11)+'</time> <strong>'+esc(t.title)+'</strong><small>'+esc(t.owner_name)+'</small></button>';
 const createSlot=(wall,label)=>'<button type="button" class="slot-add" data-slot="'+wall+'" aria-label="'+esc(sv('إضافة مهمة','Add task')+' '+wall)+'">'+label+'</button>';
 const body=main.querySelector('#cal-body');
 function draw(){
  const matches=jobs.filter(t=>(!s.q||t.title.toLocaleLowerCase().includes(s.q.toLocaleLowerCase()))&&(!s.priority||t.priority===s.priority)&&(!s.status||t.status===s.status)&&(!manager||!s.owner||s.owner===t.owner_id));
  const date=calendarDate(s.anchor),monthStart=s.anchor.slice(0,7)+'-01',month=s.view==='month',first=month?monthStart:s.anchor;
  const start=offsetDay(first,-calendarDate(first).getUTCDay());
  const period=s.view==='week'||month;
  main.querySelector('.schedule-dates').hidden=!period;
  main.querySelector('#cal-caption').textContent=month?fmt(monthStart,{month:'long',year:'numeric'}):fmt(start,{day:'numeric',month:'short'})+' – '+fmt(offsetDay(start,6),{day:'numeric',month:'long',year:'numeric'});
  main.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===s.view)));
  if(!period){
   body.innerHTML=s.view==='board'?'<div class="task-board">'+states.map(([k,l])=>'<section><h3>'+l+' <small>'+matches.filter(t=>t.status===k).length+'</small></h3>'+matches.filter(t=>t.status===k).map(t=>'<div><small>'+fmt(t.wall.slice(0,10),{day:'numeric',month:'long'})+'</small>'+card(t)+'</div>').join('')+'</section>').join('')+'</div>':
    matches.length?table([sv('المهمة','Task'),sv('الموعد','Due'),sv('المسؤول','Assignee'),sv('الأولوية','Priority'),sv('الحالة','Status')],matches.map(t=>'<tr><td><button class="light" data-task="'+esc(t.id)+'">'+esc(t.title)+'</button></td><td dir="ltr">'+t.wall.replace('T',' ')+'</td><td>'+esc(t.owner_name)+'</td><td>'+priorities.find(([k])=>k===t.priority)[1]+'</td><td>'+states.find(([k])=>k===t.status)[1]+'</td></tr>')):empty(sv('لا توجد مهام مطابقة','No matching tasks'));
   return;
  }
  const days=Array.from({length:7},(_,i)=>offsetDay(start,i));
  const grouped=new Map();
  for(const t of matches){const key=t.wall.slice(0,month?10:13);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(t)}
  let html='<div class="cal-scroll"><div class="cal-grid '+(month?'month':'week')+'">';
  if(!month)html+='<span class="cal-head">UTC+3</span>';
  html+=days.map(key=>'<div class="cal-head '+(key===today?'is-today':'')+'">'+fmt(key,{weekday:'short'})+(month?'':' <b>'+Number(key.slice(-2))+'</b>')+'</div>').join('');
  if(month){
   const daysInMonth=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
   const count=Math.ceil((calendarDate(monthStart).getUTCDay()+daysInMonth)/7)*7;
   for(let i=0;i<count;i++){
    const key=offsetDay(start,i);
    html+='<div class="cal-cell month-cell '+(key===today?'is-today ':'')+(key.slice(0,7)!==s.anchor.slice(0,7)?'adjacent':'')+'">'+createSlot(key+'T09:00',Number(key.slice(-2)))+(grouped.get(key)||[]).map(card).join('')+'</div>';
   }
  }else{
   for(let h=0;h<24;h++){
    const hour=String(h).padStart(2,'0');
    html+='<div class="cal-hour" dir="ltr">'+hour+':00</div>';
    for(const key of days){const slot=key+'T'+hour;
     html+='<div class="cal-cell '+(key===today?'is-today':'')+'">'+createSlot(slot+':00','＋')+(grouped.get(slot)||[]).map(card).join('')+'</div>';
    }
   }
  }
  const oldTop=body.querySelector('.cal-scroll')?.scrollTop;
  body.innerHTML=html+'</div></div>';
  body.querySelector('.cal-scroll').scrollTop=month?0:(oldTop??(body.querySelector('.cal-hour')?.offsetHeight||52)*8);
 }
 function shift(n){
  if(s.view==='month'){const d=calendarDate(s.anchor.slice(0,7)+'-01');d.setUTCMonth(d.getUTCMonth()+n);s.anchor=dayKey(d)}
  else s.anchor=offsetDay(s.anchor,7*n);
  draw();
 }
 main.querySelector('#cal-prev').onclick=()=>shift(-1);main.querySelector('#cal-next').onclick=()=>shift(1);
 main.querySelector('#cal-today').onclick=()=>{s.anchor=today;draw()};
 main.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{s.view=b.dataset.mode;draw()});
 main.querySelector('#task-search').oninput=e=>{s.q=e.target.value;draw()};
 main.querySelectorAll('.studio-tools select').forEach(el=>el.onchange=()=>{s[el.name]=el.value;draw()});
 body.onclick=e=>{const b=e.target.closest('button');if(b?.dataset.task)edit(jobs.find(t=>t.id===b.dataset.task));else if(b?.dataset.slot)edit(null,b.dataset.slot)};
 draw();
}
