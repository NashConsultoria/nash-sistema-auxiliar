from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class FornecedorCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=255)
    # Permite None/nulo, já que no SQL o campo aceita NULL
    cpfCnpj: Optional[str] = Field(None, max_length=50)

class FornecedorUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    cpfCnpj: Optional[str] = Field(None, max_length=50)
    status: Optional[int] = Field(None, description="1 para Ativo, 2 para Inativo")

class FornecedorResponse(BaseModel):
    id: int
    nome: str
    cpfCnpj: Optional[str] = None
    status: int

    model_config = ConfigDict(from_attributes=True)