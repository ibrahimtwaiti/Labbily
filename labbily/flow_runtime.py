"""Durable workflow execution shared by HTTP and standalone workers."""
import json
import time
from fastapi import HTTPException
from .agent_engine import HUMAN, normalized
from .db import now, one, postgres, transaction, uid
from . import service


def advance(step, pos, context):
    if step['action']=='condition' and str(context.get(step['field'],''))!=step['value']:
        return step['otherwise']-1
    return pos+1


def update_contact_step(db, contact, kind, value):
    cid=contact['id']
    profile=one(db,'SELECT stage FROM contact_profiles WHERE contact_id=?',(cid,)) or {'stage':'new'}
    stage=value if kind=='stage' else profile['stage']
    if kind=='tag':
        tags=[x.strip() for x in contact['tags'].split(',') if x.strip()]
        if value not in tags:tags.append(value)
        joined=', '.join(tags)
        if len(joined)>400:raise HTTPException(409,'tag_limit')
        db.execute('UPDATE contacts SET tags=? WHERE id=?',(joined,cid))
    elif stage!=profile['stage']:
        db.execute('INSERT INTO contact_stage_history VALUES(?,?,?,?)',(uid(),cid,stage,now()))
    db.execute("""INSERT INTO contact_profiles(contact_id,stage,email,revision) VALUES(?,?,'',1) ON CONFLICT(contact_id)
                  DO UPDATE SET stage=excluded.stage,revision=contact_profiles.revision+1""",(cid,stage))


def on_contact_created(db, tenant, ident, source):
    flow=one(db,"SELECT id,published,published_revision FROM workspace_flows WHERE tenant_id=? AND active_trigger='contact_created'",(tenant,))
    if not flow:return
    if one(db,'SELECT contact_id FROM contact_creation_runs WHERE flow_id=? AND contact_id=?',(flow['id'],ident)):return
    steps=json.loads(flow['published'])
    pos=count=0
    state,detail='done',''
    db.execute('SAVEPOINT contact_steps')
    try:
        while pos<len(steps):
            step=steps[pos]
            if step['action']!='condition':
                contact=one(db,'SELECT id,tags FROM contacts WHERE tenant_id=? AND id=?',(tenant,ident))
                update_contact_step(db,contact,step['action'],step['value'])
            pos=advance(step,pos,{'source':source})
            count+=1
    except HTTPException as exc:
        db.execute('ROLLBACK TO SAVEPOINT contact_steps')
        state,detail,count='failed',str(exc.detail),0
    finally:
        db.execute('RELEASE SAVEPOINT contact_steps')
    db.execute('INSERT INTO contact_creation_runs(flow_id,contact_id,revision,position,state,detail,created_at) VALUES(?,?,?,?,?,?,?)',
               (flow['id'],ident,flow['published_revision'],count,state,detail,int(time.time())))


def trigger(db, tid, ticket_id, kind, event_id, flow_id=None):
    sql='SELECT * FROM workspace_flows WHERE tenant_id=? AND active_trigger=?'
    flow=one(db,sql+' AND id=?',(tid,kind,flow_id)) if flow_id else one(db,sql,(tid,kind))
    if not flow:return None
    ident=uid()
    db.execute("""INSERT INTO workspace_flow_runs(id,tenant_id,flow_id,ticket_id,event_id,revision,steps,state,created_at)
                  VALUES(?,?,?,?,?,?,?,'pending',?) ON CONFLICT(flow_id,event_id,ticket_id) DO NOTHING""",
               (ident,tid,flow['id'],ticket_id,event_id,flow['published_revision'],flow['published'],int(time.time())))
    run=one(db,'SELECT id FROM workspace_flow_runs WHERE flow_id=? AND event_id=? AND ticket_id=?',(flow['id'],event_id,ticket_id))
    return run['id'] if run else None


def stop_ticket_runs(db,ticket_id,reason):
    db.execute("UPDATE workspace_flow_runs SET state='stopped',detail=? WHERE ticket_id=? AND state IN ('pending','queued','answer','dispatch')",(reason,ticket_id))


_HANDOVER_TERMS=tuple(normalized(word) for word in HUMAN)


def on_inbound(db,tid,ticket_id,message_id,body,opened):
    if not one(db,'SELECT id FROM workspace_flows WHERE tenant_id=? AND active_trigger IS NOT NULL LIMIT 1',(tid,)):
        return
    query=normalized(body)
    if any(word in query for word in _HANDOVER_TERMS):
        db.execute("UPDATE service_tickets SET automation_paused=1,status='waiting_internal',version=version+1 WHERE id=? AND automation_paused=0",(ticket_id,))
        stop_ticket_runs(db,ticket_id,'human_requested')
        return
    resumed=db.execute("UPDATE workspace_flow_runs SET state='queued' WHERE ticket_id=? AND state='answer'",(ticket_id,)).rowcount
    if opened and not resumed:trigger(db,tid,ticket_id,'opened',message_id)


def dispatch_allowed(db,t,p):
    run=one(db,"""SELECT r.state,r.revision,f.published_revision,f.active_trigger FROM workspace_flow_runs r
                  JOIN workspace_flows f ON f.id=r.flow_id WHERE r.id=? AND r.ticket_id=? AND f.tenant_id=?""",
            (p['flow_run_id'],t['id'],t['tenant_id']))
    return bool(run and run['state']=='dispatch' and run['active_trigger'] and run['revision']==run['published_revision']
                and not one(db,'SELECT agent_id FROM agent_deployments d JOIN service_identities i ON i.account_id=d.account_id WHERE i.id=?',(t['identity_id'],))
                and not t['assignee_id'] and not t['automation_paused'] and t['snoozed_until']<=int(time.time()))


def perform(db,run,t,step,clock):
    from .saas import consume_message
    from datetime import datetime
    from zoneinfo import ZoneInfo
    pos=run['position'];kind=step['action'];value=step['value']
    identity=one(db,'SELECT * FROM service_identities WHERE id=? AND tenant_id=?',(t['identity_id'],t['tenant_id']))
    account=one(db,'SELECT * FROM service_accounts WHERE id=? AND tenant_id=?',(identity['account_id'],t['tenant_id']))
    cfg=service.settings(db,t['tenant_id'])
    metadata_after_close = t['status'] in ('closed','resolved') and kind in ('condition','tag','stage','wait')
    if cfg['sending_paused'] or (not metadata_after_close and (t['assignee_id'] or t['automation_paused'] or t['snoozed_until']>clock)):
        raise HTTPException(409,'manual_control')
    if t['status'] in ('closed','resolved') and kind not in ('condition','tag','stage','wait'):
        raise HTTPException(409,'ticket_closed')
    if kind=='condition':
        local=datetime.fromtimestamp(clock,ZoneInfo(cfg['timezone']))
        working=local.weekday() in cfg['workdays'] and cfg['start_hour']<=local.hour<cfg['end_hour'] and local.date().isoformat() not in cfg['holidays']
        context={**t,'channel':account['channel'],'office_hours':'yes' if working else 'no'}
        return advance(step,pos,context),'queued',clock
    if kind=='wait':return pos+1,'queued',clock+int(value)*60
    if kind in ('message','question'):
        if one(db,'SELECT agent_id FROM agent_deployments WHERE account_id=?',(account['id'],)):
            raise HTTPException(409,'agent_controls_channel')
        payload={'kind':'text','flow_run_id':run['id'],'flow_question':kind=='question'}
        service.policy(db,account,t,payload);consume_message(db,t['tenant_id'])
        mid=uid();key=run['id']+'-'+str(pos)
        db.execute("""INSERT INTO service_messages(id,tenant_id,ticket_id,account_id,direction,kind,body,status,occurred_at,created_at)
                      VALUES(?,?,?,?,'out','text',?,'queued',?,?)""",(mid,t['tenant_id'],t['id'],account['id'],value,clock,clock))
        db.execute("""INSERT INTO service_outbox(id,tenant_id,message_id,request_key,payload_hash,payload,state,created_at)
                      VALUES(?,?,?,?,?,?,'queued',?)""",(uid(),t['tenant_id'],mid,key,key,json.dumps(payload),clock))
        return pos+1,'dispatch',clock
    if kind in ('tag','stage'):
        contact=one(db,'SELECT * FROM contacts WHERE id=? AND tenant_id=?'+(' FOR UPDATE' if postgres() else ''),(identity['customer_id'],t['tenant_id']))
        if not contact:raise HTTPException(409,'linked_customer_required')
        update_contact_step(db,contact,kind,value)
    elif kind=='assign':
        owner=None
        team=t['team']
        if value.startswith('user:'):
            owner=value[5:]
            member=one(db,"SELECT id FROM users WHERE id=? AND tenant_id=? AND active=1 AND role IN ('admin','sales','supervisor')"+
                       (' FOR UPDATE' if postgres() else ''),(owner,t['tenant_id']))
            if not member:raise HTTPException(409,'assignee_unavailable')
            workload=db.execute("SELECT count(*) FROM service_tickets WHERE assignee_id=? AND status NOT IN ('closed','resolved')",(owner,)).fetchone()[0]
            if workload>=cfg['max_active']:raise HTTPException(409,'assignee_at_capacity')
        else:
            team=value
        db.execute("UPDATE service_tickets SET team=?,assignee_id=?,automation_paused=1,status='waiting_internal',version=version+1,updated_at=? WHERE id=?",(team,owner,clock,t['id']))
        return pos+1,'done',clock
    elif kind=='close':
        db.execute("UPDATE service_tickets SET status='closed',resolution_code=?,resolved_at=?,first_resolved_at=COALESCE(first_resolved_at,?),version=version+1,updated_at=? WHERE id=?",(value,clock,clock,clock,t['id']))
        return pos+1,'done',clock
    return pos+1,'queued',clock


def process_flow():
    clock=int(time.time())
    with transaction() as db:
        run=one(db,"""SELECT r.* FROM workspace_flow_runs r WHERE r.due_at<=? AND
                (r.state IN ('queued','dispatch') OR (r.state='pending' AND NOT EXISTS
                (SELECT 1 FROM workspace_flow_runs active WHERE active.ticket_id=r.ticket_id AND active.state IN ('queued','answer','dispatch'))))
                ORDER BY r.due_at,r.created_at,r.id LIMIT 1"""+
                (' FOR UPDATE SKIP LOCKED' if postgres() else ''),(clock,))
        if not run:return False
        t=one(db,'SELECT * FROM service_tickets WHERE id=?'+(' FOR UPDATE SKIP LOCKED' if postgres() else ''),(run['ticket_id'],))
        if not t:return False
        if run['state']=='pending' and one(db,"SELECT id FROM workspace_flow_runs WHERE ticket_id=? AND state IN ('queued','answer','dispatch') LIMIT 1",(t['id'],)):
            return False
        flow=one(db,'SELECT f.*,t.status tenant_status FROM workspace_flows f JOIN tenants t ON t.id=f.tenant_id WHERE f.id=?',(run['flow_id'],))
        steps=json.loads(run['steps']);pos=run['position'];due=clock;detail=''
        if flow['tenant_status']=='suspended' or not flow['active_trigger'] or flow['published_revision']!=run['revision']:
            state='stopped'
        elif run['state']=='dispatch':
            out=one(db,'SELECT state,error FROM service_outbox WHERE tenant_id=? AND request_key=?',(t['tenant_id'],run['id']+'-'+str(pos-1)))
            if out and out['state'] in ('queued','retry','sending'):
                state='dispatch';due=clock+15
            elif out and out['state']=='accepted':
                state='answer' if steps[pos-1]['action']=='question' else 'queued'
            else:
                state='blocked';detail=(out or {}).get('error') or 'delivery_unconfirmed'
        elif pos>=len(steps):state='done'
        else:
            try:
                pos,state,due=perform(db,run,t,steps[pos],clock)
            except HTTPException as exc:
                state='blocked';detail=str(exc.detail)[:150]
        db.execute('UPDATE workspace_flow_runs SET position=?,state=?,due_at=?,detail=? WHERE id=?',(pos,state,due,detail,run['id']))
        return True
