import json
import time
from typing import Literal
from fastapi import Depends, HTTPException
from pydantic import Field
from .agent_api import Input, Tiny, manager
from .db import audit, one, rows, transaction, uid
from .main import user
from .security import permit
from .service_api import get, router

class Criteria(Input):
    query:str=Field(default='',max_length=100)
    status:str=Field(default='',max_length=30)
    scope:Literal['all','unread','unassigned','human','snoozed']='all'

class View(Input):
    name:Tiny
    criteria:Criteria

class Pick(Input):
    id:Tiny
    version:int=Field(ge=1)

class Change(Input):
    tickets:list[Pick]=Field(min_length=1,max_length=50)
    action:Literal['take','resume','snooze','wake','close']
    until:int=0
    resolution:str=Field(default='',max_length=120)

@router.get('/api/v2/inbox-views')
def views(u=Depends(user)):
    permit(u,'inbox')
    with transaction() as db:
        result=rows(db,'SELECT id,name,criteria FROM inbox_views WHERE user_id=? AND tenant_id=? ORDER BY name,id',(u['id'],u['tenant_id']))
        for item in result:item['criteria']=json.loads(item['criteria'])
        return result

@router.post('/api/v2/inbox-views',status_code=201)
def save(data:View,u=Depends(user)):
    permit(u,'inbox')
    with transaction() as db:
        if db.execute('SELECT COUNT(*) FROM inbox_views WHERE user_id=?',(u['id'],)).fetchone()[0]>=25:raise HTTPException(409,'inbox_view_limit')
        ident=uid()
        db.execute('INSERT INTO inbox_views VALUES(?,?,?,?,?)',(ident,u['tenant_id'],u['id'],data.name,data.criteria.model_dump_json()))
        return {'id':ident}

@router.delete('/api/v2/inbox-views/{ident}')
def remove(ident:str,u=Depends(user)):
    permit(u,'inbox')
    with transaction() as db:
        db.execute('DELETE FROM inbox_views WHERE id=? AND tenant_id=? AND user_id=?',(ident,u['tenant_id'],u['id']))
    return {'ok':True}

@router.post('/api/v2/tickets/{ident}/seen')
def seen(ident:str,data:dict,u=Depends(user)):
    permit(u,'inbox')
    with transaction() as db:
        ticket=get(db,'service_tickets',ident,u,True)
        if ticket['version']!=data.get('version'):return {'recorded':False}
        count=db.execute("SELECT count(*) FROM service_messages WHERE ticket_id=? AND direction='in'",(ident,)).fetchone()[0]
        db.execute('INSERT INTO inbox_seen VALUES(?,?,?,?) ON CONFLICT(ticket_id,user_id) DO UPDATE SET seen_count=excluded.seen_count',
                   (u['tenant_id'],ident,u['id'],count))
        return {'recorded':True}

@router.post('/api/v2/inbox-actions')
def update(data:Change,u=Depends(user)):
    permit(u,'inbox')
    if len(data.tickets)>1 or data.action in ('resume','close'):manager(u)
    if len({t.id for t in data.tickets})!=len(data.tickets):raise HTTPException(422,'duplicate_ticket')
    clock=int(time.time())
    if data.action=='snooze' and not clock<data.until<=clock+366*86400:raise HTTPException(422,'future_snooze_required')
    if data.action=='close' and not data.resolution.strip():raise HTTPException(422,'resolution_code_required')
    with transaction() as db:
        for item in sorted(data.tickets,key=lambda item:item.id):
            t=get(db,'service_tickets',item.id,u,True)
            if t['version']!=item.version:raise HTTPException(409,'ticket_changed_reload_before_action')
            if data.action=='take':
                db.execute("UPDATE service_tickets SET assignee_id=?,automation_paused=1,status='in_progress',resolved_at=NULL,snoozed_until=0 WHERE id=?",(u['id'],item.id))
            elif data.action=='resume':
                if t['status'] in ('closed','resolved'):raise HTTPException(409,'reopen_ticket_before_reply')
                db.execute("UPDATE service_tickets SET assignee_id=NULL,automation_paused=0,snoozed_until=0 WHERE id=?",(item.id,))
            elif data.action=='close':
                db.execute("UPDATE service_tickets SET status='closed',resolution_code=?,resolved_at=?,first_resolved_at=COALESCE(first_resolved_at,?),automation_paused=1 WHERE id=?",(data.resolution,clock,clock,item.id))
            else:
                db.execute('UPDATE service_tickets SET snoozed_until=? WHERE id=?',(data.until if data.action=='snooze' else 0,item.id))
            db.execute('UPDATE service_tickets SET version=version+1,updated_at=? WHERE id=?',(clock,item.id))
            audit(db,u,'inbox.'+data.action,item.id)
    return {'updated':len(data.tickets)}

@router.get('/api/v2/tickets/{ident}/customer-timeline')
def customer_timeline(ident:str,u=Depends(user)):
    permit(u,'inbox')
    with transaction() as db:
        ticket=get(db,'service_tickets',ident,u)
        identity=get(db,'service_identities',ticket['identity_id'],u)
        query='''SELECT m.direction,substr(m.body,1,180) AS excerpt,m.occurred_at,
                        a.channel,t.id AS ticket_id,t.status
                 FROM service_tickets t
                 JOIN service_identities i ON i.id=t.identity_id AND i.tenant_id=t.tenant_id
                 JOIN service_accounts a ON a.id=i.account_id AND a.tenant_id=t.tenant_id
                 JOIN service_messages m ON m.ticket_id=t.id AND m.tenant_id=t.tenant_id
                 WHERE t.tenant_id=? AND (i.id=? OR i.customer_id=?)'''
        args=[u['tenant_id'],identity['id'],identity.get('customer_id') or None]
        if u['role']=='sales':
            query+=' AND t.assignee_id=?'
            args.append(u['id'])
        return rows(db,query+' ORDER BY m.occurred_at DESC,m.created_at DESC,m.id DESC LIMIT 40',args)
