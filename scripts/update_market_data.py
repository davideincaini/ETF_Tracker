#!/usr/bin/env python3
"""
update_market_data.py — download, validate and publish market data for the PWA.

WHY THIS SCRIPT EXISTS
----------------------
The PWA used to call Yahoo Finance directly from the browser. Browsers block
cross-site requests (CORS), so every price went through free public CORS proxies.
In October 2026 all five of them stopped working at the same time and the app
broke without a single line of our code changing.

This script removes that dependency. It runs on GitHub Actions (a server, so no
CORS), talks to Yahoo directly, checks every number, and writes two static JSON
files into `public/data/`. Vite copies `public/` into the build as-is, so the
files end up on GitHub Pages next to the app: the PWA reads them from its own
origin, with no proxy and no third party in the middle.

DESIGN PRINCIPLES (the "why" behind the choices below)
------------------------------------------------------
1. Standard library only. No `pip install`, so no third-party package that can
   break or be compromised. `urllib` + `json` are enough for two GET requests.
2. Never make things worse. If a ticker cannot be fetched or its data looks
   wrong, we KEEP the last good value and label it ("stale"/"rejected").
   A run can degrade the data, never destroy it.
3. Fail loudly. Any problem makes the script exit with a non-zero code, so the
   GitHub Actions run turns red and GitHub emails you. Silence is the enemy.
4. Plain, diff-friendly output. One history point per line means a daily update
   is a tiny git diff, and you can audit any price in the commit history.

USAGE
-----
    python3 scripts/update_market_data.py                 # normal run
    python3 scripts/update_market_data.py --only-if-missing   # only if a ticker has no data
    python3 scripts/update_market_data.py --accept-jumps      # after a split
"""

from __future__ import annotations  # lets us write `list[str]` on older Pythons

import argparse
import json
import math
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

# Paths are computed from this file's location, not from the current working
# directory, so the script works no matter where it is launched from.
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TICKERS_FILE = ROOT / "src" / "data" / "tickers.json"
DEFAULT_DATA_DIR = ROOT / "public" / "data"

# Yahoo's "chart" endpoint. It is unofficial (no SLA), which is exactly why the
# rest of the system is built to survive it failing.
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"

# Yahoo rejects requests that look like bots with no User-Agent at all.
# A generic browser UA is enough; we are not hiding, just being parseable.
USER_AGENT = "Mozilla/5.0 (compatible; ETF_Tracker-data-bot/1.0)"

# Every ETF in this portfolio is bought in euro. If Yahoo ever answers in another
# currency (e.g. GBp for a London listing), the price is off by a factor of ~100
# and the PAC would compute nonsense. Rejecting is the safe choice.
EXPECTED_CURRENCY = "EUR"

# Largest move we accept between two consecutive runs. Broad ETFs and gold do
# not move 25% in a day; when they "do", it is almost always a data glitch
# (wrong units, split not yet adjusted). The check is skipped when the previous
# price is too old to be a meaningful reference (see JUMP_REFERENCE_MAX_DAYS).
MAX_JUMP = 0.25
JUMP_REFERENCE_MAX_DAYS = 10

# Below this many daily points, history is "insufficient": still stored, but
# labelled, so charts and the Monte Carlo can tell the user rather than guess.
MIN_HISTORY_POINTS = 20

# Network behaviour: a few retries with growing pauses smooths out transient
# errors (timeouts, HTTP 429 "too many requests", 5xx) without hammering Yahoo.
HTTP_TIMEOUT_S = 20
RETRIES = 3
BACKOFF_S = 4
PAUSE_BETWEEN_TICKERS_S = 0.5

# Bump this if the JSON layout ever changes, so the app can refuse files it
# does not understand instead of misreading them.
SCHEMA_VERSION = 1

# Type of the function that performs a GET and returns parsed JSON. Tests pass
# a fake one, so the logic can be verified without touching the network.
Fetcher = Callable[[str, dict], dict]


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #

def utc_now() -> datetime:
    """Current time in UTC. Wrapped in a function so tests can reason about it."""
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    """ISO-8601 in UTC with a trailing 'Z' (what JavaScript's Date() parses)."""
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(text: Optional[str]) -> Optional[datetime]:
    """Inverse of iso(). Returns None for missing or malformed values."""
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_valid_price(value) -> bool:
    """A usable price is a real, finite, strictly positive number.

    `bool` is excluded explicitly because in Python True == 1 is a number.
    NaN and infinity can sneak in from upstream JSON, so we check for them.
    """
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value > 0
    )


def load_tickers(path: Path) -> list[str]:
    """Read the app's own ticker list, so there is ONE place to add an ETF.

    The same ticker can appear in several portfolios (e.g. XEON.MI), so we
    de-duplicate, and sort to keep the output files in a stable order.
    """
    entries = json.loads(path.read_text(encoding="utf-8"))
    return sorted({entry["ticker"] for entry in entries})


def load_previous(path: Path) -> dict:
    """Load last run's file, or {} if it is missing, corrupt or a newer schema.

    The previous data is our safety net: when a fetch fails, we fall back to it.
    A broken file must not crash the run, so every failure maps to "no data".
    """
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(data, dict) or data.get("schema") != SCHEMA_VERSION:
        return {}
    tickers = data.get("tickers")
    return tickers if isinstance(tickers, dict) else {}


# --------------------------------------------------------------------------- #
# Network
# --------------------------------------------------------------------------- #

class FetchError(Exception):
    """Raised when Yahoo cannot give us usable data for a request."""


def fetch_json(url: str, params: dict) -> dict:
    """GET `url?params` and return the decoded JSON, retrying transient errors.

    Retryable: timeouts, connection errors, HTTP 429 and 5xx — these usually
    go away by themselves. Not retryable: other 4xx (e.g. 404 for a delisted
    ticker), because asking again will give the same answer.
    """
    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(full_url, headers={"User-Agent": USER_AGENT})
    last_error: Optional[Exception] = None

    for attempt in range(1, RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_S) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            # Yahoo puts a useful message in the body even on errors; keep it.
            last_error = FetchError(f"HTTP {err.code}")
            if err.code != 429 and err.code < 500:
                break
        except (urllib.error.URLError, TimeoutError, ValueError) as err:
            # ValueError covers a body that is not valid JSON.
            last_error = FetchError(f"{type(err).__name__}: {err}")
        if attempt < RETRIES:
            time.sleep(BACKOFF_S * attempt)  # 4s, then 8s: linear backoff

    raise last_error or FetchError("unknown network error")


def extract_result(payload: dict) -> dict:
    """Pull `chart.result[0]` out of a Yahoo response, or explain why we can't."""
    chart = payload.get("chart") if isinstance(payload, dict) else None
    if not isinstance(chart, dict):
        raise FetchError("unexpected response shape (no 'chart')")
    if chart.get("error"):
        description = chart["error"].get("description", "unknown error")
        raise FetchError(f"Yahoo error: {description}")
    results = chart.get("result") or []
    if not results:
        raise FetchError("empty result")
    return results[0]


def fetch_quote(ticker: str, fetch: Fetcher = fetch_json) -> dict:
    """Latest price for one ticker, with its currency and market timestamp.

    We use `regularMarketTime` (when the price was set on the exchange) rather
    than "now", because a price fetched on Sunday is still Friday's price. The
    app uses that timestamp to warn you when prices are old.
    """
    result = extract_result(fetch(YAHOO_CHART_URL.format(ticker=ticker),
                                  {"range": "5d", "interval": "1d"}))
    meta = result.get("meta") or {}
    market_time = meta.get("regularMarketTime")
    return {
        "price": meta.get("regularMarketPrice"),
        "currency": meta.get("currency"),
        "market_time": iso(datetime.fromtimestamp(market_time, timezone.utc))
        if isinstance(market_time, (int, float)) else None,
    }


def fetch_history(ticker: str, now: datetime, fetch: Fetcher = fetch_json) -> list[list]:
    """Full DAILY closing-price history, as [["YYYY-MM-DD", close], ...].

    Why period1/period2 instead of range=max: with range=max Yahoo silently
    switches to MONTHLY points, while the Monte Carlo treats every point as a
    trading day (x252 per year). Explicit dates keep the granularity daily.
    """
    result = extract_result(fetch(
        YAHOO_CHART_URL.format(ticker=ticker),
        {"period1": 0, "period2": int(now.timestamp()), "interval": "1d"},
    ))
    timestamps = result.get("timestamp") or []
    quotes = ((result.get("indicators") or {}).get("quote") or [{}])[0]
    closes = quotes.get("close") or []

    # A dict keyed by date drops duplicates (Yahoo sometimes repeats today's
    # bar); later entries overwrite earlier ones, so we keep the freshest.
    by_date: dict[str, float] = {}
    for ts, close in zip(timestamps, closes):
        # Days with no trade come back as null: skip them rather than store 0,
        # which would look like a -100% crash on the charts.
        if not isinstance(ts, (int, float)) or not is_valid_price(close):
            continue
        day = datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")
        by_date[day] = round(float(close), 4)  # 4 decimals: plenty, and compact

    return [[day, by_date[day]] for day in sorted(by_date)]


# --------------------------------------------------------------------------- #
# Validation and merging (pure functions: no network, easy to test)
# --------------------------------------------------------------------------- #

def validate_quote(quote: dict, previous: Optional[dict], now: datetime,
                   accept_jumps: bool = False) -> Optional[str]:
    """Return None if the quote is trustworthy, otherwise a human-readable reason."""
    if not is_valid_price(quote.get("price")):
        return f"invalid price: {quote.get('price')!r}"
    if quote.get("currency") != EXPECTED_CURRENCY:
        return f"currency {quote.get('currency')!r}, expected {EXPECTED_CURRENCY}"

    market_time = parse_iso(quote.get("market_time"))
    if market_time is None:
        return "missing market time"
    # A timestamp in the future means a broken clock or broken data.
    if (market_time - now).total_seconds() > 24 * 3600:
        return f"market time in the future: {quote['market_time']}"

    # Jump check against the last price we trusted, but only if that price is
    # recent: comparing with a value from two months ago would flag genuine
    # market moves (e.g. after the workflow was paused) as errors.
    if accept_jumps or not previous or not is_valid_price(previous.get("price")):
        return None
    previous_time = parse_iso(previous.get("market_time"))
    if previous_time is None or (now - previous_time).days > JUMP_REFERENCE_MAX_DAYS:
        return None
    change = quote["price"] / previous["price"] - 1
    if abs(change) > MAX_JUMP:
        return (f"price moved {change:+.0%} since last run "
                f"({previous['price']} -> {quote['price']}); "
                "if this is a split, re-run with accept_jumps")
    return None


def merge_price(ticker: str, previous: Optional[dict], quote: Optional[dict],
                error: Optional[str], now: datetime, accept_jumps: bool) -> dict:
    """Decide what to publish for one ticker's price.

    status:
      ok       -> fresh, validated value
      stale    -> fetch failed, last good value kept
      rejected -> fetched but failed validation, last good value kept
      missing  -> nothing usable and no previous value (the app will ask you)
    """
    if quote is not None and error is None:
        reason = validate_quote(quote, previous, now, accept_jumps)
        if reason is None:
            return {**quote, "fetched_at": iso(now), "status": "ok"}
        status, error = "rejected", reason
    else:
        status = "stale"

    if previous and is_valid_price(previous.get("price")):
        # Keep the old numbers AND the old timestamps: the app must see how
        # old the value really is, not the time of this failed run.
        kept = {key: previous.get(key) for key in ("price", "currency", "market_time", "fetched_at")}
        return {**kept, "status": status, "error": error}

    return {"price": None, "currency": None, "market_time": None,
            "fetched_at": None, "status": "missing", "error": error}


def merge_history(previous_points: Optional[list], new_points: Optional[list],
                  error: Optional[str]) -> tuple[list, str, Optional[str]]:
    """Decide what history to publish for one ticker.

    Returns (points, status, error). status:
      ok           -> fresh history with enough points
      insufficient -> fresh, but Yahoo has fewer than MIN_HISTORY_POINTS
                      (true today for SGLN.MI, which has no history on Yahoo)
      stale        -> fetch failed, previous history kept
      missing      -> nothing at all
    """
    if new_points is not None and error is None:
        if len(new_points) >= MIN_HISTORY_POINTS:
            return new_points, "ok", None
        # A short fresh series is not "better" than a long old one: if we had
        # real history before, keep it and flag the anomaly.
        if previous_points and len(previous_points) > len(new_points):
            return previous_points, "stale", f"Yahoo returned only {len(new_points)} points"
        return new_points, "insufficient", None
    if previous_points:
        return previous_points, "stale", error
    return [], "missing", error


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #

def write_atomic(path: Path, text: str) -> None:
    """Write via a temp file + rename, so a crash never leaves half a file.

    os.replace() is atomic on the same filesystem: readers see either the old
    file or the new one, never a truncated mix.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        # mkstemp creates files readable by the owner only (0600), a safe
        # default for secrets. These files are public website content: a
        # web server or the Pages uploader may refuse unreadable files, so we
        # set the normal "everyone can read" mode (0644).
        os.chmod(tmp_name, 0o644)
        os.replace(tmp_name, path)
    except BaseException:
        os.unlink(tmp_name)
        raise


def render_prices(generated_at: str, tickers: dict) -> str:
    """prices.json: small, so standard pretty-printing is fine."""
    document = {
        "schema": SCHEMA_VERSION,
        "generated_at": generated_at,
        "source": "Yahoo Finance chart API (via GitHub Actions)",
        "tickers": tickers,
    }
    return json.dumps(document, indent=2, ensure_ascii=False) + "\n"


def render_history(generated_at: str, tickers: dict) -> str:
    """history.json with ONE data point per line.

    json.dumps(indent=2) would put every number on its own line (3 lines per
    point); minified JSON would be one giant line. Both make git diffs useless.
    With one point per line, a daily update shows as one added line per ETF.
    """
    lines = ["{", f'  "schema": {SCHEMA_VERSION},',
             f'  "generated_at": {json.dumps(generated_at)},', '  "tickers": {']
    names = sorted(tickers)
    for t_index, name in enumerate(names):
        entry = tickers[name]
        lines.append(f"    {json.dumps(name)}: {{")
        lines.append(f'      "status": {json.dumps(entry["status"])},')
        lines.append(f'      "error": {json.dumps(entry.get("error"))},')
        points = entry["points"]
        if not points:
            lines.append('      "points": []')
        else:
            lines.append('      "points": [')
            for p_index, point in enumerate(points):
                comma = "," if p_index < len(points) - 1 else ""
                lines.append(f"        {json.dumps(point)}{comma}")
            lines.append("      ]")
        lines.append("    }" + ("," if t_index < len(names) - 1 else ""))
    lines += ["  }", "}"]
    return "\n".join(lines) + "\n"


def write_step_summary(rows: list[tuple]) -> None:
    """Show a results table on the GitHub Actions run page.

    GitHub sets GITHUB_STEP_SUMMARY to a file path; markdown written there is
    rendered in the UI. Outside Actions the variable is absent and we skip.
    """
    target = os.environ.get("GITHUB_STEP_SUMMARY")
    if not target:
        return
    out = ["| Ticker | Price | Price status | History | Note |", "|---|---|---|---|---|"]
    for ticker, price, status, history, note in rows:
        out.append(f"| {ticker} | {price} | {status} | {history} | {note} |")
    with open(target, "a", encoding="utf-8") as handle:
        handle.write("### Market data update\n\n" + "\n".join(out) + "\n")


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #

def run(tickers: list[str], data_dir: Path, now: datetime, fetch: Fetcher,
        accept_jumps: bool = False, pause_s: float = PAUSE_BETWEEN_TICKERS_S) -> int:
    """Fetch everything, merge with previous data, write files. Returns exit code.

    Exit code 0 = everything fresh. 1 = something degraded (the files are still
    written, with the last good values kept and labelled).
    """
    prices_path = data_dir / "prices.json"
    history_path = data_dir / "history.json"
    previous_prices = load_previous(prices_path)
    previous_history = load_previous(history_path)

    new_prices: dict = {}
    new_history: dict = {}
    summary_rows: list[tuple] = []
    degraded = False

    for index, ticker in enumerate(tickers):
        if index:
            time.sleep(pause_s)  # be polite: a short gap between tickers

        # Each request is wrapped separately: a failed history must not throw
        # away a good price, and vice versa.
        quote, quote_error = None, None
        try:
            quote = fetch_quote(ticker, fetch)
        except FetchError as err:
            quote_error = str(err)

        points, history_error = None, None
        try:
            points = fetch_history(ticker, now, fetch)
        except FetchError as err:
            history_error = str(err)

        price_entry = merge_price(ticker, previous_prices.get(ticker), quote,
                                  quote_error, now, accept_jumps)
        prev_points = (previous_history.get(ticker) or {}).get("points")
        kept_points, history_status, history_note = merge_history(prev_points, points, history_error)

        new_prices[ticker] = price_entry
        new_history[ticker] = {"status": history_status, "error": history_note,
                               "points": kept_points}

        # "insufficient" is a known, permanent property of the source (SGLN.MI),
        # not a failure of this run, so it does not turn the run red.
        if price_entry["status"] != "ok" or history_status in ("stale", "missing"):
            degraded = True

        note = price_entry.get("error") or history_note or ""
        summary_rows.append((ticker, price_entry.get("price"), price_entry["status"],
                             f"{history_status} ({len(kept_points)} pts)", note))

    generated_at = iso(now)
    write_atomic(prices_path, render_prices(generated_at, new_prices))
    write_atomic(history_path, render_history(generated_at, new_history))

    # Plain-text table for the Actions log (and for you, when run locally).
    for row in summary_rows:
        print(f"{row[0]:<10} price={row[1]!s:<10} {row[2]:<9} history={row[3]:<22} {row[4]}")
    write_step_summary(summary_rows)
    return 1 if degraded else 0


def main(argv: Optional[list[str]] = None, fetch: Fetcher = fetch_json) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--tickers-file", type=Path, default=DEFAULT_TICKERS_FILE)
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--accept-jumps", action="store_true",
                        help="skip the large-move check (use once after a split)")
    parser.add_argument("--only-if-missing", action="store_true",
                        help="fetch only if some configured ticker has no data yet")
    args = parser.parse_args(argv)

    tickers = load_tickers(args.tickers_file)

    # Used on every code push. Without new tickers there is nothing to do (the
    # daily schedule keeps prices fresh). But if you add an ETF to tickers.json,
    # its data is fetched right away instead of at the next scheduled run, so
    # the app never shows a freshly added ETF without a price for hours.
    if args.only_if_missing:
        known = load_previous(args.data_dir / "prices.json")
        missing = [t for t in tickers if t not in known]
        if not missing:
            print("Every configured ticker already has data: nothing to bootstrap.")
            return 0
        print(f"No data yet for: {', '.join(missing)} -> running a full update.")

    print(f"Updating {len(tickers)} tickers: {', '.join(tickers)}")
    return run(tickers, args.data_dir, utc_now(), fetch, args.accept_jumps)


if __name__ == "__main__":
    sys.exit(main())
