import pandas as pd
import re
import unicodedata
from app.config import ORDEM_EFOLHA

def normalizar_texto(texto) -> str:
    """
    Normaliza strings removendo acentos, caracteres especiais, 
    espaços extras e convertendo para maiúsculas.
    """
    if pd.isna(texto) or texto is None:
        return ""
    
    texto_str = str(texto).strip()
    
    if texto_str.lower() in ["nan", "none", "", "null"]:
        return ""
    
    # 1. Normalização Unicode (Decompõe caracteres acentuados)
    nfkd = unicodedata.normalize('NFD', texto_str)
    # Remove marcas de combinação de acentos (Mn = Mark, Nonspacing)
    texto_sem_acento = "".join(c for c in nfkd if unicodedata.category(c) != 'Mn')
    
    # 2. Mapeamento manual de segurança para garantia extra (fallback)
    tabela_substituicao = str.maketrans(
        "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç",
        "AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc"
    )
    texto_limpo = texto_sem_acento.translate(tabela_substituicao)
    
    # 3. Remove caracteres invisíveis/especiais e padroniza para maiúsculo
    texto_limpo = re.sub(r'[^\w\s]', '', texto_limpo) # Mantém apenas letras, números e espaços
    
    return texto_limpo.strip().upper()

def obter_ordem_efolha(nome_efolha: str) -> int:
    """
    Retorna o número de ordenação do grupo E-FOLHA.
    Caso a categoria não esteja mapeada explicitamente,
    retorna 99 para ser posicionada ao final.
    """
    if not nome_efolha:
        return 99

    nome_limpo = str(nome_efolha).strip().upper()

    for chave, ordem in ORDEM_EFOLHA.items():
        if chave in nome_limpo:
            return ordem

    return 99