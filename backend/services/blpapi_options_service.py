"""
Bloomberg Desktop API (DAPI) — options chain lookup and real-time flow subscription.

Connects to the Bloomberg Terminal via DAPI at localhost:8194.
Services opened on demand per call:
  //blp/refdata  — reference data (OPT_CHAIN field lookup)
  //blp/mktdata  — real-time market data subscriptions (tick flow)

Bridge status: Phase 5 — requires Bloomberg Terminal running locally with a
DAPI connection configured (Bloomberg Terminal → Settings → API → Enable DAPI).

Usage:
  from backend.services.blpapi_options_service import options_flow_service

  chain   = options_flow_service.get_options_chain("AAPL US Equity")
  ticks   = options_flow_service.subscribe_options_flow(chain[:10], duration_seconds=30)
"""

from __future__ import annotations

import time

# ── blpapi import guard ────────────────────────────────────────────────────────
# blpapi is a C extension tied to the Bloomberg Terminal install.
# It is absent in CI and on machines without Bloomberg.

try:
    import blpapi  # type: ignore
    _HAS_BLPAPI = True
except ImportError:
    blpapi = None  # type: ignore[assignment]
    _HAS_BLPAPI = False

# ── Constants ──────────────────────────────────────────────────────────────────

_DAPI_HOST = "localhost"
_DAPI_PORT = 8194

_REFDATA_SVC = "//blp/refdata"
_MKTDATA_SVC = "//blp/mktdata"

# Fields collected on every subscription tick.
# RT_AGGRESSIVE_SIDE is frequently absent; it is silently omitted per spec.
_SUBSCRIPTION_FIELDS: list[str] = [
    "LAST_PRICE",
    "LAST_SIZE",
    "BID",
    "ASK",
    "BID_SIZE",
    "ASK_SIZE",
    "VOLUME",
    "OPEN_INT",
    "RT_AGGRESSIVE_SIDE",
    "EXCH_CODE",
    "DELTA",
    "IVOL_MID",
    "OPT_STRIKE_PX",
    "OPT_PUT_CALL",
]

# Timeout for a single nextEvent() poll in reference-data requests (ms).
_REFDATA_POLL_TIMEOUT_MS = 5_000


# ── Service ────────────────────────────────────────────────────────────────────

class OptionsFlowService:
    """
    Bloomberg DAPI wrapper for options chain lookup and real-time flow collection.

    Each public method creates and tears down its own DAPI session so that
    chain lookups and subscriptions remain independent with no shared state.
    """

    def __init__(self, host: str = _DAPI_HOST, port: int = _DAPI_PORT) -> None:
        self._host = host
        self._port = port

    # ── Session lifecycle helpers ─────────────────────────────────────────────

    def _start_session(self, service_names: list[str]) -> object:
        """
        Create and start a DAPI session, opening the requested Bloomberg services.

        Returns the connected ``blpapi.Session``.

        Raises
        ------
        RuntimeError
            If blpapi is not installed, or the Terminal is unreachable, or a
            service fails to open.
        """
        if not _HAS_BLPAPI:
            raise RuntimeError(
                "blpapi Python package is not installed. "
                "Run:  pip install blpapi>=3.23.0\n"
                "The Bloomberg Terminal must also be running locally."
            )

        opts = blpapi.SessionOptions()
        opts.setServerHost(self._host)
        opts.setServerPort(self._port)

        session = blpapi.Session(opts)

        if not session.start():
            raise RuntimeError(
                f"Could not connect to Bloomberg Terminal at "
                f"{self._host}:{self._port}. "
                "Ensure the Bloomberg Terminal is running and DAPI is enabled "
                "(Terminal → Settings → API)."
            )

        for svc_name in service_names:
            if not session.openService(svc_name):
                session.stop()
                raise RuntimeError(
                    f"Bloomberg service '{svc_name}' failed to open. "
                    "Verify your Bloomberg subscription entitlements."
                )

        return session

    @staticmethod
    def _stop_session(session: object) -> None:
        """Stop a blpapi session, silently ignoring teardown errors."""
        try:
            session.stop()  # type: ignore[union-attr]
        except Exception:
            pass

    # ── Chain lookup ──────────────────────────────────────────────────────────

    def get_options_chain(
        self,
        underlying: str,
        expiry_yyyymmdd: str | None = None,
        put_call: str | None = None,
    ) -> list[str]:
        """
        Return the list of Bloomberg option ticker strings for *underlying*.

        Works for equities (``"AAPL US Equity"``) and commodities
        (``"GC1 Comdty"``).

        Parameters
        ----------
        underlying
            Bloomberg security identifier string.
        expiry_yyyymmdd
            Restrict chain to a single expiry; passed as the CHAIN_DATE override
            in YYYYMMDD format (e.g. ``"20250620"``).
        put_call
            ``"C"`` — calls only.  ``"P"`` — puts only.  ``None`` — all.
            Passed as the CHAIN_PUT_CALL override.

        Returns
        -------
        list[str]
            Bloomberg ticker strings for each option in the chain, e.g.
            ``["AAPL US 01/17/25 C225 Equity", ...]``.

        Raises
        ------
        RuntimeError
            If blpapi is not installed, Terminal is unreachable, or the request
            times out.
        """
        session = self._start_session([_REFDATA_SVC])
        try:
            service = session.getService(_REFDATA_SVC)  # type: ignore[union-attr]
            request = service.createRequest("ReferenceDataRequest")

            request.getElement("securities").appendValue(underlying)
            request.getElement("fields").appendValue("OPT_CHAIN")

            # ── Optional overrides ────────────────────────────────────────────
            if expiry_yyyymmdd or put_call:
                overrides = request.getElement("overrides")

                if expiry_yyyymmdd:
                    ov = overrides.appendElement()
                    ov.setElement("fieldId", "CHAIN_DATE")
                    ov.setElement("value", expiry_yyyymmdd)

                if put_call:
                    ov = overrides.appendElement()
                    ov.setElement("fieldId", "CHAIN_PUT_CALL")
                    ov.setElement("value", put_call.upper())

            session.sendRequest(request)  # type: ignore[union-attr]

            tickers: list[str] = []

            # ── Response loop ─────────────────────────────────────────────────
            while True:
                event = session.nextEvent(_REFDATA_POLL_TIMEOUT_MS)  # type: ignore[union-attr]
                event_type = event.eventType()

                if event_type == blpapi.Event.TIMEOUT:
                    raise RuntimeError(
                        f"Bloomberg timed out waiting for OPT_CHAIN response "
                        f"(underlying={underlying!r}, timeout={_REFDATA_POLL_TIMEOUT_MS}ms)."
                    )

                # Skip session/service infrastructure events
                if event_type in (
                    blpapi.Event.SESSION_STATUS,
                    blpapi.Event.SERVICE_STATUS,
                ):
                    continue

                if event_type in (
                    blpapi.Event.PARTIAL_RESPONSE,
                    blpapi.Event.RESPONSE,
                ):
                    for msg in event:
                        security_data_arr = msg.getElement("securityData")
                        for i in range(security_data_arr.numValues()):
                            security_data = security_data_arr.getValue(i)
                            field_data = security_data.getElement("fieldData")

                            if not field_data.hasElement("OPT_CHAIN"):
                                continue

                            chain_arr = field_data.getElement("OPT_CHAIN")
                            for j in range(chain_arr.numValues()):
                                entry = chain_arr.getValue(j)
                                # OPT_CHAIN bulk array: each element contains
                                # "Security Description" with the ticker string.
                                if entry.hasElement("Security Description"):
                                    ticker_str = entry.getElementAsString(
                                        "Security Description"
                                    )
                                    tickers.append(ticker_str)

                if event_type == blpapi.Event.RESPONSE:
                    break  # terminal event — no more data

        finally:
            self._stop_session(session)

        return tickers

    # ── Real-time subscription ─────────────────────────────────────────────────

    def subscribe_options_flow(
        self,
        tickers: list[str],
        duration_seconds: int = 30,
    ) -> list[dict]:
        """
        Subscribe to real-time options ticks and collect them for *duration_seconds*.

        Fields per tick: LAST_PRICE, LAST_SIZE, BID, ASK, BID_SIZE, ASK_SIZE,
        VOLUME, OPEN_INT, RT_AGGRESSIVE_SIDE, EXCH_CODE, DELTA, IVOL_MID,
        OPT_STRIKE_PX, OPT_PUT_CALL.

        RT_AGGRESSIVE_SIDE (and any field Bloomberg does not publish for a
        particular tick) is **silently omitted** from that tick's dict rather
        than included as ``None``.

        Each tick dict also contains a ``"ticker"`` key with the Bloomberg
        security string that generated the update.

        Parameters
        ----------
        tickers
            Bloomberg security strings to subscribe to, e.g.
            ``["AAPL US 01/17/25 C225 Equity", ...]``.
        duration_seconds
            How long to collect ticks before unsubscribing (default: 30 s).

        Returns
        -------
        list[dict]
            All collected tick dicts, in arrival order.

        Raises
        ------
        RuntimeError
            If blpapi is not installed or the Terminal is unreachable.
        """
        session = self._start_session([_MKTDATA_SVC])

        # Map integer correlation-ID → ticker string for tick annotation.
        ticker_map: dict[int, str] = {}
        subscriptions = blpapi.SubscriptionList()

        for idx, ticker in enumerate(tickers):
            ticker_map[idx] = ticker
            subscriptions.add(
                ticker,
                fields=_SUBSCRIPTION_FIELDS,
                correlationId=blpapi.CorrelationId(idx),
            )

        ticks: list[dict] = []

        try:
            session.subscribe(subscriptions)  # type: ignore[union-attr]
            deadline = time.monotonic() + duration_seconds

            while time.monotonic() < deadline:
                remaining_ms = max(100, int((deadline - time.monotonic()) * 1_000))
                event = session.nextEvent(remaining_ms)  # type: ignore[union-attr]
                event_type = event.eventType()

                # ── Subscription data ─────────────────────────────────────────
                if event_type == blpapi.Event.SUBSCRIPTION_DATA:
                    for msg in event:
                        tick: dict = {}

                        # Annotate tick with originating ticker.
                        cor_ids = msg.correlationIds()
                        if cor_ids:
                            tick["ticker"] = ticker_map.get(
                                cor_ids[0].value(), "unknown"
                            )

                        # Collect only fields that Bloomberg published in this
                        # particular tick.  RT_AGGRESSIVE_SIDE (and others) are
                        # omitted silently when absent.
                        for field in _SUBSCRIPTION_FIELDS:
                            try:
                                element = msg.getElement(field)
                            except Exception:
                                # Field not present in this tick — omit silently.
                                continue

                            # Coerce to a JSON-serialisable Python type.
                            # Try float first (covers LAST_PRICE, BID, DELTA …),
                            # then string (EXCH_CODE, OPT_PUT_CALL, RT_AGGRESSIVE_SIDE …).
                            try:
                                tick[field] = element.getValueAsFloat()
                            except Exception:
                                try:
                                    tick[field] = element.getValueAsString()
                                except Exception:
                                    pass  # skip elements that cannot be serialised

                        if tick:
                            ticks.append(tick)

                # ── Subscription status (failures / reconnects) ───────────────
                elif event_type == blpapi.Event.SUBSCRIPTION_STATUS:
                    for msg in event:
                        msg_type = str(msg.messageType())
                        if "Failure" in msg_type or "Terminated" in msg_type:
                            # Surface as a sentinel tick so callers can inspect.
                            ticks.append({
                                "error": msg_type,
                                "description": str(msg),
                            })

                # TIMEOUT and other events: loop continues; deadline handles exit.

        except Exception:
            raise
        finally:
            # Unsubscribe and stop cleanly — runs on normal exit AND on exception.
            try:
                session.unsubscribe(subscriptions)  # type: ignore[union-attr]
            except Exception:
                pass
            self._stop_session(session)

        return ticks


# ── Module-level singleton ─────────────────────────────────────────────────────

options_flow_service = OptionsFlowService()


# ── __main__ smoke test ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json
    import sys

    if not _HAS_BLPAPI:
        print(
            "blpapi is not installed — cannot run Bloomberg connectivity test.\n"
            "Install with:  pip install blpapi>=3.23.0\n"
            "The Bloomberg Terminal must also be running locally."
        )
        sys.exit(0)

    TEST_UNDERLYINGS = [
        "GC1 Comdty",      # Gold front-month futures
        "CL1 Comdty",      # Crude oil front-month futures
        "AAPL US Equity",  # Apple equity
    ]
    DURATION = 60  # seconds

    svc = OptionsFlowService()
    all_option_tickers: list[str] = []

    # ── Step 1: chain lookup for each underlying ──────────────────────────────
    for underlying in TEST_UNDERLYINGS:
        print(f"\n── OPT_CHAIN: {underlying} ──────────────────────────────────")
        try:
            chain = svc.get_options_chain(underlying)
            print(f"  {len(chain)} option(s) returned")
            for t in chain[:5]:
                print(f"    {t}")
            if len(chain) > 5:
                print(f"    … and {len(chain) - 5} more")
            # Take up to 3 options from each underlying for the subscription test.
            all_option_tickers.extend(chain[:3])
        except RuntimeError as exc:
            print(f"  ERROR: {exc}")

    # ── Step 2: real-time subscription for DURATION seconds ───────────────────
    if not all_option_tickers:
        print("\nNo option tickers found — skipping subscription test.")
        sys.exit(0)

    print(
        f"\n── Subscribing to {len(all_option_tickers)} option(s) "
        f"for {DURATION}s ─────────────────"
    )
    for t in all_option_tickers:
        print(f"  {t}")

    try:
        collected = svc.subscribe_options_flow(
            all_option_tickers, duration_seconds=DURATION
        )
        print(f"\n  Collected {len(collected)} tick(s) total.")
        if collected:
            print("  First tick:")
            print(json.dumps(collected[0], indent=4))
    except RuntimeError as exc:
        print(f"  ERROR during subscription: {exc}")
