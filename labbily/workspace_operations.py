"""Tenant workspace setup, CRM-stage reporting and campaign planning."""
import base64
import binascii
import io
from typing import Literal
from fastapi.responses import Response
from PIL import Image
from fastapi import Depends, HTTPException
from pydantic import Field
from .agent_api import Input
from .db import audit, now, one, rows, transaction, uid
from .main import user, valid_date
from .security import permit
from .service_api import get, router


@router.get('/api/v2/workspace-setup')
def setup(u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        record=one(db,"""SELECT
          EXISTS(SELECT 1 FROM service_accounts WHERE tenant_id=? AND state='verified') AS channel,
          EXISTS(SELECT 1 FROM users WHERE tenant_id=? AND active=1 AND id<>?) AS team,
          EXISTS(SELECT 1 FROM contact_stages WHERE tenant_id=?) AS stages,
          EXISTS(SELECT 1 FROM service_tickets WHERE tenant_id=?) AS conversation,
          EXISTS(SELECT 1 FROM ai_agents WHERE tenant_id=? AND published>0) AS agent""",
          (u['tenant_id'],u['tenant_id'],u['id'],u['tenant_id'],u['tenant_id'],u['tenant_id']))
        return {key:bool(value) for key,value in record.items()}


@router.get('/api/v2/lifecycle-report')
def lifecycle(u=Depends(user)):
    permit(u,'reports')
    with transaction() as db:
        tid=u['tenant_id']
        return {'distribution':rows(db,"""SELECT COALESCE(p.stage,'new') stage,COUNT(*) total FROM contacts c
                    LEFT JOIN contact_profiles p ON p.contact_id=c.id WHERE c.tenant_id=?
                    GROUP BY COALESCE(p.stage,'new')""",(tid,)),
                'stages':rows(db,'SELECT id,name FROM contact_stages WHERE tenant_id=? ORDER BY name,id',(tid,)),
                'changes':[] if u['role']=='reader' else rows(db,"""SELECT h.stage,h.changed_at,c.name FROM contact_stage_history h
                    JOIN contacts c ON c.id=h.contact_id WHERE c.tenant_id=? ORDER BY h.changed_at DESC,h.id DESC LIMIT 30""",(tid,))}


class Campaign(Input):
    name: str = Field(min_length=1,max_length=120)
    channel: Literal['whatsapp','messenger','instagram']
    segment_id: str = Field(default='',max_length=120)
    body: str = Field(default='',max_length=3500)
    image: str | None = Field(default=None,max_length=1400000)
    planned_at: str = Field(default='',max_length=40)
    state: Literal['draft','planned','paused']='draft'
    revision: int = Field(default=0,ge=0)


@router.get('/api/v2/campaigns')
def campaigns(u=Depends(user)):
    permit(u,'settings')
    tid=u['tenant_id']
    with transaction() as db:
        return {'items':rows(db,"""SELECT c.*,s.name segment,EXISTS(SELECT 1 FROM campaign_images i WHERE i.campaign_id=c.id) AS has_image FROM workspace_campaigns c
                  LEFT JOIN contact_segments s ON s.id=c.segment_id WHERE c.tenant_id=? ORDER BY c.created_at DESC,c.id""",(tid,)),
                'segments':rows(db,'SELECT id,name FROM contact_segments WHERE tenant_id=? ORDER BY name,id',(tid,)),
                'metrics':rows(db,"""SELECT t.campaign,m.status,COUNT(*) total FROM service_messages m
                    JOIN service_tickets t ON t.id=m.ticket_id AND t.tenant_id=m.tenant_id
                    JOIN workspace_campaigns c ON c.name=t.campaign AND c.tenant_id=t.tenant_id
                    JOIN service_accounts a ON a.id=m.account_id AND a.tenant_id=m.tenant_id AND a.channel=c.channel
                    WHERE m.tenant_id=? AND m.direction='out' GROUP BY t.campaign,m.status""",(tid,))}


def save_campaign(data,u,ident=None):
    permit(u,'settings')
    name,body=data.name.strip(),data.body.strip()
    if not name:raise HTTPException(422,'campaign_name_required')
    image=normalize_image(data.image) if data.image else data.image
    due=valid_date(data.planned_at) if data.planned_at else None
    if data.state=='planned' and due is None:raise HTTPException(422,'planning_date_required')
    with transaction() as db:
        tid=u['tenant_id']
        if ident:
            old=get(db,'workspace_campaigns',ident,u,True)
            if old['revision']!=data.revision:raise HTTPException(409,'campaign_changed_reload')
            if old['name']!=name or old['channel']!=data.channel:raise HTTPException(422,'campaign_attribution_is_fixed')
        retained=ident and image is None and one(db,'SELECT 1 AS present FROM campaign_images WHERE campaign_id=?',(ident,))
        if not (body or image or retained):raise HTTPException(422,'message_or_image_required')
        if data.segment_id:get(db,'contact_segments',data.segment_id,u)
        if ident:
            db.execute('UPDATE workspace_campaigns SET segment_id=?,body=?,planned_at=?,state=?,revision=revision+1 WHERE id=? AND tenant_id=?',
                       (data.segment_id or None,body,due,data.state,ident,tid))
        else:
            ident=uid()
            inserted=db.execute("""INSERT INTO workspace_campaigns(id,tenant_id,name,channel,segment_id,body,planned_at,state,created_at)
                             VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,name) DO NOTHING""",
                           (ident,tid,name,data.channel,data.segment_id or None,body,due,data.state,now())).rowcount
            if not inserted:raise HTTPException(409,'campaign_name_already_exists')
        if image is not None:
            if image:
                db.execute('INSERT INTO campaign_images VALUES(?,?) ON CONFLICT(campaign_id) DO UPDATE SET content=excluded.content',(ident,image))
            else:
                db.execute('DELETE FROM campaign_images WHERE campaign_id=?',(ident,))
        audit(db,u,'campaign.plan.saved',ident)
    return {'id':ident}


@router.post('/api/v2/campaigns',status_code=201)
def create_campaign(data:Campaign,u=Depends(user)):
    return save_campaign(data,u)


@router.put('/api/v2/campaigns/{ident}')
def edit_campaign(ident:str,data:Campaign,u=Depends(user)):
    return save_campaign(data,u,ident)


def normalize_image(encoded):
    try:
        raw = base64.b64decode(encoded, validate=True)
        with Image.open(io.BytesIO(raw), formats=['JPEG','PNG','WEBP']) as source:
            if max(source.size)>3200 or source.width*source.height>5000000:
                raise ValueError()
            source.thumbnail((1600,1600))
            output=io.BytesIO()
            source.convert('RGB').save(output,format='JPEG',quality=82)
        return base64.b64encode(output.getvalue()).decode()
    except (ValueError,OSError,binascii.Error,Image.DecompressionBombError):
        raise HTTPException(422,'invalid_campaign_image')


@router.get('/api/v2/campaigns/{ident}/image')
def campaign_image(ident:str,u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        row=one(db,"SELECT i.content FROM campaign_images i JOIN workspace_campaigns c ON c.id=i.campaign_id WHERE c.id=? AND c.tenant_id=?",(ident,u['tenant_id']))
    if not row:raise HTTPException(404,'image_not_found')
    return Response(base64.b64decode(row['content']),media_type='image/jpeg',headers={'Cache-Control':'private, no-store'})
