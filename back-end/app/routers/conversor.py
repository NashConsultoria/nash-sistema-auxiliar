import io
import re
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
import pandas as pd
from openpyxl.styles import Alignment, Font, PatternFill

from app.config import MAPA_BANCOS, REGRAS_FORNECEDORES, PALAVRAS_REMOVIDAS
from app.database import obter_conexao
from app.utils import corrigir_encoding

router = APIRouter(prefix="/NashBancoConsultoria/conversor", tags=["Conversor de Extratos"])

# ==============================================================================
# ENRIQUECIMENTO E APLICAÇÃO DE REGRAS
# ==============================================================================

def gerar_fornecedor_com_filtro(descricao_texto: str) -> str:
    if not descricao_texto:
        return ""

    palavras_escapadas = [re.escape(palavra) for palavra in PALAVRAS_REMOVIDAS]
    pattern = re.compile(
        r"\b(" + "|".join(palavras_escapadas) + r")\b", flags=re.IGNORECASE
    )
    fornecedor_limpo = pattern.sub("", descricao_texto)
    fornecedor_limpo = re.sub(r"\s*-\s*-\s*", " - ", fornecedor_limpo)
    fornecedor_limpo = re.sub(r"^\s*-\s*", "", fornecedor_limpo)
    fornecedor_limpo = re.sub(r"\s*-\s*$", "", fornecedor_limpo)
    return re.sub(r"\s+", " ", fornecedor_limpo).strip()

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

        # 2. Busca as regras ativas de DE/PARA com os dados do PlanoContas
        query_regras = """
            SELECT 
                p.termoDescricao,
                p.termoFornecedor,
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
        forn = (linha.get("fornecedor") or "").upper().strip()

        for t_desc, t_forn, p_conta, g_conta, edre in regras:
            match_desc = True if not t_desc else (t_desc.upper() in desc)
            match_forn = True if not t_forn else (t_forn.upper() in forn)

            if match_desc and match_forn:
                linha["planoConta"] = p_conta or ""
                linha["grupoConta"] = g_conta or ""
                linha["edre"] = edre or ""
                break

    return linhas_extrato

# ==============================================================================
# PARSER OFX E ROTEADOR
# ==============================================================================

def processar_ofx(conteudo_texto: str) -> list:
    bankid_match = re.search(r"<BANKID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)
    if bankid_match:
        banco_codigo = bankid_match.group(1).strip().lstrip("0")
        banco_val = MAPA_BANCOS.get(banco_codigo) or MAPA_BANCOS.get(banco_codigo.zfill(3)) or banco_codigo.upper()
    else:
        banco_val = "DESCONHECIDO"

    agencia_match = re.search(r"<BRANCHID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)
    conta_match = re.search(r"<ACCTID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)

    agencia_val = agencia_match.group(1).strip() if agencia_match else ""
    conta_val = conta_match.group(1).strip() if conta_match else ""

    blocos_transacao = re.findall(r"<STMTTRN>(.*?)</STMTTRN>", conteudo_texto, re.DOTALL | re.IGNORECASE)
    if not blocos_transacao:
        blocos_transacao = re.findall(r"<TRN>(.*?)</TRN>", conteudo_texto, re.DOTALL | re.IGNORECASE)

    transacoes_dados = []

    for bloco in blocos_transacao:
        tipo_match = re.search(r"<TRNTYPE>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        data_match = re.search(r"<DTPOSTED>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        valor_match = re.search(r"<TRNAMT>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        memo_match = re.search(r"<MEMO>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        payee_match = re.search(r"<NAME>(.*?)(?:<|$)", bloco, re.IGNORECASE)
        checknum_match = re.search(r"<CHECKNUM>(.*?)(?:<|$)", bloco, re.IGNORECASE)

        tipo_bruto = tipo_match.group(1).strip().upper() if tipo_match else "OTHER"
        tipo = "RECEBIMENTO" if tipo_bruto == "CREDIT" else ("PAGAMENTO" if tipo_bruto == "DEBIT" else tipo_bruto)

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

        transacoes_dados.append({
            "contratante": "",
            "unidade": "",
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


def processar_arquivo(file: UploadFile, conteudo_bytes: bytes) -> list:
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
        return processar_ofx(conteudo_texto)

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
    transacoes = processar_arquivo(file, conteudo_bytes)
    
    # Aplica as regras e preenche Contratante + Plano de Contas no Preview
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
        transacoes = processar_arquivo(file, conteudo_bytes)

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