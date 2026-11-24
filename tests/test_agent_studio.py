import time
import unittest
from unittest.mock import patch
from test_acceptance import Acceptance
from wasla.db import transaction, now, one, uid
from wasla import agent_engine, service

class AgentStudio(unittest.TestCase):
    setUp=Acceptance.setUp
    tearDown=Acceptance.tearDown
    login=Acceptance.login

    def build(self):
        self.login()
        config={'name':'Reception','sources':[{'title':'ساعات العمل','answer':'من التاسعة إلى الخامسة'}],'tools':['followup']}
        r=self.client.post('/api/v2/agents',json=config)
        self.assertEqual(r.status_code,201,r.text)
        return '/api/v2/agents/'+r.json()['id'],config

    def publish(self,base):
        r=self.client.post(base+'/playground',json={'question':'ساعات العمل','expected':'answer','save':True})
        self.assertEqual(r.status_code,200,r.text)
        self.assertTrue(r.json()['scenarios_passed'])
        r=self.client.post(base+'/publish',json={'revision':1})
        self.assertEqual(r.status_code,200,r.text)
        return r

    def test_isolation_simulation_and_stale_revision(self):
        base,cfg=self.build()
        self.assertEqual(self.client.post(base+'/publish',json={'revision':1}).status_code,409)
        self.publish(base)
        mock=self.client.post(base+'/playground',json={'question':'أحتاج متابعة'}).json()
        self.assertEqual(mock['kind'],'followup')
        with transaction() as db:
            for table in ('tasks','service_messages','service_outbox','agent_runs'):
                self.assertEqual(db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0],0)
        self.assertEqual(self.client.put(base,json={'revision':1,'config':cfg}).status_code,200)
        self.assertEqual(self.client.put(base,json={'revision':1,'config':cfg}).status_code,409)
        self.login('admin-b')
        self.assertEqual(self.client.get(base).status_code,404)
        self.login('sales-a')
        self.assertEqual(self.client.get('/api/v2/agents').status_code,403)
        self.assertEqual(self.client.get('/api/admin/workspaces/a/agent-policy').status_code,403)

    def test_knowledge_approval_snapshot_and_permissions(self):
        base,cfg=self.build()
        doc=self.client.post('/api/v2/agent-knowledge/import',json={'title':'Policy','text':'Visits require a confirmed appointment.'}).json()['id']
        cfg['document_ids']=[doc]
        self.client.put(base,json={'revision':1,'config':cfg}).raise_for_status()
        self.assertEqual(self.client.post(base+'/playground',json={'question':'confirmed appointment'}).status_code,409)
        content=self.client.get('/api/v2/agent-knowledge/'+doc).json()
        self.client.post('/api/v2/agent-knowledge/'+doc+'/approve',json={'checksum':content['checksum']}).raise_for_status()
        result=self.client.post(base+'/playground',json={'question':'confirmed appointment','expected':'review','save':True}).json()
        self.assertEqual(result['source'],'Policy')
        self.assertEqual(self.client.post(base+'/publish',json={'revision':2}).status_code,200)
        self.login('admin-b')
        self.assertEqual(self.client.get('/api/v2/agent-knowledge/'+doc).status_code,404)
        self.assertEqual(self.client.post('/api/v2/agent-knowledge/import',json={'title':'Bad host','url':'https://127.0.0.1/'}).status_code,422)

    def prepare_channel(self,mode='suggest'):
        base,_=self.build()
        self.publish(base)
        with transaction() as db:
            db.execute("INSERT INTO service_accounts(id,tenant_id,channel,provider_id,label,api_version,state,created_at) VALUES('a1','a','whatsapp','p1','WA','v27.0','verified',?)",(now(),))
        self.assertEqual(self.client.put(base+'/deployment',json={'account_id':'a1','mode':mode}).status_code,409)
        self.login('provider')
        self.client.put('/api/admin/workspaces/a/agent-policy',json={'max_agents':3,'monthly_runs':4,'live_enabled':True,'external_enabled':False}).raise_for_status()
        self.login()
        self.client.put(base+'/deployment',json={'account_id':'a1','mode':mode}).raise_for_status()
        return base

    def inbound(self,text):
        mid=uid()
        event={'object':'whatsapp_business_account','entry':[{'changes':[{'value':{'metadata':{'phone_number_id':'p1'},
               'messages':[{'id':mid,'from':'966123','timestamp':str(int(time.time())),'type':'text','text':{'body':text}}]}}]}]}
        service.persist_events('whatsapp',event)
        self.assertTrue(service.process_event())
        return event

    def test_suggest_handover_and_duplicate(self):
        self.prepare_channel()
        event=self.inbound('ساعات العمل')
        service.persist_events('whatsapp',event)
        self.assertFalse(service.process_event())
        self.inbound('أحتاج متابعة')
        self.inbound('ساعات العمل')
        with transaction() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM service_outbox').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM agent_runs').fetchone()[0],2)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM tasks').fetchone()[0],1)
            self.assertEqual(one(db,'SELECT automation_paused FROM service_tickets')['automation_paused'],1)
            self.assertEqual(db.execute('SELECT runs FROM agent_usage').fetchone()[0],2)

    def test_human_ownership_blocks_prepared_send(self):
        base=self.prepare_channel('auto')
        with patch('wasla.service.token',return_value='isolated-credential'):
            self.inbound('ساعات العمل')
            ticket=self.client.get('/api/v2/tickets').json()[0]
            self.client.post('/api/v2/tickets/'+ticket['id']+'/messages',json={'body':'Human takeover','direction':'note','version':ticket['version']},headers={'Idempotency-Key':uid()}).raise_for_status()
            with patch('wasla.service.provider_request') as channel:
                self.assertTrue(service.send_outbox())
                channel.assert_not_called()
        with transaction() as db:
            self.assertEqual(one(db,"SELECT state FROM service_outbox WHERE request_key LIKE 'agent:%'")['state'],'blocked')
        self.assertEqual(self.client.post('/api/v2/tickets/'+ticket['id']+'/copilot',json={'agent_id':base.rsplit('/',1)[1],'operation':'translate','text':'Hi'}).status_code,409)
