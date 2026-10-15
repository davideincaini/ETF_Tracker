"""
Tests for update_market_data.py — run with:  python3 -m unittest discover -s scripts

WHY THESE TESTS
---------------
The script's job is to never publish a wrong price and never lose a good one.
Each test below pins down one of those promises. The network is replaced by a
fake `fetch` function, so the tests are fast, deterministic and run offline.
One fixture is a REAL Yahoo response (captured 2026-10-15), so the parser is
checked against the true format, including a null close Yahoo really sends.
"""

import json
import math
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import update_market_data as umd

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 10, 15, 17, 30, tzinfo=timezone.utc)


def real_xdpu_payload() -> dict:
    return json.loads((FIXTURES / "yahoo_XDPU.MI_5d.json").read_text())


def synthetic_payload(price: float, currency: str = "EUR", days: int = 60,
                      market_time: datetime = NOW) -> dict:
    """A Yahoo-shaped response with `days` daily closes ending at `price`."""
    start = NOW - timedelta(days=days)
    timestamps = [int((start + timedelta(days=i)).timestamp()) for i in range(days)]
    closes = [round(price * (0.9 + 0.1 * i / max(days - 1, 1)), 4) for i in range(days)]
    return {"chart": {"error": None, "result": [{
        "meta": {"currency": currency, "regularMarketPrice": price,
                 "regularMarketTime": int(market_time.timestamp())},
        "timestamp": timestamps,
        "indicators": {"quote": [{"close": closes}]},
    }]}}


def fake_fetcher(responses: dict):
    """Build a fetch() that returns canned payloads, or raises for 'FAIL'.

    responses maps ticker -> payload (or the string 'FAIL'). The same payload
    serves both the quote request (params has 'range') and the history request
    (params has 'period1'), which is how the real endpoint behaves too.
    """
    def fetch(url, params):
        ticker = url.rsplit("/", 1)[-1]
        payload = responses[ticker]
        if payload == "FAIL":
            raise umd.FetchError("simulated network failure")
        return payload
    return fetch


class ParsingTests(unittest.TestCase):

    def test_quote_from_real_response(self):
        quote = umd.fetch_quote("XDPU.MI", lambda url, params: real_xdpu_payload())
        self.assertEqual(quote["price"], 13.34)
        self.assertEqual(quote["currency"], "EUR")
        self.assertEqual(quote["market_time"], "2026-10-15T07:51:24Z")

    def test_history_skips_null_closes_and_sorts(self):
        points = umd.fetch_history("XDPU.MI", NOW, lambda url, params: real_xdpu_payload())
        # 5 timestamps, one with a null close -> 4 usable points
        self.assertEqual(len(points), 4)
        self.assertEqual([p[0] for p in points], sorted(p[0] for p in points))
        self.assertEqual(points[-1], ["2026-10-15", 13.34])
        self.assertTrue(all(umd.is_valid_price(p[1]) for p in points))

    def test_history_asks_for_daily_granularity_with_explicit_dates(self):
        seen = {}
        def spy(url, params):
            seen.update(params)
            return real_xdpu_payload()
        umd.fetch_history("XDPU.MI", NOW, spy)
        # range=max would make Yahoo return monthly points (see docstring)
        self.assertNotIn("range", seen)
        self.assertEqual(seen["interval"], "1d")
        self.assertEqual(seen["period1"], 0)

    def test_yahoo_error_payload_raises(self):
        payload = {"chart": {"result": None,
                             "error": {"code": "Not Found",
                                       "description": "No data found, symbol may be delisted"}}}
        with self.assertRaises(umd.FetchError) as ctx:
            umd.extract_result(payload)
        self.assertIn("delisted", str(ctx.exception))

    def test_price_sanity(self):
        for bad in (0, -1, math.nan, math.inf, None, "13.3", True):
            self.assertFalse(umd.is_valid_price(bad), bad)
        self.assertTrue(umd.is_valid_price(13.34))


class ValidationTests(unittest.TestCase):

    def quote(self, price=13.0, currency="EUR", when=NOW):
        return {"price": price, "currency": currency, "market_time": umd.iso(when)}

    def test_wrong_currency_rejected(self):
        # The classic Yahoo trap: a London listing quoted in pence (GBp)
        reason = umd.validate_quote(self.quote(6063.22, "GBp"), None, NOW)
        self.assertIn("currency", reason)

    def test_large_jump_vs_recent_price_rejected(self):
        previous = self.quote(13.0, when=NOW - timedelta(days=1))
        reason = umd.validate_quote(self.quote(1300.0), previous, NOW)
        self.assertIsNotNone(reason)
        self.assertIn("accept_jumps", reason)

    def test_large_jump_allowed_when_explicitly_accepted(self):
        previous = self.quote(13.0, when=NOW - timedelta(days=1))
        self.assertIsNone(umd.validate_quote(self.quote(26.0), previous, NOW, accept_jumps=True))

    def test_jump_not_checked_against_old_reference(self):
        # After weeks without updates a big move can be genuine market history
        previous = self.quote(13.0, when=NOW - timedelta(days=40))
        self.assertIsNone(umd.validate_quote(self.quote(9.0), previous, NOW))

    def test_normal_move_accepted(self):
        previous = self.quote(13.0, when=NOW - timedelta(days=1))
        self.assertIsNone(umd.validate_quote(self.quote(13.4), previous, NOW))

    def test_future_market_time_rejected(self):
        reason = umd.validate_quote(self.quote(when=NOW + timedelta(days=3)), None, NOW)
        self.assertIn("future", reason)


class MergeTests(unittest.TestCase):

    previous = {"price": 12.0, "currency": "EUR",
                "market_time": "2026-10-10T15:30:00Z", "fetched_at": "2026-10-10T17:30:00Z"}

    def test_failed_fetch_keeps_previous_value_and_its_old_timestamp(self):
        entry = umd.merge_price("X", self.previous, None, "boom", NOW, False)
        self.assertEqual(entry["status"], "stale")
        self.assertEqual(entry["price"], 12.0)
        # The app must see the REAL age of the price, not this run's time
        self.assertEqual(entry["market_time"], "2026-10-10T15:30:00Z")

    def test_rejected_quote_keeps_previous_value(self):
        bad = {"price": 12.0, "currency": "USD", "market_time": umd.iso(NOW)}
        entry = umd.merge_price("X", self.previous, bad, None, NOW, False)
        self.assertEqual(entry["status"], "rejected")
        self.assertEqual(entry["price"], 12.0)
        self.assertIn("currency", entry["error"])

    def test_no_previous_and_failure_is_missing_not_zero(self):
        entry = umd.merge_price("X", None, None, "boom", NOW, False)
        self.assertEqual(entry["status"], "missing")
        self.assertIsNone(entry["price"])  # None, never 0: 0 looks like a real price

    def test_short_new_history_does_not_replace_long_old_one(self):
        old = [["2026-01-01", 10.0]] * 100
        points, status, _ = umd.merge_history(old, [["2026-10-15", 11.0]], None)
        self.assertEqual(status, "stale")
        self.assertEqual(len(points), 100)

    def test_short_history_without_previous_is_insufficient(self):
        points, status, _ = umd.merge_history(None, [["2026-10-15", 71.69]], None)
        self.assertEqual(status, "insufficient")
        self.assertEqual(len(points), 1)


class EndToEndTests(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def read(self, name):
        return json.loads((self.data_dir / name).read_text())

    def test_full_run_then_outage_keeps_data_and_signals_failure(self):
        good = fake_fetcher({"AAA.MI": synthetic_payload(10.0), "BBB.MI": synthetic_payload(50.0)})
        code = umd.run(["AAA.MI", "BBB.MI"], self.data_dir, NOW, good, pause_s=0)
        self.assertEqual(code, 0)
        prices = self.read("prices.json")
        self.assertEqual(prices["schema"], 1)
        self.assertEqual(prices["tickers"]["AAA.MI"]["status"], "ok")
        self.assertEqual(len(self.read("history.json")["tickers"]["BBB.MI"]["points"]), 60)

        # Next day Yahoo is down: nothing must be lost, and the run must go red
        down = fake_fetcher({"AAA.MI": "FAIL", "BBB.MI": "FAIL"})
        code = umd.run(["AAA.MI", "BBB.MI"], self.data_dir, NOW + timedelta(days=1), down, pause_s=0)
        self.assertEqual(code, 1)
        prices = self.read("prices.json")
        self.assertEqual(prices["tickers"]["AAA.MI"]["price"], 10.0)
        self.assertEqual(prices["tickers"]["AAA.MI"]["status"], "stale")
        self.assertEqual(len(self.read("history.json")["tickers"]["BBB.MI"]["points"]), 60)

    def test_insufficient_history_alone_does_not_fail_the_run(self):
        # Mirrors SGLN.MI today: valid price, Yahoo has just 1 history point
        fetch = fake_fetcher({"GOLD.MI": synthetic_payload(71.69, days=1)})
        code = umd.run(["GOLD.MI"], self.data_dir, NOW, fetch, pause_s=0)
        self.assertEqual(code, 0)
        self.assertEqual(self.read("history.json")["tickers"]["GOLD.MI"]["status"], "insufficient")

    def test_history_file_has_one_point_per_line(self):
        fetch = fake_fetcher({"AAA.MI": synthetic_payload(10.0, days=30)})
        umd.run(["AAA.MI"], self.data_dir, NOW, fetch, pause_s=0)
        text = (self.data_dir / "history.json").read_text()
        point_lines = [l for l in text.splitlines() if l.strip().startswith('["')]
        self.assertEqual(len(point_lines), 30)

    def test_output_files_are_world_readable(self):
        # They are served as public web content (GitHub Pages)
        fetch = fake_fetcher({"AAA.MI": synthetic_payload(10.0)})
        umd.run(["AAA.MI"], self.data_dir, NOW, fetch, pause_s=0)
        for name in ("prices.json", "history.json"):
            mode = (self.data_dir / name).stat().st_mode & 0o777
            self.assertEqual(mode, 0o644, name)

    def test_corrupt_previous_file_is_ignored_not_fatal(self):
        (self.data_dir / "prices.json").write_text("{ this is not json")
        fetch = fake_fetcher({"AAA.MI": synthetic_payload(10.0)})
        self.assertEqual(umd.run(["AAA.MI"], self.data_dir, NOW, fetch, pause_s=0), 0)

    def test_only_if_missing_skips_when_data_exists(self):
        (self.data_dir / "prices.json").write_text("{}")
        code = umd.main(["--data-dir", str(self.data_dir), "--only-if-missing"])
        self.assertEqual(code, 0)
        self.assertEqual((self.data_dir / "prices.json").read_text(), "{}")

    def test_tickers_are_deduplicated(self):
        tickers_file = self.data_dir / "tickers.json"
        tickers_file.write_text(json.dumps([{"ticker": "XEON.MI"}, {"ticker": "XEON.MI"},
                                            {"ticker": "AAA.MI"}]))
        self.assertEqual(umd.load_tickers(tickers_file), ["AAA.MI", "XEON.MI"])


if __name__ == "__main__":
    unittest.main()
