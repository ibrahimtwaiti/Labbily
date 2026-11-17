"""Export erasure tombstones; replay them before a restored database may reopen.

The ledger contains opaque internal IDs, never tokens, email or message content.
Keep it privately outside the backup being restored. A replay queues the same
safe erasure workflow; it never bypasses a legal hold or silently calls production.
"""
import argparse,json,os
from pathlib import Path
from wasla.db import transaction,rows,one
from wasla.privacy import queue

def export_ledger():
    with transaction() as db:data=rows(db,"SELECT id,tenant_id,requester_id,scope,targets,completed_at FROM deletion_jobs WHERE state='completed'")
    return {'format':'wasla-erasure-ledger-v1','deletions':data}

def replay_ledger(ledger,apply=False):
    if ledger.get('format')!='wasla-erasure-ledger-v1' or not isinstance(ledger.get('deletions'),list):raise ValueError('invalid_erasure_ledger')
    if os.getenv('WASLA_ENV')=='production' or os.getenv('VERCEL_ENV'):raise ValueError('replay_requires_isolated_restore_environment')
    jobs=[]
    with transaction() as db:
        for row in ledger['deletions']:
            if row.get('scope') not in {'tenant','user','account','accounts'}:raise ValueError('invalid_deletion_scope')
            targets=json.loads(row['targets']);tid=row['tenant_id'];requester=row['requester_id'];scope=row['scope']
            if scope=='tenant' and not one(db,'SELECT id FROM tenants WHERE id=?',(tid,)):continue
            if scope=='user' and not one(db,'SELECT id FROM users WHERE id=?',(requester,)):continue
            if apply:jobs.append(queue(db,tid,requester,scope,targets['accounts'],targets['data_accounts'],source='restore:'+row['id']))
            else:jobs.append(row['id'])
    return {'apply':apply,'jobs':jobs}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('action',choices=['export','replay']);p.add_argument('file');p.add_argument('--apply',action='store_true');args=p.parse_args();path=Path(args.file)
    if args.action=='export':
        descriptor=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(descriptor,'w') as stream:json.dump(export_ledger(),stream)
        print('Private erasure ledger exported.')
    else:print(json.dumps(replay_ledger(json.loads(path.read_text()),args.apply)))
if __name__=='__main__':main()
