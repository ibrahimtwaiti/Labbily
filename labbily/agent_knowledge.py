"""Bounded document import, tenant approval and immutable retrieval snapshots."""
import base64
import hashlib
import http.client
import io
import ipaddress
import json
import re
import socket
import ssl
import zipfile
from html.parser import HTMLParser
from urllib.parse import urlsplit
from xml.etree import ElementTree
from fastapi import Depends, HTTPException
from pydantic import Field
from .agent_api import Input, Tiny, manager
from .db import now, one, rows, transaction, uid, audit, postgres
from .main import user
from .agent_engine import limits
from .security import limit
from .service_api import get, router

MAX_FILE=1024*1024
MAX_TEXT=18000

class Import(Input):
    title:Tiny
    text:str=Field(default='',max_length=MAX_TEXT)
    url:str=Field(default='',max_length=1000)
    filename:str=Field(default='',max_length=180)
    encoded:str=Field(default='',max_length=1400000)

class PublicPage(HTMLParser):
    def __init__(self):
        super().__init__(); self.hidden=0; self.parts=[]
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','template','noscript'):self.hidden+=1
        if not self.hidden and tag in ('p','h1','h2','h3','li','br','div'):self.parts.append('\n')
    def handle_endtag(self,tag):
        if tag in ('script','style','template','noscript'):self.hidden=max(self.hidden-1,0)
    def handle_data(self,data):
        if not self.hidden:self.parts.append(data)

def fetch_page(url):
    # Connect to a validated address and verify TLS for the original host. No redirects, cookies, or proxies.
    try:
        parsed=urlsplit(url);host=parsed.hostname
        if parsed.scheme!='https' or not host or parsed.username or parsed.password or parsed.port not in (None,443):
            raise ValueError()
        addresses=[ipaddress.ip_address(x[4][0]) for x in socket.getaddrinfo(host,443,type=socket.SOCK_STREAM)]
        if not addresses or any(not ip.is_global or ip.is_multicast or getattr(ip,'ipv4_mapped',None) for ip in addresses):
            raise ValueError()
        with socket.create_connection((str(addresses[0]),443),timeout=4) as sock:
            with ssl.create_default_context().wrap_socket(sock,server_hostname=host) as secured:
                conn=http.client.HTTPSConnection(host,timeout=4);conn.sock=secured
                try:
                    conn.request('GET',(parsed.path or '/')+('?'+parsed.query if parsed.query else ''),headers={'Accept':'text/html,text/plain','User-Agent':'Labbily-Knowledge/1'})
                    response=conn.getresponse()
                    if response.status!=200 or response.headers.get_content_type() not in ('text/html','text/plain'):raise ValueError()
                    raw=response.read(MAX_FILE+1)
                    if len(raw)>MAX_FILE:raise ValueError()
                    text=raw.decode(response.headers.get_content_charset() or 'utf-8')
                    if response.headers.get_content_type()=='text/html':
                        page=PublicPage();page.feed(text);text=''.join(page.parts)
                    return text
                finally:conn.close()
    except (ValueError,UnicodeError,LookupError,OSError,http.client.HTTPException):
        raise HTTPException(422,'public_https_document_unavailable')

def extract_file(data):
    try:
        raw=base64.b64decode(data.encoded,validate=True)
        if not raw or len(raw)>MAX_FILE:raise ValueError()
        ext=data.filename.lower().rsplit('.',1)[-1]
        if ext=='txt':return raw.decode('utf-8-sig')
        if ext=='pdf':
            from .service_media import scan
            from pypdf import PdfReader
            scan(raw,'application/pdf')
            doc=PdfReader(io.BytesIO(raw))
            if doc.is_encrypted or len(doc.pages)>40:raise ValueError()
            return '\n'.join((p.extract_text() or '')[:MAX_TEXT] for p in doc.pages)
        if ext=='docx':
            with zipfile.ZipFile(io.BytesIO(raw)) as doc:
                if len(doc.infolist())>300 or sum(x.file_size for x in doc.infolist())>8*MAX_FILE:raise ValueError()
                info=doc.getinfo('word/document.xml')
                if info.file_size>2*MAX_FILE:raise ValueError()
                xml=doc.read(info)
                if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():raise ValueError()
                root=ElementTree.fromstring(xml)
                ns='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                return '\n'.join(''.join(n.text or '' for n in p.iter(ns+'t')) for p in root.iter(ns+'p'))
    except HTTPException:raise
    except Exception:raise HTTPException(422,'unreadable_knowledge_document')
    raise HTTPException(422,'supported_types_pdf_docx_txt')

def clean(text):
    result='\n'.join(' '.join(line.split()) for line in text.splitlines() if line.strip())
    if not 2<=len(result)<=MAX_TEXT:raise HTTPException(422,'document_text_length_2_to_18000')
    return result

def chunks(text):
    parts=[];words=[]
    for w in text.split():
        if sum(map(len,words))+len(words)+len(w)>800 and words:
            parts.append(' '.join(words));words=[]
        words.append(w[:800])
    if words:parts.append(' '.join(words))
    return parts

def digest_snapshot(cfg):
    return hashlib.sha256(json.dumps(cfg,ensure_ascii=False,sort_keys=True).encode()).hexdigest()

def snapshot(db,tid,cfg):
    docs=[]
    for ident in dict.fromkeys(cfg.get('document_ids',[])):
        row=one(db,"SELECT title,content,checksum FROM agent_documents WHERE id=? AND tenant_id=? AND status='approved'",(ident,tid))
        if not row:raise HTTPException(409,'approved_document_required')
        docs.append({'id':ident,'checksum':row['checksum'],'title':row['title'],'chunks':chunks(row['content'])})
    return {**cfg,'documents':docs}

def verify_test_snapshot(db,a):
    if digest_snapshot(snapshot(db,a['tenant_id'],json.loads(a['draft'])))!=a['tested_snapshot']:
        raise HTTPException(409,'knowledge_changed_retest_required')

@router.get('/api/v2/agent-knowledge')
def documents(u=Depends(user)):
    manager(u)
    with transaction() as db:
        return rows(db,'SELECT id,title,status,source_url,updated_at,index_state,sync_hours,sync_error FROM agent_documents WHERE tenant_id=? ORDER BY updated_at DESC',(u['tenant_id'],))

@router.get('/api/v2/agent-knowledge/{ident}')
def document(ident:str,u=Depends(user)):
    manager(u)
    with transaction() as db:return get(db,'agent_documents',ident,u)

@router.post('/api/v2/agent-knowledge/import',status_code=201)
def import_document(data:Import,u=Depends(user)):
    manager(u);tid=u['tenant_id']
    if sum(bool(v) for v in (data.text,data.url,data.encoded))!=1:raise HTTPException(422,'choose_one_source')
    with transaction() as db:limit(db,'knowledge-import:'+tid,15,300)
    content=clean(data.text or (fetch_page(data.url) if data.url else extract_file(data)))
    with transaction() as db:
        db.execute('SELECT id FROM tenants WHERE id=?'+(' FOR UPDATE' if postgres() else ''),(tid,))
        if db.execute('SELECT count(*) FROM agent_documents WHERE tenant_id=?',(tid,)).fetchone()[0]>=limits(db,tid)['knowledge_documents']:raise HTTPException(409,'document_limit')
        ident=uid()
        db.execute('INSERT INTO agent_documents(id,tenant_id,title,source_url,content,checksum,updated_at) VALUES(?,?,?,?,?,?,?)',
                   (ident,tid,data.title,data.url,content,hashlib.sha256(content.encode()).hexdigest(),now()))
        audit(db,u,'knowledge.imported',ident)
    return {'id':ident,'status':'draft'}

@router.post('/api/v2/agent-knowledge/{ident}/approve')
def approve(ident:str,data:dict,u=Depends(user)):
    manager(u)
    with transaction() as db:
        doc=get(db,'agent_documents',ident,u,True)
        if data.get('checksum')!=doc['checksum']:raise HTTPException(409,'document_changed')
        db.execute("UPDATE agent_documents SET status='approved',updated_at=? WHERE id=?",(now(),ident))
        audit(db,u,'knowledge.approved',ident)
    return {'ok':True}

@router.post('/api/v2/agent-knowledge/{ident}/refresh')
def refresh(ident:str,u=Depends(user)):
    manager(u)
    with transaction() as db:
        doc=get(db,'agent_documents',ident,u);limit(db,'knowledge-import:'+u['tenant_id'],15,300)
    if not doc['source_url']:raise HTTPException(422,'web_source_required')
    content=clean(fetch_page(doc['source_url']))
    checksum=hashlib.sha256(content.encode()).hexdigest()
    with transaction() as db:
        current=get(db,'agent_documents',ident,u,True)
        if current['checksum']!=doc['checksum']:raise HTTPException(409,'document_changed')
        if current['checksum']!=checksum:
            db.execute("UPDATE agent_documents SET content=?,checksum=?,status='draft',index_state='none',updated_at=? WHERE id=?",(content,checksum,now(),ident))
            audit(db,u,'knowledge.refreshed',ident)
    return {'changed':checksum!=doc['checksum']}
