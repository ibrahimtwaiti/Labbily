"""Small, forward-only workspace workflows. One durable step per worker claim."""
import json
from typing import Literal
from fastapi import Depends, HTTPException, Request
from pydantic import Field, model_validator
from .agent_api import Input, Tiny, manager
from .flow_runtime import advance, trigger
from .customer_workspace import validate_stage
from .db import audit, rows, transaction, uid
from .main import operation, user
from .service_api import get, router

Trigger = Literal['manual','opened','closed','field_changed','stage_changed']
Action = Literal['message','question','assign','condition','tag','stage','wait','close']
MATCH = {'channel','team','priority','status','language','office_hours'}


class Step(Input):
    action: Action
    value: str = Field(min_length=1, max_length=900)
    field: str = ''
    otherwise: int = Field(default=0, ge=0, le=13)


class Flow(Input):
    name: Tiny
    trigger: Trigger
    steps: list[Step] = Field(min_length=1, max_length=12)
    revision: int = Field(default=0, ge=0)

    @model_validator(mode='after')
    def valid_steps(self):
        for index, step in enumerate(self.steps):
            action, value = step.action, step.value.strip()
            if not value or (action == 'wait' and not (value.isascii() and value.isdecimal() and len(value)<=5 and 1<=int(value)<=10080)):
                raise ValueError('invalid_step_value')
            if action == 'condition' and (step.field not in MATCH or not index+1 < step.otherwise <= len(self.steps)+1):
                raise ValueError('branch_must_point_forward')
            if action in ('assign','tag','stage','close') and len(value)>80:
                raise ValueError('step_value_too_long')
        return self


class Revision(Input):
    revision: int = Field(ge=1)


class Simulation(Revision):
    channel: Literal['whatsapp','messenger','instagram']='whatsapp'
    team: str='support'
    priority: str='normal'
    status: str='new'
    language: str='ar'
    office_hours: Literal['yes','no']='yes'


@router.get('/api/v2/workflows')
def list_flows(u=Depends(user)):
    manager(u)
    with transaction() as db:
        return rows(db,'SELECT id,name,trigger_type,revision,tested_revision,published_revision,active_trigger FROM workspace_flows WHERE tenant_id=? ORDER BY name,id',(u['tenant_id'],))


@router.get('/api/v2/workflows/{ident}')
def detail(ident:str,u=Depends(user)):
    manager(u)
    with transaction() as db:
        flow=get(db,'workspace_flows',ident,u)
        flow['draft']=json.loads(flow['draft'])
        flow.pop('published')
        flow['runs']=rows(db,'SELECT id,position,state,detail,created_at,revision FROM workspace_flow_runs WHERE flow_id=? ORDER BY created_at DESC,id DESC LIMIT 30',(ident,))
        return flow


def save_flow(db, ident, data, u):
    for step in data.steps:
        if step.action=='stage':
            validate_stage(db,u['tenant_id'],step.value)
    steps=json.dumps([s.model_dump() for s in data.steps],ensure_ascii=False)
    if ident:
        flow=get(db,'workspace_flows',ident,u,True)
        if flow['revision']!=data.revision:raise HTTPException(409,'workflow_changed')
        db.execute('UPDATE workspace_flows SET name=?,trigger_type=?,draft=?,revision=revision+1,tested_revision=0 WHERE id=?',(data.name,data.trigger,steps,ident))
    else:
        ident=uid()
        db.execute('INSERT INTO workspace_flows(id,tenant_id,name,trigger_type,draft) VALUES(?,?,?,?,?)',(ident,u['tenant_id'],data.name,data.trigger,steps))
    audit(db,u,'workflow.saved',ident)
    return {'id':ident}


@router.post('/api/v2/workflows',status_code=201)
def create(data:Flow,u=Depends(user)):
    manager(u)
    with transaction() as db:return save_flow(db,None,data,u)


@router.put('/api/v2/workflows/{ident}')
def edit(ident:str,data:Flow,u=Depends(user)):
    manager(u)
    with transaction() as db:return save_flow(db,ident,data,u)


@router.post('/api/v2/workflows/{ident}/simulate')
def simulate(ident:str,data:Simulation,u=Depends(user)):
    manager(u)
    with transaction() as db:
        flow=get(db,'workspace_flows',ident,u,True)
        if flow['revision']!=data.revision:raise HTTPException(409,'workflow_changed')
        steps=json.loads(flow['draft']); pos=0; trace=[];context=data.model_dump()
        while pos<len(steps):
            step=steps[pos];trace.append({'step':pos+1,'action':step['action']})
            pos=advance(step,pos,context)
            if step['action'] in ('close','assign'):break
        db.execute('UPDATE workspace_flows SET tested_revision=revision WHERE id=?',(ident,))
        return {'trace':trace}


@router.post('/api/v2/workflows/{ident}/{action}')
def release(ident:str,action:Literal['publish','pause'],data:Revision,u=Depends(user)):
    manager(u)
    with transaction() as db:
        flow=get(db,'workspace_flows',ident,u,True)
        if flow['revision']!=data.revision:raise HTTPException(409,'workflow_changed')
        if action=='publish':
            if flow['tested_revision']!=data.revision:raise HTTPException(409,'simulate_draft_first')
            db.execute('UPDATE workspace_flows SET active_trigger=trigger_type,published=draft,published_revision=revision WHERE id=?',(ident,))
        else:
            db.execute('UPDATE workspace_flows SET active_trigger=NULL WHERE id=?',(ident,))
        db.execute("UPDATE workspace_flow_runs SET state='stopped' WHERE flow_id=? AND state IN ('pending','queued','answer','dispatch') AND (?='pause' OR revision<>?)",(ident,action,data.revision))
        audit(db,u,'workflow.'+action,ident)
        return {'active':action=='publish'}


@router.post('/api/v2/workflows/{ident}/tickets/{ticket_id}')
def manual(ident:str,ticket_id:str,request:Request,u=Depends(user)):
    manager(u);key=operation(request)
    with transaction() as db:
        get(db,'workspace_flows',ident,u);get(db,'service_tickets',ticket_id,u,True)
        run=trigger(db,u['tenant_id'],ticket_id,'manual',key,ident)
        if not run:raise HTTPException(409,'publish_manual_flow_first')
        return {'id':run}
