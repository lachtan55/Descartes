import nest_asyncio
nest_asyncio.apply()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import CORS_ORIGINS
from backend.routers import price_data, ai_parse, tws, ib_data, ws, ib_connection, db, db_tagging, macro
from backend.routers import options_flow as options_flow_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.services.ib.connection_manager import IBConnectionManager
    from backend.services.ib.stream_manager import StreamManager
    app.state.connection_manager = IBConnectionManager()
    app.state.stream_manager = StreamManager(app.state.connection_manager)
    yield
    await app.state.connection_manager.disconnect()


app = FastAPI(title="Signal Analyzer API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(price_data.router)
app.include_router(ai_parse.router)
app.include_router(tws.router)
app.include_router(ib_data.router)
app.include_router(ws.router)
app.include_router(ib_connection.router)
app.include_router(db.router)
app.include_router(db_tagging.router)
app.include_router(macro.router)
app.include_router(options_flow_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
