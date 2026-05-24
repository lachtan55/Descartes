from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.ib.stream_manager import StreamManager

router = APIRouter()


@router.websocket("/ws/bars/{symbol}")
async def stream_bars(
    websocket: WebSocket,
    symbol: str,
    sec_type: str = "CONTFUT",
    exchange: str = "SMART",
    currency: str = "USD",
):
    await websocket.accept()
    stream_manager: StreamManager = websocket.app.state.stream_manager
    try:
        async for bar in stream_manager.subscribe(symbol, sec_type, exchange, currency):
            await websocket.send_json(bar)
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close()
