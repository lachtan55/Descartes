from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from backend.services.ib.connection_manager import IBConnectionManager, GATEWAY_PAPER_PORT

router = APIRouter(tags=["ib-connection"])


class ConnectRequest(BaseModel):
    host: str = "127.0.0.1"
    port: int = GATEWAY_PAPER_PORT  # IB Gateway paper trading — change to GATEWAY_LIVE_PORT for live
    client_id: int = 1


@router.post("/api/ib/connect")
async def connect(request: Request, body: ConnectRequest):
    manager: IBConnectionManager = request.app.state.connection_manager
    try:
        await manager.connect(body.host, body.port, body.client_id)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"connected": True, "host": body.host, "port": body.port, "client_id": body.client_id}


@router.post("/api/ib/disconnect")
async def disconnect(request: Request):
    manager: IBConnectionManager = request.app.state.connection_manager
    await manager.disconnect()
    return {"connected": False}


@router.get("/api/ib/status")
async def status(request: Request):
    manager: IBConnectionManager = request.app.state.connection_manager
    connected = manager.is_connected()
    return {
        "connected": connected,
        "host": manager.host if connected else None,
        "port": manager.port if connected else None,
    }
