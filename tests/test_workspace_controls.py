import base64
import io
import unittest
from unittest.mock import patch
import httpx
from PIL import Image
import test_acceptance as base
from labbily.db import now, transaction


class WorkspaceControls(unittest.TestCase):
    setUp=base.Acceptance.setUp
    tearDown=base.Acceptance.tearDown
    login=base.Acceptance.login

    def test_campaign_image_is_private_and_survives_text_edits(self):
        self.login()
        buf=io.BytesIO()
        Image.new('RGB',(12,20),'red').save(buf,'PNG')
        payload={'channel':'whatsapp','name':'Picture','image':base64.b64encode(buf.getvalue()).decode()}
        path='/api/v2/campaigns'
        r=self.client.post(path,json=payload)
        r.raise_for_status()
        item=path+'/'+r.json()['id']
        img=self.client.get(item+'/image');img.raise_for_status()
        self.assertEqual(img.headers['content-type'],'image/jpeg')
        self.assertEqual(Image.open(io.BytesIO(img.content)).size,(12,20))
        del payload['image']
        self.client.put(item,json={**payload,'body':'Caption','revision':1}).raise_for_status()
        self.assertTrue(self.client.get(path).json()['items'][0]['has_image'])
        self.assertEqual(self.client.put(item,json={**payload,'image':'invalid','revision':2}).status_code,422)
        self.login('admin-b')
        self.assertEqual(self.client.get(item+'/image').status_code,404)
        self.login()
        self.client.put(item,json={**payload,'body':'Text only','image':'','revision':2}).raise_for_status()
        self.assertEqual(self.client.get(item+'/image').status_code,404)

    def test_settings_members_fields_and_hours_are_operational(self):
        self.login()
        p='/api/v2/workspace/'
        team=self.client.post(p+'teams',json={'name':'Support','members':['sales-a']});team.raise_for_status()
        url=p+'teams/'+team.json()['id']
        self.assertEqual(self.client.put(url,json={'name':'Support','members':['admin-b'],'revision':1}).status_code,422)
        self.assertEqual(self.client.get(p+'teams').json()[0]['members'],['sales-a'])
        fld=self.client.post(p+'fields',json={'name':'Branch','kind':'text'});fld.raise_for_status()
        cid=self.client.post('/api/contacts',json={'name':'Sample','phone':'+966500000002'}).json()['id']
        contact='/api/v2/crm/contacts/'+cid
        self.client.put(contact,json={'stage':'new','revision':0,'custom':{fld.json()['id']:'North'}}).raise_for_status()
        self.assertEqual(self.client.get(contact+'/fields').json()[0]['value'],'North')
        self.client.put(p+'hours',json={'start_hour':8,'end_hour':16,'workdays':[6,0,1]}).raise_for_status()
        self.assertEqual(self.client.get('/api/v2/settings').json()['workdays'],[0,1,6])
        self.client.put(p+'notifications',json={'mentions':False}).raise_for_status()
        self.assertFalse(self.client.get(p+'notifications').json()['mentions'])
        self.login('admin-b')
        self.assertTrue(self.client.get(p+'notifications').json()['mentions'])
        self.assertEqual(self.client.get(contact+'/fields').status_code,404)
        self.assertEqual(self.client.get(p+'fields').json(),[])

    def test_provider_costs_use_bound_waba_and_preserve_missing_cost(self):
        self.login()
        with transaction() as db:
            db.execute("INSERT INTO service_accounts(id,tenant_id,channel,provider_id,label,api_version,state,created_at) VALUES('phone','a','whatsapp','123','One','v27.0','verified',?)",(now(),))
            db.execute("INSERT INTO meta_business_accounts VALUES('456','a',?)",(now(),))
            db.execute("INSERT INTO meta_connections VALUES('phone','a','456','subscribed','registered',?)",(now(),))
        responses=[httpx.Response(200,json={'data':[{'data_points':[{'start':123,'end':124,'volume':3}]}]}),httpx.Response(200,json={'currency':'SAR'})]
        with patch('labbily.service.provider_request',side_effect=responses) as graph:
            r=self.client.get('/api/v2/workspace/accounts/phone/costs?days=7')
            r.raise_for_status()
            self.assertEqual(graph.call_args_list[0].args[0]['provider_id'],'456')
            self.assertEqual(r.json()['currency'],'SAR')
            self.assertIsNone(r.json()['points'][0]['cost'])
        self.login('admin-b')
        self.assertEqual(self.client.get('/api/v2/workspace/accounts/phone/costs').status_code,404)

