from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (auth, contratantes, dados, exportacao, importacao, logs, lotes, relatorios, usuarios)
from app.security import criar_admin_padrao_se_necessario

app = FastAPI(title="NASH Valuation API")

# Middlewares - Suporta requisições tanto de localhost quanto de 127.0.0.1
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup
@app.on_event("startup")
def startup_db():
    criar_admin_padrao_se_necessario()

# Inclusão dos Roteadores
app.include_router(auth.router)
app.include_router(contratantes.router)
app.include_router(dados.router, prefix="/api")
app.include_router(exportacao.router)
app.include_router(importacao.router)
app.include_router(logs.router)
app.include_router(lotes.router)
app.include_router(relatorios.router, prefix="/api")
app.include_router(usuarios.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True, log_level="info")