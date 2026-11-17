"""Sandbox commercial model. No payment gateway, tax invoice or Meta reselling."""
import json
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from .db import transaction, one, rows, uid, now, audit, postgres
from .main import user, provider, email
from .security import permit, limit, digest, hash_password
from .runtime_configuration import value
from .service_api import router

class Plan(BaseModel):
    model_config=ConfigDict(extra='forbid',strict=True)
    name:str=Field(min_length=2,max_length=100)
    currency:str=Field(pattern=r'^[A-Z]{3}$')
    monthly_amount_minor:int=Field(ge=0,le=100000000)
    message_limit:int=Field(ge=0,le=10000000)

class Subscription(BaseModel):
    model_config=ConfigDict(extra='forbid')
    plan_id:str=Field(min_length=1,max_length=80)
    status:str=Field(pattern=r'^(trial|paused)$')

class Registration(BaseModel):
    model_config=ConfigDict(extra='forbid')
    company:str=Field(min_length=2,max_length=120)
    name:str=Field(min_length=2,max_length=120)
    email:str=Field(max_length=254)
    password:SecretStr
    terms_version:str=Field(pattern=r'^sandbox-v1$')

def period():return datetime.now(timezone.utc).strftime('%Y-%m')

def lock_tenant(db,tid):
    t=one(db,'SELECT id FROM tenants WHERE id=?'+(' FOR UPDATE' if postgres() else ''),(tid,))
    if not t:raise HTTPException(404,'workspace_not_found')

def consume_message(db,tid):
    # Same transaction as outbox insertion. Retries/idempotent requests are not billed twice.
    lock_tenant(db,tid)
    subscription=one(db,'SELECT * FROM service_subscriptions WHERE tenant_id=?',(tid,))
    if not subscription:return # Existing contracts are unchanged until explicitly assigned.
    if subscription['status']!='trial':raise HTTPException(409,'subscription_paused')
    ceiling=json.loads(subscription['snapshot'])['message_limit'];month=period()
    db.execute("INSERT INTO service_usage_counters VALUES(?,?,'outbound_messages',0) ON CONFLICT(tenant_id,period,metric) DO NOTHING",(tid,month))
    if db.execute("UPDATE service_usage_counters SET used=used+1 WHERE tenant_id=? AND period=? AND metric='outbound_messages' AND used<?",(tid,month,ceiling)).rowcount!=1:
        raise HTTPException(429,'monthly_message_quota_exceeded')

@router.get('/api/admin/commerce')
def administration(u=Depends(user)):
    provider(u)
    with transaction() as db:return {'mode':'sandbox','plans':rows(db,'SELECT * FROM service_plans ORDER BY created_at'),
        'subscriptions':rows(db,'SELECT s.*,t.name FROM service_subscriptions s JOIN tenants t ON t.id=s.tenant_id'),
        'registrations':rows(db,'SELECT r.*,t.name,u.email FROM service_registrations r JOIN tenants t ON t.id=r.tenant_id JOIN users u ON u.id=r.user_id')}

@router.post('/api/admin/commerce/plans',status_code=201)
def create_plan(data:Plan,u=Depends(user)):
    provider(u);ident=uid()
    with transaction() as db:
        db.execute('INSERT INTO service_plans VALUES(?,?,?,?,?,1,?)',(ident,data.name,data.currency,data.monthly_amount_minor,data.message_limit,now()))
        audit(db,u,'commerce.plan.created',ident,'sandbox')
    return {'id':ident,'mode':'sandbox'}

@router.put('/api/admin/commerce/subscriptions/{tenant_id}')
def assign(tenant_id:str,data:Subscription,u=Depends(user)):
    provider(u)
    with transaction() as db:
        lock_tenant(db,tenant_id)
        plan=one(db,'SELECT * FROM service_plans WHERE id=? AND active=1',(data.plan_id,))
        if not plan:raise HTTPException(404,'plan_not_found')
        db.execute('INSERT INTO service_subscriptions VALUES(?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET plan_id=excluded.plan_id,snapshot=excluded.snapshot,status=excluded.status,updated_at=excluded.updated_at',(tenant_id,data.plan_id,json.dumps(plan),data.status,now()))
        audit(db,u,'commerce.subscription.assigned',tenant_id,data.status)
    return {'mode':'sandbox','status':data.status}

@router.get('/api/v2/billing')
def billing(u=Depends(user)):
    permit(u,'settings')
    with transaction() as db:
        sub=one(db,'SELECT * FROM service_subscriptions WHERE tenant_id=?',(u['tenant_id'],))
        if sub:sub['snapshot']=json.loads(sub['snapshot'])
        invoices=rows(db,'SELECT * FROM service_sandbox_invoices WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100',(u['tenant_id'],))
        for invoice in invoices:invoice['snapshot']=json.loads(invoice['snapshot'])
        return {'mode':'sandbox','payment_collection_enabled':False,'meta_charges_included':False,'subscription':sub,'period':period(),
            'usage':rows(db,'SELECT metric,used FROM service_usage_counters WHERE tenant_id=? AND period=?',(u['tenant_id'],period())),'invoices':invoices}

@router.post('/api/v2/billing/invoice')
def invoice(u=Depends(user)):
    permit(u,'settings');tid=u['tenant_id'];month=period()
    with transaction() as db:
        lock_tenant(db,tid)
        existing=one(db,'SELECT id FROM service_sandbox_invoices WHERE tenant_id=? AND period=?',(tid,month))
        if existing:return {**existing,'mode':'sandbox'}
        sub=one(db,'SELECT * FROM service_subscriptions WHERE tenant_id=?',(tid,))
        if not sub:raise HTTPException(409,'subscription_required')
        ident=uid();snapshot={'plan':json.loads(sub['snapshot']),'status':'draft','tax_document':False,'meta_charges_included':False}
        db.execute('INSERT INTO service_sandbox_invoices VALUES(?,?,?,?,?)',(ident,tid,month,json.dumps(snapshot),now()))
        audit(db,u,'commerce.invoice.drafted',ident,'sandbox_not_payable')
    return {'id':ident,'mode':'sandbox'}

@router.post('/api/auth/register',status_code=202)
def register(data:Registration,request:Request):
    if value('WASLA_SELF_SIGNUP_MODE','disabled')!='test':raise HTTPException(409,'self_signup_not_enabled')
    with transaction() as db:limit(db,'signup:'+digest(request.client.host),5,3600)
    address=email(data.email);hashed=hash_password(data.password.get_secret_value());tid=uid();ident=uid()
    with transaction() as db:
        # Uniform result for existing addresses, no password reset or account takeover.
        if not one(db,'SELECT id FROM users WHERE email=?',(address,)):
            db.execute("INSERT INTO tenants(id,name,status,created_at) VALUES(?,?,'setup',?)",(tid,data.company,now()))
            inserted=db.execute("INSERT INTO users VALUES(?,?,?,?,?,'admin',0,?) ON CONFLICT(email) DO NOTHING",(ident,tid,address,data.name,hashed,now())).rowcount
            if not inserted:
                db.execute("DELETE FROM tenants WHERE id=?",(tid,))
                return {"status":"pending_provider_review","mode":"sandbox"}
            db.execute("INSERT INTO service_registrations VALUES(?,?,'pending','sandbox-v1','',?)",(tid,ident,now()))
    return {'status':'pending_provider_review','mode':'sandbox'}

@router.post('/api/admin/commerce/registrations/{tenant_id}/approve')
def approve(tenant_id:str,data:dict,u=Depends(user)):
    provider(u)
    evidence=data.get('evidence','')
    if not isinstance(evidence,str) or not 10<=len(evidence)<=500:raise HTTPException(422,'verification_evidence_required')
    with transaction() as db:
        lock_tenant(db,tenant_id)
        reg=one(db,'SELECT * FROM service_registrations WHERE tenant_id=?',(tenant_id,))
        if not reg:raise HTTPException(404,'registration_not_found')
        if not one(db,'SELECT tenant_id FROM service_subscriptions WHERE tenant_id=?',(tenant_id,)):raise HTTPException(409,'assign_sandbox_plan_first')
        db.execute("UPDATE service_registrations SET status='approved',review_evidence=? WHERE tenant_id=?",(evidence,tenant_id))
        db.execute('UPDATE users SET active=1 WHERE id=?',(reg['user_id'],))
        audit(db,u,'commerce.registration.approved',tenant_id,'sandbox')
    return {'status':'approved','mode':'sandbox','production_enabled':False}
