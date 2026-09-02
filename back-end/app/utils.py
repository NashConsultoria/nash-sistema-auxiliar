import pandas as pd
import re
import unicodedata
from typing import Optional

from app.config import ORDEM_EFOLHA, TipoLoteSistema, TIPOS_LOTE_SISTEMA

def normalizar_texto(texto) -> str:
    if pd.isna(texto) or texto is None:
        return ""
    
    texto_str = str(texto).strip()
    if texto_str.lower() in ["nan", "none", "", "null"]:
        return ""
    
    # 1. Substitui espaços inquebráveis por espaço normal
    texto_str = texto_str.replace('\xa0', ' ')

    # 2. Normalização Unicode
    nfkd = unicodedata.normalize('NFD', texto_str)
    texto_sem_acento = "".join(c for c in nfkd if unicodedata.category(c) != 'Mn')
    
    # 3. Fallback de segurança para acentos residuais
    tabela_substituicao = str.maketrans(
        "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç",
        "AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc"
    )
    texto_limpo = texto_sem_acento.translate(tabela_substituicao)
    
    # 4. Mantém letras, números, hífen, espaço, ponto e barra (Permite pontos de processos/CNPJ)
    texto_limpo = re.sub(r'[^\w\s\-\./&]', '', texto_limpo)
    
    # 5. Reduz múltiplos espaços para um único
    texto_limpo = re.sub(r'\s+', ' ', texto_limpo)
    
    return texto_limpo.strip().upper()

def corrigir_encoding(texto: str) -> str:
    """Corrige caracteres corrompidos por encoding apenas se detectada falha."""
    if not texto:
        return ""
    
    # Só tenta corrigir se contiver sequências típicas de UTF-8 lido como Latin-1
    padroes_mojibake = ["Ã", "Â", "Ç", "§", "©"]
    if any(padrao in texto for padrao in padroes_mojibake):
        try:
            return texto.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return texto
            
    return texto

def limpar_e_normalizar(val, apenas_limpar=True):
    if pd.isna(val) or val is None:
        return None
    
    val_str = str(val).strip()
    
    # 1. Trata os sufixos decimais do Excel (.0)
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
        
    # 2. Avalia se o texto é uma representação de valor nulo
    if val_str.lower() in ["nan", "none", "", "null"]:
        return None
        
    # 3. Corrige acentuação quebrada se houver
    val_str = corrigir_encoding(val_str)
    
    # Se quiser apenas sanitizar mantendo o texto original (ex: para gravar no Banco)
    if apenas_limpar:
        return val_str
        
    # Se quiser normalizar completamente (remover acentos e colocar em caixa alta)
    return normalizar_texto(val_str)
    
def obter_ordem_efolha(nome_efolha: str) -> int:
    """
    Retorna o número de ordenação do grupo E-FOLHA.
    Caso a categoria não esteja mapeada explicitamente,
    retorna 99 para ser posicionada ao final.
    """
    if not nome_efolha:
        return 99

    # Normaliza removendo acentos e convertendo para maiúsculo
    nome_limpo = normalizar_texto(str(nome_efolha))

    for chave, ordem in ORDEM_EFOLHA.items():
        if normalizar_texto(chave) in nome_limpo:
            return ordem

    return 99

def identificar_tipo_lote(nome_arquivo: str) -> Optional[TipoLoteSistema]:
    """Retorna o TipoLoteSistema cujo padrão bate com o nome do arquivo,
    ou None se não corresponder a nenhum tipo de sistema conhecido
    (nesse caso é PLANO DE CONTAS ou um lote normal de contratante)."""
    nome = (nome_arquivo or "").lower()
    for tipo in TIPOS_LOTE_SISTEMA:
        if any(padrao in nome for padrao in tipo.padroes):
            return tipo
    return None