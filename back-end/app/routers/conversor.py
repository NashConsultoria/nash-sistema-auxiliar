import io
import re
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
import pandas as pd
from openpyxl.styles import Alignment, Font, PatternFill

from app.config import BANCO_AUTENTICACAO, REGRAS_FORNECEDORES, PALAVRAS_REMOVIDAS
from app.database import obter_conexao
from app.utils import corrigir_encoding

router = APIRouter(prefix="/NashBancoConsultoria/conversor", tags=["Conversor de Extratos"])

# ==============================================================================
# ENRIQUECIMENTO E APLICAÇÃO DE REGRAS
# ==============================================================================

def gerar_fornecedor_com_filtro(descricao_texto: str) -> str:
    if not descricao_texto:
        return ""

    texto_limpo = descricao_texto

    # 1. Remove Datas nos formatos DD/MM ou DD/MM/AAAA (ex: 03/06, 16/06/2026)
    texto_limpo = re.sub(r"\b\d{2}/\d{2}(?:/\d{2,4})?\b", "", texto_limpo)

    # 2. Remove Horários nos formatos HH:MM ou HH:MM:SS (ex: 13:03, 16:17:30)
    texto_limpo = re.sub(r"\b\d{2}:\d{2}(?::\d{2})?\b", "", texto_limpo)

    # 3. Remove palavras banidas da lista PALAVRAS_REMOVIDAS
    if PALAVRAS_REMOVIDAS:
        palavras_escapadas = [re.escape(palavra) for palavra in PALAVRAS_REMOVIDAS]
        pattern = re.compile(
            r"\b(" + "|".join(palavras_escapadas) + r")\b", flags=re.IGNORECASE
        )
        texto_limpo = pattern.sub("", texto_limpo)

    # 4. Trata hífens sobrantes e espaços duplicados
    texto_limpo = re.sub(r"\s*-\s*-\s*", " - ", texto_limpo)
    texto_limpo = re.sub(r"^\s*-\s*", "", texto_limpo)
    texto_limpo = re.sub(r"\s*-\s*$", "", texto_limpo)
    
    return re.sub(r"\s+", " ", texto_limpo).strip()

def identificar_fornecedor(descricao: str, banco_val: str) -> str:
    desc_lower = descricao.lower()
    
    for termo, fornecedor in REGRAS_FORNECEDORES:
        if termo.lower() in desc_lower:
            # Lista ou verificação de marcas que indicam que o fornecedor deve ser o próprio banco
            fornecedor_upper = str(fornecedor).strip().upper()
            if fornecedor_upper in ["BANCO", "(NOME DO BANCO)", "[NOME DO BANCO]"]:
                return banco_val
            return fornecedor

    return gerar_fornecedor_com_filtro(descricao)

def aplicar_plano_conta(linhas_extrato: list, banco: str, contratante_id: Optional[int] = None) -> list:
    """
    Busca o nome do contratante e aplica as regras de DE/PARA cadastradas,
    preenchendo: contratante, planoConta, grupoConta e edre.
    """
    nome_contratante = ""
    regras = []

    if contratante_id:
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        # 1. Busca o nome do contratante
        try:
            cursor.execute("SELECT nome FROM dbo.Contratante WHERE id = ?", [contratante_id])
            row_contratante = cursor.fetchone()
            if row_contratante:
                nome_contratante = row_contratante[0]
        except Exception as e:
            print(f"Aviso: Erro ao buscar nome do contratante: {e}")

        # 2. Busca as regras ativas incluindo o termoTipo
        query_regras = """
            SELECT 
                p.termoDescricao,
                p.termoFornecedor,
                p.termoTipo,
                pc.planoConta,
                pc.grupoConta,
                pc.edre
            FROM dbo.PlanoDePara p
            INNER JOIN dbo.PlanoContas pc ON p.planoContaId = pc.id
            WHERE p.contratanteId IS NULL OR p.contratanteId = ?
        """
        cursor.execute(query_regras, [contratante_id])
        regras = cursor.fetchall()
        conexao.close()

    # 3. Preenche as linhas com o contratante e as categorias mapeadas
    for linha in linhas_extrato:
        linha["contratante"] = nome_contratante

        desc = (linha.get("descricao") or "").upper().strip()
        forn = (
            linha.get("fornecedor")
            or linha.get("fornecedores")
            or ""
        ).upper().strip()
        
        tipo_linha = (linha.get("tipo") or "").upper().strip() # Pega o tipo da transação (PAGAMENTO / RECEBIMENTO)

        for t_desc, t_forn, t_tipo, p_conta, g_conta, edre in regras:
            match_desc = True if not t_desc else (t_desc.upper() in desc)
            match_forn = True if not t_forn else (t_forn.upper() in forn)
            
            # Valida o tipo se ele estiver preenchido na regra
            match_tipo = True if not t_tipo else (t_tipo.upper() == tipo_linha)

            if match_desc and match_forn and match_tipo:
                linha["planoConta"] = p_conta or ""
                linha["grupoConta"] = g_conta or ""
                linha["edre"] = edre or ""
                break

    return linhas_extrato

# ==============================================================================
# PARSER OFX E ROTEADOR
# ==============================================================================

def processar_ofx(conteudo_texto: str, conexao) -> list:
    """
    Processa o conteúdo do arquivo OFX e valida se o banco extraído existe na dbo.Banco.
    """
    cursor = conexao.cursor()

    # 1. Carrega o mapeamento de Bancos do banco de dados (chave: codigo sem zeros, valor: nome)
    cursor.execute("SELECT codigo, nome FROM dbo.Banco WHERE codigo IS NOT NULL")
    mapa_bancos_db = {}
    for row in cursor.fetchall():
        cod_db, nome_db = row[0], row[1]
        if cod_db:
            mapa_bancos_db[str(cod_db).strip().lstrip("0")] = nome_db.strip()

    # 2. Extração do código do Banco no OFX
    bankid_match = re.search(r"<BANKID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)
    
    if not bankid_match or not bankid_match.group(1).strip():
        raise HTTPException(
            status_code=400, 
            detail="Arquivo OFX inválido: Tag <BANKID> não encontrada."
        )

    banco_codigo_raw = bankid_match.group(1).strip()
    banco_codigo_limpo = banco_codigo_raw.lstrip("0")

    # 3. Busca o nome do banco no banco de dados pelo código
    banco_val = mapa_bancos_db.get(banco_codigo_limpo)

    # Bloqueia a importação caso o banco não esteja cadastrado na dbo.Banco
    if not banco_val:
        raise HTTPException(
            status_code=400,
            detail=f"O banco com código '{banco_codigo_raw}' informado no OFX não está cadastrado no sistema."
        )

    # Extração de Agência e Conta
    agencia_match = re.search(r"<BRANCHID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)
    conta_match = re.search(r"<ACCTID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)

    agencia_val = agencia_match.group(1).strip() if agencia_match else ""
    conta_val = conta_match.group(1).strip() if conta_match else ""

    unidade_val = ""
    contratante_val = ""

    if banco_codigo_limpo and agencia_val and conta_val:
        cursor.execute(
            """
            SELECT u.nome AS unidade_nome, c.nome AS contratante_nome
            FROM dbo.BancoConta bc
            INNER JOIN dbo.Banco b ON bc.bancoId = b.id
            INNER JOIN dbo.Unidade u ON u.bancoContaId = bc.id
            LEFT JOIN dbo.Contratante c ON u.contratanteId = c.id
            WHERE LTRIM(RTRIM(REPLACE(b.codigo, '0', ''))) = ?
              AND LTRIM(RTRIM(bc.agencia)) = ?
              AND LTRIM(RTRIM(bc.conta)) = ?
            """,
            (banco_codigo_limpo, agencia_val, conta_val)
        )
        row_unidade = cursor.fetchone()
        if row_unidade:
            unidade_val = row_unidade[0] or ""
            contratante_val = row_unidade[1] or ""

    # Leitura dos blocos de transação
    blocos_transacao = re.findall(r"<STMTTRN>(.*?)</STMTTRN>", conteudo_texto, re.DOTALL | re.IGNORECASE)
    if not blocos_transacao:
        blocos_transacao = re.findall(r"<TRN>(.*?)</TRN>", conteudo_texto, re.DOTALL | re.IGNORECASE)

    transacoes_dados = []

    for bloco in blocos_transacao:
        data_match = re.search(r"<DTPOSTED>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        valor_match = re.search(r"<TRNAMT>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        memo_match = re.search(r"<MEMO>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        payee_match = re.search(r"<NAME>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        checknum_match = re.search(r"<CHECKNUM>(.*?)(?:<|$)", bloco, re.IGNORECASE)

        data_str = data_match.group(1).strip() if data_match else ""
        data_formatada = f"{data_str[6:8]}/{data_str[4:6]}/{data_str[0:4]}" if len(data_str) >= 8 else data_str

        valor_str = valor_match.group(1).strip().replace(",", ".") if valor_match else "0"
        try:
            valor = float(valor_str)
        except ValueError:
            valor = 0.0

        memo = corrigir_encoding(memo_match.group(1).strip() if memo_match else "")
        payee = corrigir_encoding(payee_match.group(1).strip() if payee_match else "")
        checknum_val = corrigir_encoding(checknum_match.group(1).strip() if checknum_match else "")

        if payee and memo:
            descricao_original = f"{payee} - {memo}"
        else:
            descricao_original = payee or memo

        fornecedor_val = identificar_fornecedor(descricao_original, banco_val)

        # Determinação do Tipo
        desc_lower = descricao_original.lower()
        forn_lower = (fornecedor_val or "").lower()

        if "saldo" in desc_lower or "saldo" in forn_lower:
            tipo = "SALDO"
        elif valor < 0:
            tipo = "PAGAMENTO"
        else:
            tipo = "RECEBIMENTO"

        transacoes_dados.append({
            "contratante": contratante_val,
            "unidade": unidade_val,
            "banco": banco_val,
            "agencia": agencia_val,
            "conta": conta_val,
            "data": data_formatada,
            "descricao": descricao_original,
            "obs": checknum_val,
            "valor": float(valor),
            "tipo": tipo,
            "fornecedor": fornecedor_val,
            "cpf_cnpj": "",
            "planoConta": "",
            "grupoConta": "",
            "edre": ""
        })

    return transacoes_dados

def processar_arquivo(file: UploadFile, conteudo_bytes: bytes, banco: str) -> list:
    filename_lower = file.filename.lower()

    if filename_lower.endswith(".ofx"):
        conteudo_texto = None
        for encoding in ["cp1252", "latin-1", "utf-8"]:
            try:
                conteudo_texto = conteudo_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if not conteudo_texto:
            raise HTTPException(status_code=400, detail="Não foi possível decodificar o arquivo OFX.")
        
        # Abre a conexão e passa para o processador do OFX
        conexao = obter_conexao(banco)
        try:
            return processar_ofx(conteudo_texto, conexao)
        finally:
            conexao.close() # Garante que a conexão seja fechada

    elif filename_lower.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="O processamento de arquivos PDF estará disponível em breve.")

    else:
        raise HTTPException(status_code=400, detail="Formato de arquivo não suportado. Envie um arquivo .ofx")

# ==============================================================================
# EXCEL FORMULATION
# ==============================================================================

def padronizar_dataframe(transacoes: list) -> pd.DataFrame:
    df = pd.DataFrame(transacoes)

    if "valor" in df.columns:
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce").fillna(0.0)

    # Renomeia colunas do dicionário Python para o cabeçalho final do Excel
    mapeamento_colunas = {
        "contratante": "CONTRATANTE",
        "unidade": "UNIDADE",
        "banco": "BANCO",
        "agencia": "AGÊNCIA",
        "conta": "CONTA",
        "data": "DATA",
        "descricao": "DESCRIÇÃO",
        "obs": "OBSERVAÇÃO",
        "valor": "VALOR",
        "tipo": "TIPO",
        "fornecedor": "FORNECEDOR",
        "cpf_cnpj": "CPF_CNPJ",
        "planoConta": "PLANO DE CONTA",
        "grupoConta": "GRUPO DE CONTA",
        "edre": "E-DRE"
    }

    df = df.rename(columns=mapeamento_colunas)

    ordem_desejada = [
        "CONTRATANTE", "UNIDADE", "BANCO", "AGÊNCIA", "CONTA",
        "DATA", "DESCRIÇÃO", "OBSERVAÇÃO", "VALOR", "TIPO", "FORNECEDOR",
        "CPF_CNPJ", "PLANO DE CONTA", "GRUPO DE CONTA", "E-DRE"
    ]

    return df[[col for col in ordem_desejada if col in df.columns]]

# ==============================================================================
# ENDPOINTS DA API
# ==============================================================================

@router.post("/preview")
async def converter_preview(
    file: UploadFile = File(...),
    contratanteId: Optional[int] = Form(None),
    banco: str = Form("NashBancoConsultoria")
):
    conteudo_bytes = await file.read()
    # Passa o 'banco' aqui para abrir a conexão
    transacoes = processar_arquivo(file, conteudo_bytes, banco) 
    
    transacoes = aplicar_plano_conta(transacoes, banco, contratante_id=contratanteId)
    return {"transacoes": transacoes}


@router.post("/download")
async def converter_download(
    file: UploadFile = File(...),
    contratanteId: Optional[int] = Form(None),
    banco: str = Form("NashBancoConsultoria")
):
    try:
        conteudo_bytes = await file.read()
        transacoes = processar_arquivo(file, conteudo_bytes, banco)

        if not transacoes:
            raise HTTPException(status_code=400, detail="Nenhuma transação encontrada no arquivo.")

        # Aplica as regras no conjunto de dados antes de gerar a planilha Excel
        transacoes = aplicar_plano_conta(transacoes, banco, contratante_id=contratanteId)

        df = padronizar_dataframe(transacoes)
        nome_aba = "BASE_FINANCEIRA"
        output = io.BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=nome_aba)
            worksheet = writer.sheets[nome_aba]

            fill_azul = PatternFill(start_color="35448A", end_color="35448A", fill_type="solid")
            fonte_branca = Font(name="Arial", size=11, bold=True, color="FFFFFF")
            alinhamento_centro = Alignment(horizontal="center", vertical="center")

            for cell in worksheet[1]:
                cell.fill = fill_azul
                cell.font = fonte_branca
                cell.alignment = alinhamento_centro

            if "VALOR" in df.columns:
                col_valor_idx = df.columns.get_loc("VALOR") + 1
                for row in range(2, len(df) + 2):
                    cell = worksheet.cell(row=row, column=col_valor_idx)
                    cell.value = float(cell.value or 0.0)
                    cell.number_format = "R$ #,##0.00"
                    cell.alignment = Alignment(horizontal="right", vertical="center")

            for col in worksheet.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                col_letter = col[0].column_letter
                worksheet.column_dimensions[col_letter].width = max(max_len + 10, 12)

        output.seek(0)
        nome_arquivo_saida = f"{file.filename.lower().rsplit('.', 1)[0]}_convertido.xlsx"

        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={nome_arquivo_saida}"},
        )
        
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar Excel: {str(e)}")