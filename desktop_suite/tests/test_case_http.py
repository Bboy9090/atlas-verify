import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import app_engine as engine

class HTTPTests(unittest.TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root=Path(tmp.name)
        self.store=root/"cases.json"
        self.source=root/"evidence.txt"
        self.source.write_bytes(b"abc")
        p=patch.object(engine,"_db",return_value=self.store)
        p.start()
        self.addCleanup(p.stop)
        self.client=engine.create_app(8765,root,{"title":"Case File"}).test_client()
        self.base="http://127.0.0.1:8765"

    def post(self,path,body,**kwargs):
        return self.client.post(path,json=body,base_url=self.base,**kwargs)

    def test_explicit_attachment_receipt(self):
        a=self.post("/api/cases",{"title":"First"}).json["case"]["case_id"]
        b=self.post("/api/cases",{"title":"Second"}).json["case"]["case_id"]
        res=self.post("/api/verify-evidence",{"case_id":a,"path":str(self.source)})
        self.assertEqual(res.status_code,200)
        self.assertIs(res.json["persisted"],True)
        self.assertEqual(res.json["case_id"],a)
        self.assertEqual(res.json["receipt"]["case_id"],a)
        rows=self.client.get("/api/cases",base_url=self.base).json["cases"]
        self.assertEqual(rows[0]["case_id"],b)
        self.assertEqual(rows[0]["evidence"],[])
        self.assertEqual(rows[1]["evidence"],[res.json["receipt"]])

    def test_unknown_destination_fails(self):
        res=self.post("/api/verify-evidence",{"case_id":"unknown","path":str(self.source)})
        self.assertEqual(res.status_code,409)
        self.assertIs(res.json["persisted"],False)
        self.assertFalse(self.store.exists())

    def test_wrong_origin_and_non_json_rejected(self):
        self.assertEqual(self.post("/api/cases",{"title":"Test"},headers={"Origin":"https://invalid.example"}).status_code,403)
        self.assertEqual(self.client.post("/api/cases",data="title=Test",base_url=self.base).status_code,415)
        self.assertFalse(self.store.exists())

    def test_corrupt_case_health_and_read_fail_closed(self):
        self.store.write_bytes(b"broken")
        self.assertEqual(self.client.get("/api/health",base_url=self.base).status_code,503)
        self.assertEqual(self.client.get("/api/cases",base_url=self.base).status_code,503)
        self.assertEqual(self.store.read_bytes(),b"broken")

    def test_health_discloses_local_only(self):
        r=self.client.get("/api/health",base_url=self.base)
        self.assertEqual(r.status_code,200)
        self.assertIs(r.json["live_people_search"],False)

if __name__=="__main__":
    unittest.main()
