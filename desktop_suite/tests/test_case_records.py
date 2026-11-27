import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app_engine as engine


class CaseTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.store = self.root / "cases.json"
        self.source = self.root / "evidence.txt"
        self.source.write_bytes(b"abc")
        p = patch.object(engine, "_db", return_value=self.store)
        p.start()
        self.addCleanup(p.stop)

    def two_cases(self):
        return (engine.create_case({"title":"First case","summary":"Synthetic"}),
                engine.create_case({"title":"Second case","summary":"Synthetic"}))

    def test_attach_to_selected_nonlatest_case(self):
        first, second = self.two_cases()
        receipt = engine.attach_evidence({"case_id":first["case_id"],"path":str(self.source)})
        rows = engine.load_cases()
        self.assertEqual(rows[0]["case_id"], second["case_id"])
        self.assertEqual(rows[0]["evidence"], [])
        self.assertEqual(rows[1]["evidence"], [receipt])
        self.assertEqual(receipt["sha256"], "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        self.assertEqual(receipt["size_bytes"],3)
        self.assertEqual(receipt["case_id"],first["case_id"])
        self.assertFalse(receipt["identity_confirmed"])
        self.assertEqual(receipt["signature_status"],"NOT_VERIFIED")
        self.assertEqual(self.source.read_bytes(),b"abc")

    def test_no_case_selection_no_acquisition(self):
        self.two_cases()
        before = self.store.read_bytes()
        for body in ({"path":str(self.source)},{"case_id":"unknown","path":str(self.source)}):
            with patch.object(engine,"file_receipt",side_effect=AssertionError("must not acquire")):
                with self.assertRaises(engine.CaseError):
                    engine.attach_evidence(body)
        self.assertEqual(self.store.read_bytes(),before)

    def test_duplicate_legacy_id_blocks_attachment(self):
        first,second = self.two_cases()
        rows=engine.load_cases()
        rows[0]["case_id"]=first["case_id"]
        self.store.write_text(json.dumps(rows))
        before=self.store.read_bytes()
        with self.assertRaises(engine.CaseError):
            engine.attach_evidence({"case_id":first["case_id"],"path":str(self.source)})
        self.assertEqual(self.store.read_bytes(),before)

    def test_malformed_store_never_reset(self):
        for data in (b'broken',b'null',b'[{"case_id":"x","case_id":"y"}]'):
            self.store.write_bytes(data)
            with self.assertRaises(engine.CaseError):
                engine.create_case({"title":"New case"})
            self.assertEqual(self.store.read_bytes(),data)

    def test_failed_atomic_replace_preserves_original(self):
        first,_=self.two_cases()
        before=self.store.read_bytes()
        with patch.object(engine.os,"replace",side_effect=OSError("injected write failure")):
            with self.assertRaises(OSError):
                engine.attach_evidence({"case_id":first["case_id"],"path":str(self.source)})
        self.assertEqual(self.store.read_bytes(),before)
        self.assertFalse(self.store.with_name("cases.json.write-lock").exists())

    def test_stale_lock_blocks_writes(self):
        self.two_cases()
        before=self.store.read_bytes()
        lock=self.store.with_name("cases.json.write-lock")
        lock.touch()
        with self.assertRaises(engine.CaseError):
            engine.create_case({"title":"Another case"})
        self.assertEqual(self.store.read_bytes(),before)
        self.assertTrue(lock.exists())

    def test_missing_and_nonregular_file_rejected(self):
        first,_=self.two_cases()
        before=self.store.read_bytes()
        for path in (str(self.root/"missing"),str(self.root),"relative.txt"):
            with self.assertRaises((engine.CaseError,OSError)):
                engine.attach_evidence({"case_id":first["case_id"],"path":path})
        self.assertEqual(self.store.read_bytes(),before)

    def test_symlink_rejected(self):
        link=self.root/"link"
        link.symlink_to(self.source)
        with self.assertRaises(engine.CaseError):
            engine.file_receipt(str(link))

    def test_legacy_records_preserved(self):
        first,_=self.two_cases()
        rows=engine.load_cases()
        rows[1]["legacy_field"]="keep"
        self.store.write_text(json.dumps(rows))
        engine.attach_evidence({"case_id":first["case_id"],"path":str(self.source)})
        self.assertEqual(engine.load_cases()[1]["legacy_field"],"keep")

    def test_unique_case_ids(self):
        first,second=self.two_cases()
        self.assertNotEqual(first["case_id"],second["case_id"])

if __name__=="__main__":
    unittest.main()
