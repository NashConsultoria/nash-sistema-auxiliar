from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class ChangeLogCreate(BaseModel):
    versao: str
    titulo: str
    descricao: str

class ChangeLogResponse(BaseModel):
    id: int
    versao: Optional[str] = None
    titulo: str
    descricao: str
    criadoEm: datetime

    model_config = ConfigDict(from_attributes=True)