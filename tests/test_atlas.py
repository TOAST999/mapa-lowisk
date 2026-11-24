import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

import serwer


class CatalogTests(unittest.TestCase):
    def test_each_pilot_has_five_sourced_lakes_inside_its_boundary(self):
        data = json.loads((serwer.STATIC / "lowiska.json").read_text(encoding="utf-8"))
        regions = {p["name"]: p["rings"] for p in json.loads((serwer.STATIC / "regiony.json").read_text(encoding="utf-8"))}
        counts = {}

        def inside_ring(x, y, ring):
            inside = False
            for a, b in zip(ring, ring[1:]):
                if (a[1] > y) != (b[1] > y):
                    boundary_x = (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]
                    if x < boundary_x:
                        inside = not inside
            return inside

        self.assertEqual(len(regions), 16)
        self.assertEqual(len(serwer.LAKES), 15)
        for lake in data:
            self.assertGreater(lake["depth"], 0)
            self.assertTrue(lake["fish"] and lake["sources"])
            self.assertTrue(all(url.startswith("https://") for _, url in lake["sources"]))
            self.assertTrue(sum(inside_ring(lake["lon"], lake["lat"], ring) for ring in regions[lake["region"]]) % 2, lake["name"])
            counts[lake["region"]] = counts.get(lake["region"], 0) + 1
        self.assertEqual(counts, {"dolnośląskie": 5, "opolskie": 5, "lubuskie": 5})


class SharedReportsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "test.sqlite3"
        serwer.setup(self.path)

    def post(self, route, data, client="A", when=1000):
        with closing(serwer.connect(self.path)) as db:
            return serwer.change(db, route, data, client, when)

    def test_cross_user_votes_and_two_flags(self):
        report = self.post("/api/zgloszenia", {"lake":"mietkowskie"})[0]
        route = "/api/zgloszenia/{}/glos".format(report["id"])
        with self.assertRaises(serwer.InputError) as own:
            self.post(route, {"kind":"confirm"})
        self.assertEqual(own.exception.status, 403)
        for _ in range(2):
            result = self.post(route, {"kind":"confirm"}, "B")
            self.assertEqual(result[0]["confirmations"], 1)
        result = self.post(route, {"kind":"flag"}, "B")
        self.assertEqual((result[0]["confirmations"], result[0]["flags"]), (0,1))
        self.assertEqual(self.post(route, {"kind":"flag"}, "C"), [])

    def test_expiry_boundary_and_late_vote(self):
        item = self.post("/api/zgloszenia", {"lake":"nyskie"})[0]
        end = item["expires"]
        with closing(serwer.connect(self.path)) as db:
            self.assertEqual(len(serwer.active(db, "B", end-1)), 1)
            self.assertEqual(serwer.active(db, "B", end), [])
        self.assertNotEqual(self.post("/api/zgloszenia", {"lake":"nyskie"}, when=end)[0]["id"], item["id"])
        with self.assertRaises(serwer.InputError) as old:
            self.post("/api/zgloszenia/{}/glos".format(item["id"]), {"kind":"confirm"}, "B", end)
        self.assertEqual(old.exception.status, 404)

    def test_two_simultaneous_reports_leave_one_entry(self):
        start = threading.Barrier(2)
        def add(client):
            start.wait(timeout=5)
            try:
                self.post("/api/zgloszenia", {"lake":"slup"}, client)
                return 200
            except serwer.InputError as error:
                return error.status
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(add, ["A","B"])), [200,409])
        with closing(serwer.connect(self.path)) as db:
            self.assertEqual(len(serwer.active(db,"C",1000)), 1)

    def test_unknown_lake_and_extra_fields(self):
        for payload in ({"lake":"nieznane"}, {"lake":"slup", "opis":"dodatkowe pole"}):
            with self.assertRaises(serwer.InputError) as invalid:
                self.post("/api/zgloszenia", payload)
            self.assertEqual(invalid.exception.status, 400)

if __name__ == "__main__":
    unittest.main()
