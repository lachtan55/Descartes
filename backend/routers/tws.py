from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/tws", tags=["tws"])


@router.post("/pull")
def tws_pull():
    return JSONResponse(
        status_code=501,
        content={
            "status": "not_implemented",
            "message": "TWS integration pending. Implement using ib_insync library. See backend/services/tws_service.py for instructions.",
        }
    )
