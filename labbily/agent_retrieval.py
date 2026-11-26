"""Opt-in document embeddings, scoped retrieval, background refresh and usage accounting."""
import hashlib
import json
import math
import time
from decimal import Decimal, InvalidOperation
import httpx
from fastapi import Depends, HTTPException
from .agent_api import Input, manager
from .agent_engine import limits, month, reserve
from .agent_knowledge import chunks, clean, fetch_page
from .db import audit, now, one, postgres, rows, transaction, uid
from .main import user
from .runtime_configuration import value
from .service_api import get, router

def meter(db,tid,operation,model,usage,period=None):
    inputs=int(usage.get('input_tokens',usage.get('prompt_tokens',0)));outputs=int(usage.get('output_tokens',0))
    embed=operation in ('embedding','semantic_query')
    price=value('LABBILY_EMBEDDING_INPUT_USD' if embed else 'LABBILY_OPENAI_INPUT_USD')
    out_price='0' if embed else value('LABBILY_OPENAI_OUTPUT_USD')
    estimate=None
    try:
        cost=(Decimal(price)*inputs+Decimal(out_price)*outputs)/1000000
        if cost.is_finite() and cost>=0:estimate=str(cost.quantize(Decimal('.00000001')))
    except (InvalidOperation,ValueError,TypeError):pass
    db.execute('INSERT INTO agent_meter VALUES(?,?,?,?,?,?,?,?)',(uid(),tid,operation,model[:180],inputs,outputs,estimate,now()))
    db.execute('UPDATE agent_usage SET input_tokens=input_tokens+?,output_tokens=output_tokens+? WHERE tenant_id=? AND month=?',(inputs,outputs,tid,period or month()))

def ai_vectors(texts,model):
    key=value('LABBILY_OPENAI_KEY')
    if not key or not model:raise ValueError('model_not_configured')
    response=httpx.post('https://api.openai.com/v1/embeddings',timeout=8,headers={'Authorization':'Bearer '+key},
                        json={'model':model,'input':texts})
    response.raise_for_status();data=response.json()
    result=[r['embedding'] for r in sorted(data['data'],key=lambda row:row['index'])]
    if len(result)!=len(texts) or any(not isinstance(v,list) or not 1<=len(v)<=4096 or any(type(n) not in (int,float) or not math.isfinite(n) for n in v) for v in result):
        raise ValueError('invalid_embeddings')
    return result,data.get('usage',{})

def similarity(a,b):
    if len(a)!=len(b):return 0
    denom=math.sqrt(sum(x*x for x in a)*sum(x*x for x in b))
    return sum(x*y for x,y in zip(a,b))/denom if denom else 0

def semantic(tid,cfg,question):
    model=value('LABBILY_EMBEDDING_MODEL')
    if not model or not cfg.get('documents'):return None
    candidates=[]
    with transaction() as db:
        if not limits(db,tid)['external_enabled']:return None
        for doc in cfg['documents']:
            if not doc.get('id'):continue
            for row in rows(db,'SELECT chunk_index,embedding FROM agent_vectors WHERE tenant_id=? AND document_id=? AND checksum=? AND model=?',(tid,doc['id'],doc['checksum'],model)):
                idx=row['chunk_index']
                if 0<=idx<len(doc['chunks']):candidates.append((json.loads(row['embedding']),doc['title'],doc['chunks'][idx]))
        if not candidates:return None
        if not reserve(db,tid,limits(db,tid)['monthly_runs']):return None
    vectors,usage=ai_vectors([question[:1200]],model)
    with transaction() as db:
        meter(db,tid,'semantic_query',model,usage)
        if not limits(db,tid)['external_enabled']:return None
    score,title,chunk=max((similarity(v,vectors[0]),title,chunk) for v,title,chunk in candidates)
    return {'title':title,'answer':chunk} if score>=0.65 else None

@router.post('/api/v2/agent-knowledge/{ident}/index')
def index_doc(ident:str,u=Depends(user)):
    manager(u)
    with transaction() as db:
        doc=get(db,'agent_documents',ident,u,True)
        if not limits(db,u['tenant_id'])['external_enabled'] or not value('LABBILY_EMBEDDING_MODEL') or not value('LABBILY_OPENAI_KEY'):
            raise HTTPException(409,'approved_embedding_model_required')
        if doc['status']!='approved':raise HTTPException(409,'approved_document_required')
        if doc['index_state']=='processing':raise HTTPException(409,'index_in_progress')
        db.execute("UPDATE agent_documents SET index_state='queued',index_after=0 WHERE id=?",(ident,))
        audit(db,u,'knowledge.index.request',ident)
    return {'queued':True}

@router.put('/api/v2/agent-knowledge/{ident}/schedule')
def schedule(ident:str,data:dict,u=Depends(user)):
    manager(u)
    interval=data.get('hours')
    if type(interval) is not int or interval not in (0,24,168):raise HTTPException(422,'invalid_schedule')
    with transaction() as db:
        doc=get(db,'agent_documents',ident,u,True)
        if not doc['source_url']:raise HTTPException(409,'web_source_required')
        db.execute('UPDATE agent_documents SET sync_hours=?,next_sync=? WHERE id=?',(interval,int(time.time())+interval*3600,ident))
        audit(db,u,'knowledge.schedule.updated',ident,str(interval))
    return {'ok':True}

def process_knowledge():
    clock=int(time.time());model=''
    lock=' FOR UPDATE OF d SKIP LOCKED' if postgres() else ''
    with transaction() as db:
        doc=one(db,"""SELECT d.* FROM agent_documents d JOIN tenants t ON t.id=d.tenant_id WHERE t.status!='suspended'
          AND ((d.index_state IN ('queued','processing') AND d.index_after<=?) OR (d.sync_hours>0 AND d.next_sync<=?))
          ORDER BY d.updated_at,d.id LIMIT 1"""+lock,(clock,clock))
        if not doc:return False
        indexing=doc['index_state'] in ('queued','processing') and doc['index_after']<=clock
        if indexing:
            model=value('LABBILY_EMBEDDING_MODEL');policy=limits(db,doc['tenant_id'])
            if doc['status']!='approved' or not model or not policy['external_enabled'] or not reserve(db,doc['tenant_id'],policy['monthly_runs']):
                db.execute("UPDATE agent_documents SET index_state='blocked' WHERE id=?",(doc['id'],));return True
            db.execute("UPDATE agent_documents SET index_state='processing',index_after=? WHERE id=?",(clock+300,doc['id']))
        else:
            db.execute('UPDATE agent_documents SET next_sync=? WHERE id=?',(clock+doc['sync_hours']*3600,doc['id']))
    try:
        if indexing:
            vec,usage=ai_vectors(chunks(doc['content']),model)
            with transaction() as db:
                meter(db,doc['tenant_id'],'embedding',model,usage)
                current=one(db,'SELECT * FROM agent_documents WHERE id=?'+(' FOR UPDATE' if postgres() else ''),(doc['id'],))
                if not current or current['checksum']!=doc['checksum'] or current['status']!='approved' or not limits(db,doc['tenant_id'])['external_enabled']:return True
                for i,v in enumerate(vec):
                    db.execute('INSERT INTO agent_vectors VALUES(?,?,?,?,?,?) ON CONFLICT(document_id,checksum,model,chunk_index) DO UPDATE SET embedding=excluded.embedding',(doc['tenant_id'],doc['id'],doc['checksum'],model,i,json.dumps(v)))
                db.execute("UPDATE agent_documents SET index_state='ready',index_model=? WHERE id=?",(model,doc['id']))
        else:
            content=clean(fetch_page(doc['source_url']));checksum=hashlib.sha256(content.encode()).hexdigest()
            with transaction() as db:
                if checksum!=doc['checksum']:
                    db.execute("UPDATE agent_documents SET content=?,checksum=?,status='draft',index_state='none',sync_error='',updated_at=? WHERE id=? AND checksum=? AND sync_hours>0",
                               (content,checksum,now(),doc['id'],doc['checksum']))
                else:db.execute("UPDATE agent_documents SET sync_error='' WHERE id=?",(doc['id'],))
    except (HTTPException,httpx.HTTPError,ValueError,KeyError,TypeError):
        with transaction() as db:
            statement=("UPDATE agent_documents SET index_state='failed' WHERE id=? AND checksum=?" if indexing else
                       "UPDATE agent_documents SET sync_error='refresh_failed' WHERE id=? AND checksum=?")
            db.execute(statement,(doc['id'],doc['checksum']))
    return True

@router.get('/api/v2/agent-costs')
def costs(u=Depends(user)):
    manager(u);tid=u['tenant_id']
    with transaction() as db:
        data=rows(db,'SELECT operation,model,SUM(input_tokens) AS inputs,SUM(output_tokens) AS outputs,COUNT(*) AS calls,SUM(CAST(estimated_usd AS NUMERIC)) AS cost,COUNT(estimated_usd) AS priced FROM agent_meter WHERE tenant_id=? AND created_at>=? GROUP BY operation,model',(tid,month()+'-01'))
    return data
