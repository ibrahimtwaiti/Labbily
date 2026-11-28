"""Organization settings and WhatsApp management for authenticated tenants."""
import json
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo
from typing import Literal
from urllib.parse import urlencode

from fastapi import Depends, HTTPException
from pydantic import Field
from .agent_api import Input, Tiny
from .db import audit, now, one, rows, transaction, uid
from .main import user
from .security import permit
from .service_api import get, router


class Team(Input):
    name: str = Field(min_length=1,max_length=80)
    members: list[str] = Field(max_length=200)
    revision: int = Field(default=0,ge=0)


@router.get('/api/v2/workspace/teams')
def teams(u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        result=rows(db,'SELECT * FROM workspace_teams WHERE tenant_id=? ORDER BY name',(u['tenant_id'],))
        members=rows(db,'SELECT m.* FROM workspace_team_members m JOIN workspace_teams t ON t.id=m.team_id WHERE t.tenant_id=?',(u['tenant_id'],))
        for team in result:
            team['members']=[m['user_id'] for m in members if m['team_id']==team['id']]
        return result


def store_team(data,u,ident=None):
    permit(u,'settings')
    name=data.name.strip()
    if not name:raise HTTPException(422,'team_name_required')
    with transaction() as db:
        tid=u['tenant_id']
        if ident:
            team=get(db,'workspace_teams',ident,u,True)
            if team['revision']!=data.revision:raise HTTPException(409,'team_changed_reload')
        same=one(db,'SELECT id FROM workspace_teams WHERE tenant_id=? AND name=?',(tid,name))
        if same and same['id']!=ident:raise HTTPException(409,'team_name_exists')
        if ident:
            db.execute('UPDATE workspace_teams SET name=?,revision=revision+1 WHERE id=?',(name,ident))
            db.execute('DELETE FROM workspace_team_members WHERE team_id=?',(ident,))
        else:
            ident=uid()
            if not db.execute('INSERT INTO workspace_teams(id,tenant_id,name) VALUES(?,?,?) ON CONFLICT(tenant_id,name) DO NOTHING',(ident,tid,name)).rowcount:
                raise HTTPException(409,'team_name_exists')
        for member in set(data.members):
            if not one(db,'SELECT id FROM users WHERE tenant_id=? AND id=? AND active=1',(tid,member)):
                raise HTTPException(422,'inactive_or_unknown_member')
            db.execute('INSERT INTO workspace_team_members VALUES(?,?)',(ident,member))
        audit(db,u,'workspace.team.saved',ident)
    return {'id':ident}


@router.post('/api/v2/workspace/teams')
def add_team(data:Team,u=Depends(user)):
    return store_team(data,u)


@router.put('/api/v2/workspace/teams/{ident}')
def edit_team(ident:str,data:Team,u=Depends(user)):
    return store_team(data,u,ident)


@router.get('/api/v2/workspace/team-options')
def team_options(u=Depends(user)):
    permit(u,'inbox')
    with transaction() as db:
        return rows(db,'SELECT id,name FROM workspace_teams WHERE tenant_id=? ORDER BY name',(u['tenant_id'],))


class Organization(Input):
    name:Tiny


@router.get('/api/v2/workspace/organization')
def organization(u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        return one(db,'SELECT name,timezone FROM tenants WHERE id=?',(u['tenant_id'],))


@router.put('/api/v2/workspace/organization')
def rename_organization(data:Organization,u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        db.execute('UPDATE tenants SET name=? WHERE id=?',(data.name,u['tenant_id']))
        audit(db,u,'workspace.organization.updated',u['tenant_id'])
    return {'name':data.name}


class CustomField(Input):
    name: Tiny
    kind: Literal['text','number','date']


@router.get('/api/v2/workspace/fields')
def list_fields(u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        return rows(db,'SELECT id,name,kind FROM workspace_fields WHERE tenant_id=? ORDER BY name',(u['tenant_id'],))


@router.post('/api/v2/workspace/fields')
def create_field(data:CustomField,u=Depends(user)):
    permit(u,'settings')
    ident=uid()
    with transaction() as db:
        if not data.name.strip():raise HTTPException(422,'field_name_required')
        if not db.execute('INSERT INTO workspace_fields VALUES(?,?,?,?) ON CONFLICT(tenant_id,name) DO NOTHING',(ident,u['tenant_id'],data.name.strip(),data.kind)).rowcount:
            raise HTTPException(409,'field_name_exists')
        audit(db,u,'workspace.field.created',ident)
    return {'id':ident}


@router.get('/api/v2/crm/contacts/{ident}/fields')
def customer_fields(ident:str,u=Depends(user)):
    permit(u,'contacts')
    with transaction() as db:
        get(db,'contacts',ident,u)
        return rows(db,'SELECT f.id,f.name,f.kind,v.value FROM workspace_fields f LEFT JOIN contact_field_values v ON v.field_id=f.id AND v.contact_id=? WHERE f.tenant_id=? ORDER BY f.name',(ident,u['tenant_id']))


def store_values(db,tid,ident,values):
    from decimal import Decimal, InvalidOperation
    changed=False
    for key,value in values.items():
        field=one(db,'SELECT kind FROM workspace_fields WHERE tenant_id=? AND id=?',(tid,key))
        if not field or len(value)>400:raise HTTPException(422,'invalid_custom_field')
        value=value.strip()
        try:
            if value and field['kind']=='number' and not Decimal(value).is_finite():raise ValueError()
            if value and field['kind']=='date':date.fromisoformat(value)
        except (ValueError,InvalidOperation):
            raise HTTPException(422,'invalid_custom_value')
        old=one(db,'SELECT value FROM contact_field_values WHERE field_id=? AND contact_id=?',(key,ident))
        if value==(old['value'] if old else ''):continue
        db.execute('INSERT INTO contact_field_values VALUES(?,?,?) ON CONFLICT(contact_id,field_id) DO UPDATE SET value=excluded.value',(ident,key,value))
        changed=True
    return changed


class Preferences(Input):
    mentions: bool
    quiet_start:int | None=Field(default=None,ge=0,le=23)
    quiet_end:int | None=Field(default=None,ge=0,le=23)


def allow_mention(db,ident):
    pref=one(db,'SELECT * FROM inbox_preferences WHERE user_id=?',(ident,))
    if not pref:return True
    if not pref['mentions']:return False
    start,end=pref['quiet_start'],pref['quiet_end']
    if start is None or end is None:return True
    hour=datetime.now(ZoneInfo('Asia/Riyadh')).hour
    quiet=(start<=hour<end) if start<end else (hour>=start or hour<end)
    return not quiet


@router.get('/api/v2/workspace/notifications')
def preferences(u=Depends(user)):
    with transaction() as db:
        p=one(db,'SELECT mentions,quiet_start,quiet_end FROM inbox_preferences WHERE user_id=?',(u['id'],))
        return {**p,'mentions':bool(p['mentions'])} if p else {'mentions':True,'quiet_start':None,'quiet_end':None}


@router.put('/api/v2/workspace/notifications')
def save_preferences(data:Preferences,u=Depends(user)):
    if (data.quiet_start is None)!=(data.quiet_end is None) or data.quiet_start is not None and data.quiet_start==data.quiet_end:
        raise HTTPException(422,'invalid_quiet_hours')
    with transaction() as db:
        db.execute('INSERT INTO inbox_preferences VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET mentions=excluded.mentions,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end',(u['id'],int(data.mentions),data.quiet_start,data.quiet_end))
    return data


class Reply(Input):
    title: Tiny
    body: str = Field(min_length=1,max_length=4000)


@router.put('/api/v2/replies/{ident}')
def edit_reply(ident:str,data:Reply,u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        get(db,'service_replies',ident,u,True)
        db.execute('UPDATE service_replies SET title=?,body=? WHERE id=?',(data.title,data.body,ident))
        audit(db,u,'service.reply.updated',ident)
    return {'id':ident}


class TemplateDraft(Input):
    name: str=Field(pattern=r'^[a-z][a-z0-9_]{0,79}$')
    language: Literal['ar','en']
    category: Literal['UTILITY','MARKETING']
    body: str=Field(min_length=1,max_length=1024)


@router.get('/api/v2/workspace/template-drafts')
def drafts(u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        return rows(db,'SELECT * FROM wa_template_drafts WHERE tenant_id=? ORDER BY created_at DESC',(u['tenant_id'],))


@router.post('/api/v2/workspace/template-drafts')
def create_draft(data:TemplateDraft,u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        ident=uid()
        count=db.execute('INSERT INTO wa_template_drafts VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant_id,name,language) DO NOTHING',(ident,u['tenant_id'],data.name,data.language,data.category,data.body,now())).rowcount
        if not count:raise HTTPException(409,'template_name_exists')
        audit(db,u,'whatsapp.template.drafted',ident)
    return {'id':ident}


@router.put('/api/v2/workspace/template-drafts/{ident}')
def update_draft(ident:str,data:TemplateDraft,u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        old=get(db,'wa_template_drafts',ident,u,True)
        if (old['name'],old['language'])!=(data.name,data.language):raise HTTPException(422,'template_identity_fixed')
        db.execute('UPDATE wa_template_drafts SET category=?,body=? WHERE id=?',(data.category,data.body,ident))
        audit(db,u,'whatsapp.template.edited',ident)
    return {'id':ident}


@router.get('/api/v2/workspace/accounts/{ident}/costs')
def provider_costs(ident:str,days:int=30,u=Depends(user)):
    from .service import provider_request
    permit(u,'settings')
    with transaction() as db:
        account=get(db,'service_accounts',ident,u)
        connection=one(db,'SELECT business_account_id FROM meta_connections WHERE account_id=? AND tenant_id=?',(ident,u['tenant_id']))
    if not connection or account['state']=='disconnected':raise HTTPException(409,'meta_connection_required')
    if days not in (7,30):raise HTTPException(422,'invalid_period')
    end=int(time.time())
    business={**account,'provider_id':connection['business_account_id']}
    params={'start':end-days*86400,'end':end,'granularity':'DAILY','metric_types':'["COST","VOLUME"]','limit':100}
    try:
        result=provider_request(business,'GET','/pricing_analytics?'+urlencode(params))
        if result.status_code!=200:raise ValueError()
        report=result.json()
        if not isinstance(report.get('data'),list) or report.get('paging',{}).get('next'):raise ValueError()
        points=[{k:p.get(k) for k in ('start','end','volume','cost')} for group in report['data'] for p in group.get('data_points',[])]
        meta=provider_request(business,'GET','?fields=currency')
        currency=meta.json().get('currency') if meta.status_code==200 else None
    except HTTPException:raise
    except Exception:raise HTTPException(502,'meta_pricing_unavailable')
    return {'business_account_id':business['provider_id'],'currency':currency,'points':points,'start':params['start'],'end':end}


class WorkingHours(Input):
    start_hour:int=Field(ge=0,le=23)
    end_hour:int=Field(ge=1,le=24)
    workdays:list[int]=Field(min_length=1,max_length=7)


@router.put('/api/v2/workspace/hours')
def save_hours(data:WorkingHours,u=Depends(user)):
    from .service import settings
    permit(u,'settings')
    if data.end_hour<=data.start_hour or any(day not in range(7) for day in data.workdays):
        raise HTTPException(422,'invalid_working_hours')
    with transaction() as db:
        current=settings(db,u['tenant_id'])
        current.update(start_hour=data.start_hour,end_hour=data.end_hour,workdays=sorted(set(data.workdays)))
        db.execute('INSERT INTO service_settings VALUES(?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET settings=excluded.settings,updated_at=excluded.updated_at',(u['tenant_id'],json.dumps(current),now()))
        audit(db,u,'workspace.hours.updated',u['tenant_id'])
    return current

class SubmitTemplate(Input):
    account_id:Tiny
    examples:list[str]=Field(default_factory=list,max_length=32)


@router.post('/api/v2/workspace/template-drafts/{ident}/submit')
def submit_template(ident:str,data:SubmitTemplate,u=Depends(user)):
    from .meta_onboarding import connection,graph
    from .service_templates import text_parameters
    permit(u,'settings')
    with transaction() as db:
        draft=get(db,'wa_template_drafts',ident,u)
    a,m,token=connection(data.account_id,u)
    parameters=text_parameters(draft['body'],data.examples)
    body={'type':'BODY','text':draft['body']}
    if parameters:body['example']={'body_text':[[p['text'] for p in parameters]]}
    result=graph(u['tenant_id'],a['api_version'],'template_submit',m['business_account_id']+'/message_templates',token=token,method='POST',
                 payload={'name':draft['name'],'language':draft['language'],'category':draft['category'],'components':[body]})
    if not result.get('id'):raise HTTPException(502,'provider_template_status_unknown_sync')
    with transaction() as db:audit(db,u,'whatsapp.template.submitted',ident)
    return {'id':str(result['id']),'status':result.get('status') or 'PENDING'}
