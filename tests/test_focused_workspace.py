import time
import unittest
from unittest.mock import patch
import httpx
import test_acceptance as baseline
from labbily import flow_runtime as flows, service
from labbily.db import now, transaction


class FocusedWorkspace(unittest.TestCase):
    setUp=baseline.Acceptance.setUp
    tearDown=baseline.Acceptance.tearDown
    login=baseline.Acceptance.login

    def test_directory_import_history_isolation_and_legacy_contacts(self):
        self.login()
        path='/api/v2/crm'
        csv='name,phone,tags\nSame Name,+966510000001,one\nSame Name,+966510000002,two'
        self.client.post(path+'/import',json={'csv_text':csv}).raise_for_status()
        self.assertEqual(self.client.get('/api/contacts').json(),[])
        self.assertEqual(self.client.post(path+'/import',json={'csv_text':csv,'apply':True}).json()['added'],2)
        self.assertEqual(self.client.post(path+'/import',json={'csv_text':csv,'apply':True}).json()['skipped'],2)
        bad=csv+'\nBad,invalid,tag'
        self.assertEqual(self.client.post(path+'/import',json={'csv_text':bad,'apply':True}).status_code,422)
        page=self.client.get(path+'/contacts',params={'limit':1}).json()
        next_page=self.client.get(path+'/contacts',params={'before':page['next'],'limit':1}).json()
        self.assertNotEqual(page['items'][0]['id'],next_page['items'][0]['id'])
        contact=page['items'][0];self.assertEqual(contact['stage'],'new');self.assertFalse(contact['marketing_consent'])
        stage=self.client.post(path+'/stages',json={'name':'VIP'}).json()['id']
        url=path+'/contacts/'+contact['id']
        payload={'revision':0,'email':'qa@example.test','stage':stage,'tags':'premium'}
        self.client.put(url,json=payload).raise_for_status()
        self.assertEqual(self.client.put(url,json=payload).status_code,409)
        self.assertEqual(self.client.get(url+'/history').json()[0]['stage'],stage)
        self.assertEqual(len(self.client.get(path+'/contacts',params={'q':'QA@','stage':stage,'consent':'no'}).json()['items']),1)
        self.client.post(path+'/segments',json={'name':'VIP','filters':{'stage':stage}}).raise_for_status()
        self.login('admin-b')
        self.assertEqual(self.client.get(url+'/history').status_code,404)
        self.assertEqual(self.client.get(path+'/settings').json(),{'segments':[],'stages':[]})
        self.login('sales-a')
        self.assertEqual(self.client.post(path+'/import',json={'csv_text':csv,'apply':True}).status_code,403)

    def seed_tickets(self):
        self.login()
        with transaction() as db:
            db.execute("INSERT INTO service_accounts(id,tenant_id,channel,provider_id,label,api_version,state,created_at) VALUES('acc','a','whatsapp','wa','WA','v27.0','verified',?)",(now(),))
            db.execute("INSERT INTO service_identities(id,tenant_id,account_id,provider_user_id,name,created_at) VALUES('person','a','acc','123','Test',?)",(now(),))
            for ident,owner in [('t1',None),('t2','admin-a'),('t3','sales-a')]:
                db.execute("INSERT INTO service_tickets(id,tenant_id,identity_id,assignee_id,last_customer_at,created_at,updated_at) VALUES(?,'a','person',?,?,10,10)",(ident,owner,int(time.time())))

    def test_ticket_cursor_ties_filters_and_assignment(self):
        self.seed_tickets()
        endpoint='/api/v2/tickets'
        self.assertEqual([t['id'] for t in self.client.get(endpoint,params={'limit':1}).json()],['t3'])
        self.assertEqual([t['id'] for t in self.client.get(endpoint,params={'before':'10|t3','limit':1}).json()],['t2'])
        self.assertEqual(self.client.get(endpoint,params={'scope':'mine','team':'support'}).json()[0]['id'],'t2')
        self.assertEqual(self.client.get(endpoint,params={'order':'oldest'}).json()[0]['id'],'t1')
        self.login('sales-a')
        self.assertEqual(self.client.get(endpoint,params={'scope':'unassigned'}).json(),[])
        self.assertEqual(self.client.get(endpoint,params={'scope':'mine'}).json()[0]['id'],'t3')
        self.login('admin-b')
        self.assertEqual(self.client.get(endpoint).json(),[])

    def publish(self, steps, trigger='manual'):
        path='/api/v2/workflows'
        r=self.client.post(path,json={'name':'QA','trigger':trigger,'steps':steps});r.raise_for_status()
        base=path+'/'+r.json()['id']
        self.assertEqual(self.client.post(base+'/publish',json={'revision':1}).status_code,409)
        self.client.post(base+'/simulate',json={'revision':1}).raise_for_status()
        self.client.post(base+'/publish',json={'revision':1}).raise_for_status()
        return base

    def test_workflow_version_idempotency_resume_pause_and_tenant_boundary(self):
        self.seed_tickets()
        steps=[{'action':'condition','field':'channel','value':'whatsapp','otherwise':4},{'action':'wait','value':'2'},{'action':'assign','value':'support'}]
        base=self.publish(steps)
        self.assertEqual(self.client.post(base+'/simulate',json={'revision':1,'channel':'instagram'}).json()['trace'],[{'step':1,'action':'condition'}])
        headers={'Idempotency-Key':'manual-key-0000001'}
        url=base+'/tickets/t1'
        first=self.client.post(url,headers=headers,json={}).json()
        self.assertEqual(first,self.client.post(url,headers=headers,json={}).json())
        self.assertTrue(flows.process_flow());self.assertTrue(flows.process_flow());self.assertFalse(flows.process_flow())
        with transaction() as db:db.execute("UPDATE workspace_flow_runs SET due_at=0")
        self.assertTrue(flows.process_flow())
        self.assertEqual(self.client.get(base).json()['runs'][0]['state'],'done')
        self.client.post(base+'/pause',json={'revision':1}).raise_for_status()
        self.assertEqual(self.client.post(url,headers=headers,json={}).status_code,409)
        self.login('admin-b');self.assertEqual(self.client.get(base).status_code,404)
        self.login('sales-a');self.assertEqual(self.client.get(base).status_code,403)

    def test_question_waits_for_reply_and_handover_blocks_dispatch(self):
        self.seed_tickets()
        base=self.publish([{'action':'question','value':'Which service?'},{'action':'message','value':'Thanks!'}])
        self.client.post(base+'/tickets/t1',json={},headers={'Idempotency-Key':'question-test-0000001'}).raise_for_status()
        with patch.object(service,'token',return_value='test'),patch.object(service,'provider_request',return_value=httpx.Response(200,json={'messages':[{'id':'wa-test'}]})) as provider:
            self.assertTrue(flows.process_flow());self.assertTrue(service.send_outbox())
            self.assertEqual(self.client.get(base).json()['runs'][0]['state'],'answer')
            with transaction() as db:flows.on_inbound(db,'a','t1','reply','Support',False)
            self.assertTrue(flows.process_flow())
            with transaction() as db:flows.on_inbound(db,'a','t1','help','موظف',False)
            self.assertTrue(service.send_outbox());self.assertEqual(provider.call_count,1)
        self.assertEqual(self.client.get(base).json()['runs'][0]['state'],'stopped')
        with transaction() as db:
            self.assertIsNone(db.execute("SELECT first_human_at FROM service_tickets WHERE id='t1'").fetchone()[0])

    def test_provider_channel_pause_and_contact_block(self):
        self.seed_tickets()
        self.login('provider')
        self.client.patch('/api/admin/workspaces/a/integrations/acc',json={'api_version':'v27.0','label':'WA','ai_paused':True}).raise_for_status()
        self.login()
        self.assertEqual(self.client.get('/api/v2/tickets/t1/copilot').json(),[])
        r=self.client.post('/api/v2/tickets/t1/copilot',json={'agent_id':'any','operation':'draft','text':'hi'})
        self.assertEqual(r.json()['detail'],'channel_ai_paused')
        c=self.client.post('/api/contacts',json={'name':'QA','phone':'+966511111111'}).json()['id']
        with transaction() as db:db.execute("UPDATE service_identities SET customer_id=? WHERE id='person'",(c,))
        path='/api/v2/crm/contacts/'+c
        data={'stage':'customer','blocked':True,'revision':0}
        self.login('sales-a');self.assertEqual(self.client.put(path,json=data).status_code,403)
        self.login();self.client.put(path,json=data).raise_for_status()
        base=self.publish([{'action':'message','value':'Hello'}])
        self.client.post(base+'/tickets/t1',json={},headers={'Idempotency-Key':'test-block-request-0001'}).raise_for_status()
        with patch.object(service,'token',return_value='test'):
            self.assertTrue(flows.process_flow())
        self.assertEqual(self.client.get(base).json()['runs'][0]['detail'],'contact_messages_blocked')
