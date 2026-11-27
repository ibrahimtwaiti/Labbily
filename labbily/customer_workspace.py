"""Workspace contact directory, lifecycle and reviewed CSV imports."""
import csv
import io
import json
from typing import Literal
from fastapi import Depends, HTTPException, Query
from pydantic import Field
from .agent_api import Input, Tiny
from .db import audit, now, one, rows, transaction, uid
from .main import email, phone, user
from .security import permit
from .service_api import get, router

STAGES = ('new', 'interested', 'payment', 'customer', 'uninterested')


class Filters(Input):
    q: str = Field(default='', max_length=100)
    stage: str = Field(default='', max_length=64)
    consent: Literal['', 'yes', 'no'] = ''


class Segment(Input):
    name: Tiny
    filters: Filters


class Stage(Input):
    name: Tiny


class Profile(Input):
    blocked: bool | None = None
    stage: str = Field(max_length=64)
    email: str = Field(default='', max_length=254)
    tags: str = Field(default='', max_length=400)
    revision: int = Field(ge=0)


class ImportFile(Input):
    csv_text: str = Field(min_length=1, max_length=30000)
    apply: bool = False


def validate_stage(db, tenant, stage):
    if stage not in STAGES and not one(db, 'SELECT id FROM contact_stages WHERE tenant_id=? AND id=?', (tenant, stage)):
        raise HTTPException(422, 'unknown_contact_stage')


@router.get('/api/v2/crm/settings')
def settings(u=Depends(user)):
    permit(u, 'contacts')
    with transaction() as db:
        args = (u['tenant_id'],)
        stages = rows(db, 'SELECT id,name FROM contact_stages WHERE tenant_id=? ORDER BY name', args)
        segments = rows(db, 'SELECT id,name,filters FROM contact_segments WHERE tenant_id=? ORDER BY name', args)
        for segment in segments:
            segment['filters'] = json.loads(segment['filters'])
        return {'stages': stages, 'segments': segments}


@router.post('/api/v2/crm/stages', status_code=201)
def create_stage(data: Stage, u=Depends(user)):
    permit(u, 'settings')
    with transaction() as db:
        ident = uid()
        db.execute('INSERT INTO contact_stages VALUES(?,?,?)', (ident, u['tenant_id'], data.name))
        audit(db, u, 'contact.stage.created', ident)
        return {'id': ident}


@router.post('/api/v2/crm/segments', status_code=201)
def create_segment(data: Segment, u=Depends(user)):
    permit(u, 'crm')
    with transaction() as db:
        if data.filters.stage:
            validate_stage(db, u['tenant_id'], data.filters.stage)
        ident = uid()
        db.execute('INSERT INTO contact_segments VALUES(?,?,?,?)', (ident, u['tenant_id'], data.name, data.filters.model_dump_json()))
        return {'id': ident}


@router.get('/api/v2/crm/contacts')
def directory(filters: Filters = Depends(), before: str = Query('', max_length=120), limit: int = Query(40, ge=1, le=100), u=Depends(user)):
    permit(u, 'contacts')
    sql = """SELECT c.*,COALESCE(p.stage,'new') AS stage,COALESCE(p.email,'') AS email,
             COALESCE(p.blocked,0) AS blocked,COALESCE(p.revision,0) AS revision FROM contacts c
             LEFT JOIN contact_profiles p ON p.contact_id=c.id WHERE c.tenant_id=?"""
    args = [u['tenant_id']]
    if filters.stage:
        sql += " AND COALESCE(p.stage,'new')=?"
        args.append(filters.stage)
    if filters.consent:
        sql += ' AND c.marketing_consent=?'
        args.append(int(filters.consent == 'yes'))
    if filters.q:
        term = '%' + filters.q.lower().replace('!', '!!').replace('%', '!%').replace('_', '!_') + '%'
        sql += """ AND (LOWER(c.name) LIKE ? ESCAPE '!' OR c.phone LIKE ? ESCAPE '!'
                    OR LOWER(c.tags) LIKE ? ESCAPE '!' OR LOWER(p.email) LIKE ? ESCAPE '!')"""
        args.extend([term] * 4)
    if before:
        timestamp, separator, ident = before.partition('|')
        if not separator or not timestamp or not ident:
            raise HTTPException(422, 'invalid_cursor')
        sql += ' AND (c.created_at,c.id)<(?,?)'
        args.extend([timestamp, ident])
    with transaction() as db:
        items = rows(db, sql + ' ORDER BY c.created_at DESC,c.id DESC LIMIT ?', (*args, limit + 1))
    last = items[limit-1] if len(items) > limit else None
    return {'items': items[:limit], 'next': last['created_at'] + '|' + last['id'] if last else None}


@router.get('/api/v2/crm/contacts/{ident}/history')
def history(ident: str, u=Depends(user)):
    permit(u, 'contacts')
    with transaction() as db:
        get(db, 'contacts', ident, u)
        return rows(db, 'SELECT stage,changed_at FROM contact_stage_history WHERE contact_id=? ORDER BY changed_at DESC,id DESC LIMIT 50', (ident,))


@router.put('/api/v2/crm/contacts/{ident}')
def update_profile(ident: str, data: Profile, u=Depends(user)):
    permit(u, 'crm')
    address = email(data.email.strip())
    with transaction() as db:
        contact=get(db, 'contacts', ident, u, True)
        validate_stage(db, u['tenant_id'], data.stage)
        previous = one(db, 'SELECT stage,email,revision,blocked FROM contact_profiles WHERE contact_id=?', (ident,)) or {'stage': 'new', 'revision': 0}
        if data.revision != previous['revision']:
            raise HTTPException(409, 'contact_changed_reload')
        blocked=previous.get('blocked',0) if data.blocked is None else int(data.blocked)
        if blocked!=previous.get('blocked',0) and u['role'] not in ('admin','supervisor'):
            raise HTTPException(403,'manager_required_to_block_contact')
        db.execute("""INSERT INTO contact_profiles(contact_id,stage,email,revision,blocked) VALUES(?,?,?,?,?) ON CONFLICT(contact_id)
                      DO UPDATE SET stage=excluded.stage,email=excluded.email,revision=excluded.revision,blocked=excluded.blocked""",
                   (ident, data.stage, address, data.revision + 1, blocked))
        db.execute('UPDATE contacts SET tags=? WHERE id=? AND tenant_id=?', (data.tags.strip(), ident, u['tenant_id']))
        if previous['stage'] != data.stage:
            db.execute('INSERT INTO contact_stage_history VALUES(?,?,?,?)', (uid(), ident, data.stage, now()))
        triggers=[]
        if previous['stage']!=data.stage:triggers.append('stage_changed')
        if contact['tags']!=data.tags.strip() or previous.get('email','')!=address:triggers.append('field_changed')
        if triggers:
            from .flow_runtime import trigger
            # Use the latest linked conversation as the execution context.
            ticket=one(db,'''SELECT t.id FROM service_tickets t JOIN service_identities i ON i.id=t.identity_id
                             WHERE i.customer_id=? AND t.tenant_id=? ORDER BY t.updated_at DESC,t.id DESC LIMIT 1''',(ident,u['tenant_id']))
            if ticket:
                for kind in triggers:trigger(db,u['tenant_id'],ticket['id'],kind,'contact-'+ident+'-'+str(data.revision+1))
        audit(db, u, 'contact.profile.updated', ident)
        return {'revision': data.revision + 1}


@router.post('/api/v2/crm/import')
def import_contacts(data: ImportFile, u=Depends(user)):
    permit(u, 'settings')
    reader = csv.DictReader(io.StringIO(data.csv_text.lstrip('\ufeff')), strict=True)
    try:
        fields = reader.fieldnames or []
        if not {'name','phone'} <= set(fields) or set(fields) - {'name','phone','tags'} or len(fields) != len(set(fields)):
            raise HTTPException(422, 'csv_headers_name_phone_tags')
        records = list(reader)
    except csv.Error:
        raise HTTPException(422, 'invalid_csv')
    if not 1 <= len(records) <= 100:
        raise HTTPException(422, 'csv_requires_1_to_100_rows')
    with transaction() as db:
        seen, result = set(), []
        for n, row in enumerate(records, 2):
            name, tags = (row.get('name') or '').strip(), (row.get('tags') or '').strip()
            try:
                number = phone(row.get('phone') or '')
                if None in row or not 1 <= len(name) <= 200 or len(tags) > 400:
                    raise ValueError
            except (HTTPException, ValueError):
                result.append({'row': n, 'status': 'invalid'})
                continue
            exists = number in seen or one(db, 'SELECT id FROM contacts WHERE tenant_id=? AND phone=?', (u['tenant_id'], number))
            seen.add(number)
            result.append({'row': n, 'name': name, 'phone': number, 'tags': tags, 'status': 'duplicate' if exists else 'ready'})
        if not data.apply:
            return {'rows': result}
        if any(row['status'] == 'invalid' for row in result):
            raise HTTPException(422, 'correct_invalid_rows')
        added = 0
        for row in result:
            if row['status'] == 'ready':
                added += db.execute("""INSERT INTO contacts(id,tenant_id,name,phone,tags,marketing_consent,created_at)
                                       VALUES(?,?,?,?,?,0,?) ON CONFLICT(tenant_id,phone) DO NOTHING""",
                                    (uid(), u['tenant_id'], row['name'], row['phone'], row['tags'], now())).rowcount
        audit(db, u, 'contacts.import', u['tenant_id'], str(added))
        return {'added': added, 'skipped': len(result)-added}
