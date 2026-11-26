"""Tenant-owned, versioned agent decisions. The automatic path can only quote approved answers."""
import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from fastapi import HTTPException
from .db import one, rows, uid, now, postgres

DEFAULT_LIMITS = {'max_agents':3, 'monthly_runs':500, 'live_enabled':0, 'external_enabled':0}
MODES = {'suggest', 'internal', 'auto', 'hybrid'}
HUMAN = ('talk to a human','speak to a human','speak to an agent','human agent','موظف','تصعيد','شكوى','بشري')
FOLLOW = ('follow up','follow-up','متابعة','تابع طلبي')

def limits(db, tid):
    policy=one(db,'SELECT * FROM agent_limits WHERE tenant_id=?',(tid,)) or dict(DEFAULT_LIMITS)
    policy['knowledge_documents']=100
    sub=one(db,'SELECT status,snapshot FROM service_subscriptions WHERE tenant_id=?',(tid,))
    if sub:
        plan=json.loads(sub['snapshot']).get('limits',{})
        for key in ('max_agents','monthly_runs','knowledge_documents'):
            if key in plan:policy[key]=min(policy[key],plan[key])
        if sub['status']=='paused':
            policy.update(live_enabled=0,external_enabled=0,max_agents=0,monthly_runs=0,knowledge_documents=0)
    return policy

def month():
    return datetime.now(timezone.utc).strftime('%Y-%m')

def reserve(db, tid, ceiling):
    if ceiling <= 0:
        return False
    result=db.execute('''INSERT INTO agent_usage(tenant_id,month,runs) VALUES(?,?,1)
        ON CONFLICT(tenant_id,month) DO UPDATE SET runs=agent_usage.runs+1 WHERE agent_usage.runs<?''',
        (tid,month(),ceiling))
    return result.rowcount == 1

def normalized(value):
    return ' '.join(re.findall(r'[^\W_]+', ''.join(c for c in unicodedata.normalize('NFKD',value.casefold())
        if not unicodedata.combining(c)),re.UNICODE))

def case_data(value):
    try:
        data=json.loads(value)
        if isinstance(data,dict) and isinstance(data.get('question'),str):return data
    except ValueError:pass
    return {'question':value}

def run_case(cfg,raw):
    data=case_data(raw)
    return decide(cfg,data['question'],data)

def decide(cfg, question, context=None):
    query=normalized(question)
    if any(normalized(w) in query for w in (*HUMAN,*cfg.get('handover_terms',[]))):
        return {'kind':'handover','reason':'human_requested','answer':'','source':''}
    for index,rule in enumerate(cfg.get('rules',[])):
        key=rule['field'];val=normalized(rule['value'])
        match=(val in query) if key=='text' else ((context or {}).get(key)==rule['value'])
        result=rule['action'] if match else rule.get('otherwise','continue')
        if result=='continue':continue
        if result=='knowledge':break
        if result in ('followup','availability','order','webhook') and result not in cfg.get('tools',[]):result='handover'
        return {'kind':result,'reason':'workflow_'+str(index+1),'answer':'','source':''}
    if any(normalized(w) in query for w in FOLLOW) and 'followup' in cfg.get('tools',[]):
        return {'kind':'followup','reason':'followup_requested','answer':'','source':''}
    words=set(query.split())
    scored=[]
    for source in cfg['sources']:
        variants=[normalized(s) for s in [source['title'],*source.get('aliases',[])]]
        exact=query in variants and bool(query)
        rank=max((len(words & set(v.split()))/max(1,len(words | set(v.split()))) for v in variants),default=0)
        if exact or rank>=0.45:
            scored.append((exact,rank,source))
    scored.sort(key=lambda item:(item[0],item[1]),reverse=True)
    if scored and (len(scored)==1 or scored[0][:2]!=scored[1][:2]):
        exact,_,source=scored[0]
        return {'kind':'answer' if exact else 'review','reason':'approved_source' if exact else 'partial_match',
                'answer':source['answer'],'source':source['title']}
    passages=[]
    for document in cfg.get('documents',[]):
        for chunk in document['chunks']:
            tokens=set(normalized(chunk).split())
            common=len(words & tokens)
            if common>=2 and common/max(1,len(words))>=0.6:
                passages.append((common/max(1,len(words))+common/max(1,len(tokens)),document['title'],chunk))
    if passages:
        _,title,chunk=max(passages)
        return {'kind':'review','reason':'document_excerpt','answer':chunk,'source':title}
    return {'kind':'handover','reason':'no_reliable_source','answer':'','source':''}

def render_variables(db,t,account,answer):
    if '{{' not in answer and '}}' not in answer:return answer
    identity=one(db,'SELECT name,customer_id FROM service_identities WHERE id=? AND tenant_id=?',(t['identity_id'],t['tenant_id']))
    contact=one(db,'SELECT name,phone FROM contacts WHERE id=? AND tenant_id=?',(identity['customer_id'],t['tenant_id'])) if identity else None
    company=one(db,'SELECT name FROM tenants WHERE id=?',(t['tenant_id'],))
    owner=one(db,'SELECT name FROM users WHERE id=? AND tenant_id=?',(t['assignee_id'],t['tenant_id']))
    from .service import settings
    hours=settings(db,t['tenant_id'])
    name=(contact or identity or {}).get('name','')
    values={'customer.first_name':name.split()[0] if name else '', 'customer.phone':(contact or {}).get('phone',''),
            'company.name':company['name'],'conversation.channel':account['channel'],'assigned_agent.name':(owner or {}).get('name',''),
            'company.business_hours':str(hours['start_hour'])+':00–'+str(hours['end_hour'])+':00 '+hours['timezone'],
            'current_datetime':now()}
    def substitute(m):
        value=values.get(m.group(1).strip())
        if not value:raise ValueError('variable_unavailable')
        return value
    try:
        rendered=re.sub(r'\{\{([^{}]{1,80})\}\}',substitute,answer)
        return None if '{{' in rendered or '}}' in rendered else rendered[:4000]
    except ValueError:return None

def deployment(db,tid,account):
    return one(db,'''SELECT d.mode,a.id,a.published,v.config FROM agent_deployments d
      JOIN ai_agents a ON a.id=d.agent_id AND a.tenant_id=d.tenant_id
      JOIN agent_versions v ON v.agent_id=a.id AND v.version=a.published
      WHERE d.tenant_id=? AND d.account_id=? AND a.state='published' ''',(tid,account))

def dispatch_allowed(db,ticket,account,payload):
    d=deployment(db,ticket['tenant_id'],account['id'])
    return (d and d['mode'] in ('auto','hybrid') and d['id']==payload['agent_id']
            and d['published']==payload['agent_version'] and ticket['version']==payload['ticket_version']
            and ticket['snoozed_until']<=int(time.time()) and not ticket['automation_paused'] and not ticket['assignee_id']
            and limits(db,ticket['tenant_id'])['live_enabled'])

def handle_inbound(db,account,ticket_id,message_id,body,stamp):
    started=time.monotonic()
    tid=account['tenant_id']
    d=deployment(db,tid,account['id'])
    if not d or not limits(db,tid)['live_enabled']:
        return
    t=one(db,'SELECT * FROM service_tickets WHERE tenant_id=? AND id=?',(tid,ticket_id))
    if (t['snoozed_until']>int(time.time()) or t['automation_paused'] or t['assignee_id'] or stamp<t['last_customer_at']
        or t['status'] in ('closed','resolved') or one(db,'SELECT id FROM agent_runs WHERE inbound_id=?',(message_id,))):
        return
    cfg=json.loads(d['config'])
    decision=decide(cfg,body,{'channel':account['channel'],'language':t['language'],'priority':t['priority']})
    if not reserve(db,tid,limits(db,tid)['monthly_runs']):
        decision={'kind':'handover','reason':'usage_limit','answer':'','source':''}
    kind=decision['kind']
    policy_limits=limits(db,tid)
    if ((kind in ('availability','order','webhook')) or
        (decision['reason']=='no_reliable_source' and cfg.get('model_routing') and policy_limits['external_enabled'])):
        from .agent_jobs import enqueue_job
        enqueue_job(db,t,d,message_id,kind if kind in ('availability','order','webhook') else 'model')
        return
    # Never transform a fuzzy retrieval match or an uncertain system result into an automatic send.
    run_id=uid()
    mid=uid()
    task_id=None
    clock=int(time.time())
    output=render_variables(db,t,account,decision['answer'])
    if output is None:kind='handover';decision['reason']='variable_unavailable';output=''
    if kind=='answer' and d['mode'] in ('auto','hybrid'):
        from .service import policy
        from .saas import consume_message
        payload={'kind':'text','agent_id':d['id'],'agent_version':d['published'],'ticket_version':t['version']+1}
        try:
            policy(db,account,t,payload)
            consume_message(db,tid)
        except HTTPException:
            kind='handover'
            decision['reason']='delivery_policy'
        else:
            db.execute("""INSERT INTO service_messages(id,tenant_id,ticket_id,account_id,direction,kind,body,status,occurred_at,created_at)
                VALUES(?,?,?,?,'out','text',?,'queued',?,?)""",(mid,tid,ticket_id,account['id'],output,clock,clock))
            db.execute("""INSERT INTO service_outbox(id,tenant_id,message_id,request_key,payload_hash,payload,state,created_at)
                VALUES(?,?,?,?,?,?,'queued',?)""",(uid(),tid,mid,'agent:'+message_id,message_id,json.dumps(payload),clock))
            kind='auto_queued'
    if kind!='auto_queued':
        if kind in ('handover','followup'):
            owner=one(db,"SELECT id FROM users WHERE tenant_id=? AND active=1 AND role IN ('admin','supervisor') ORDER BY role,id LIMIT 1",(tid,))
            if kind=='followup' and owner:
                task_id=uid()
                db.execute("INSERT INTO tasks(id,tenant_id,owner_id,title,due_at,status,created_at) VALUES(?,?,?,?,?,'open',?)",
                           (task_id,tid,owner['id'],'متابعة محادثة / Conversation follow-up',now(),now()))
            summary=('سبب التحويل / Reason: '+decision['reason']+'\n'+body[:700]+'\n'+
                     ('مهمة متابعة / Follow-up: '+task_id if task_id else 'الخطوة التالية / Next: مراجعة الموظف'))
            db.execute("""UPDATE service_tickets SET automation_paused=1,status='waiting_internal',summary=?,
                          assignee_id=COALESCE(assignee_id,?) WHERE id=? AND tenant_id=?""",(summary,owner['id'] if owner else None,ticket_id,tid))
            output=summary
        else:
            kind='internal' if d['mode']=='internal' else 'suggestion'
        db.execute("""INSERT INTO service_messages(id,tenant_id,ticket_id,account_id,direction,kind,body,status,occurred_at,created_at)
                      VALUES(?,?,?,?,'note','text',?,'internal',?,?)""",(mid,tid,ticket_id,account['id'],output,clock,clock))
    db.execute('UPDATE service_tickets SET version=version+1 WHERE id=? AND tenant_id=?',(ticket_id,tid))
    db.execute('''INSERT INTO agent_runs(id,tenant_id,agent_id,version,ticket_id,inbound_id,note_id,task_id,result,source_title,elapsed_ms,created_at)
                  VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',(run_id,tid,d['id'],d['published'],ticket_id,message_id,mid,task_id,kind,decision['source'],int((time.monotonic()-started)*1000),now()))
