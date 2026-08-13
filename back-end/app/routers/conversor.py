import io
import pdfplumber
import re
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
import pandas as pd
from openpyxl.styles import Alignment, Font, PatternFill

# Imports centralizados do projeto
from app.config import MAPA_BANCOS, REGRAS_FORNECEDORES, PALAVRAS_REMOVIDAS, BANCO_AUTENTICACAO
from app.database import obter_conexao
from app.utils import corrigir_encoding, normalizar_texto

router = APIRouter(prefix="/NashBancoConsultoria/conversor", tags=["Conversor de Extratos"])

# ==============================================================================
# FUNÇÕES DE SUPORTE E UTILITÁRIOS
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
            return banco_val if fornecedor == "BANCO" else fornecedor
    return gerar_fornecedor_com_filtro(descricao)

def aplicar_plano_conta(linhas_extrato, banco, contratante_id=None):
    """
    Recebe as linhas brutas do extrato e aplica o DE/PARA
    """
    conexao = obter_conexao(banco)
    cursor = conexao.cursor()

    # 1. Busca todas as regras ativas no banco de dados
    # Traz o termoBusca e os dados do PlanoContas (edre, grupoConta, planoConta)
    query_regras = """
        SELECT 
            r.termoBusca,
            pc.edre,
            pc.grupoConta,
            pc.planoConta
        FROM dbo.RegraCategorizacao r
        INNER JOIN dbo.PlanoContas pc ON r.planoContaId = pc.id
        WHERE r.ativo = 1 AND (r.contratanteId IS NULL OR r.contratanteId = ?)
    """
    cursor.execute(query_regras, [contratante_id])
    regras = cursor.fetchall()
    conexao.close()

    # 2. Aplica as regras linha por linha do arquivo
    for linha in linhas_extrato:
        # Junta Descrição + Fornecedor para a busca
        texto_busca = f"{linha.get('descricao', '')} {linha.get('fornecedor', '')}".upper().strip()

        for regra in regras:
            termo = regra[0].upper().strip()

            # Se a palavra-chave estiver contida na descrição do extrato
            if termo in texto_busca:
                linha['edre'] = regra[1]
                linha['grupoConta'] = regra[2]
                linha['planoConta'] = regra[3]
                break  # Encontrou a primeira regra correspondente, passa para a próxima linha

    return linhas_extrato

# ==============================================================================
# PARSERS DE ARQUIVO (OFX E PDF)
# ==============================================================================

def processar_ofx(conteudo_texto: str) -> list:
    bankid_match = re.search(r"<BANKID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)
    if bankid_match:
        banco_codigo = bankid_match.group(1).strip().lstrip("0")
        banco_val = MAPA_BANCOS.get(banco_codigo)
        if not banco_val and banco_codigo.isdigit():
            banco_val = MAPA_BANCOS.get(banco_codigo.zfill(3))
        if not banco_val:
            banco_val = banco_codigo.upper()
    else:
        banco_val = "DESCONHECIDO"

    agencia_match = re.search(r"<BRANCHID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)
    conta_match = re.search(r"<ACCTID>(.*?)(?:<|$)", conteudo_texto, re.IGNORECASE)

    agencia_val = agencia_match.group(1).strip() if agencia_match else ""
    conta_val = conta_match.group(1).strip() if conta_match else ""

    blocos_transacao = re.findall(
        r"<STMTTRN>(.*?)</STMTTRN>", conteudo_texto, re.DOTALL | re.IGNORECASE
    )
    if not blocos_transacao:
        blocos_transacao = re.findall(
            r"<TRN>(.*?)</TRN>", conteudo_texto, re.DOTALL | re.IGNORECASE
        )

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
            "banco": banco_val,
            "agencia": agencia_val,
            "conta": conta_val,
            "data": data_formatada,
            "descricao": descricao_original,
            "obs": checknum_val,
            "valor": float(valor),
            "tipo": tipo,
            "fornecedores": fornecedor_val,
        })

    return transacoes_dados

def processar_pdf_banco_do_brasil(conteudo_bytes):
    transacoes_dados = []
    banco_val = "BANCO DO BRASIL"
    
    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        texto_completo = ""
        for pagina in pdf.pages:
            texto_pagina = pagina.extract_text()
            if texto_pagina:
                texto_completo += texto_pagina + "\n"

    # Extrair Agência e Conta
    agencia_match = re.search(r"Ag[êe]ncia[:\s]+([\d-]+)", texto_completo, re.IGNORECASE)
    conta_match = re.search(r"Conta[:\s]+([\d-]+)", texto_completo, re.IGNORECASE)
    agencia_val = agencia_match.group(1).strip() if agencia_match else ""
    conta_val = conta_match.group(1).strip() if conta_match else ""

    # Extrair a Unidade (Cliente) de forma flexível (com ou sem dois-pontos)
    # Torna o dois-pontos opcional (aceita com ou sem) e captura tudo após os espaços
    cliente_match = re.search(r"Cliente[:]?\s+([^\r\n]+)", texto_completo, re.IGNORECASE)
    unidade_val = cliente_match.group(1).strip() if cliente_match else ""
    print(f"[TESTE UNIDADE] Unidade encontrada: '{unidade_val}'")
    linhas = texto_completo.split("\n")
    data_reutilizar = ""

    transacoes_blocos = []
    bloco_atual = ""
    
    for linha in linhas:
        linha_str = linha.strip()
        if not linha_str or any(h in linha_str for h in ["Lançamentos", "Agência:", "Dia", "Extrato", "CNPJ:"]):
            if "Saldo Anterior" in linha_str or "SALDO ANTERIOR" in linha_str.upper():
                transacoes_blocos.append(linha_str)
            continue
            
        if re.match(r"^\d{2}/\d{2}/\d{4}", linha_str):
            if bloco_atual:
                transacoes_blocos.append(bloco_atual)
            bloco_atual = linha_str
        else:
            if bloco_atual:
                bloco_atual += " " + linha_str
            else:
                bloco_atual = linha_str
                
    if bloco_atual:
        transacoes_blocos.append(bloco_atual)

    for texto_bloco in transacoes_blocos:
        if "SALDO ANTERIOR" in texto_bloco.upper() or "Saldo Anterior" in texto_bloco:
            match_s = re.search(r"(\d{2}/\d{2}/\d{4})\s+.*?([\d\.,]+\s*\([+\-]\))", texto_bloco)
            if match_s:
                data_saldo = match_s.group(1)
                val_saldo = match_s.group(2)
                is_rec = "(+)" in val_saldo
                num_s = val_saldo.replace("(+)", "").replace("(-)", "").strip().replace(".", "").replace(",", ".")
                try:
                    val = float(num_s)
                except ValueError:
                    val = 0.0
                if not is_rec and val > 0:
                    val = -val
                transacoes_dados.append({
                    "banco": banco_val,
                    "agencia": agencia_val,
                    "conta": conta_val,
                    "unidade": unidade_val,
                    "data": data_saldo,
                    "descricao": "SALDO ANTERIOR",
                    "obs": "",
                    "valor": float(val),
                    "tipo": "RECEBIMENTO" if is_rec else "PAGAMENTO",
                    "fornecedores": banco_val,
                })
            continue

        match_date = re.match(r"^(\d{2}/\d{2}/\d{4})", texto_bloco)
        if match_date:
            data_reutilizar = match_date.group(1)
            restante = texto_bloco[len(data_reutilizar):].strip()
        else:
            restante = texto_bloco
            if not data_reutilizar:
                continue

        match_val = re.search(r"([\d\.]+(?:,\d{2}))\s*(\([+\-]\))", restante)
        if not match_val:
            match_val_flex = re.search(r"([\d\.]+(?:,\d{2}))\s*([DC\+\-]+)?", restante)
            if not match_val_flex:
                continue
            val_str = match_val_flex.group(1)
            sinal_capturado = val_str + " " + (match_val_flex.group(2) or "")
        else:
            val_str = match_val.group(1)
            sinal_capturado = val_str + " " + match_val.group(2)

        is_recebimento = "(+)" in sinal_capturado or "C" in sinal_capturado.upper()
        if "(-)" in sinal_capturado or "D" in sinal_capturado.upper() or "-" in sinal_capturado:
            is_recebimento = False
        elif not ("(+)" in sinal_capturado or "C" in sinal_capturado):
            if any(termo in texto_bloco.lower() for termo in ["db", "deb", "pagamento", "tar", "pix env", "transf.env", "ted env", "compra com cartao"]):
                is_recebimento = False

        num_str = val_str.replace(".", "").replace(",", ".")
        try:
            valor = float(num_str)
        except ValueError:
            continue

        if not is_recebimento and valor > 0:
            valor = -valor

        tipo = "RECEBIMENTO" if is_recebimento else "PAGAMENTO"

        corpo = restante.replace(sinal_capturado, " ", 1).strip()
        corpo = corpo.replace(val_str, " ").strip()

        lote = ""
        doc = ""
        
        corpo = re.sub(r"\b(99008|9903|13105|14397|17624)\b", "", corpo)
        
        match_doc_isolado = re.search(r"\b(\d{4,15})\b", corpo)
        if match_doc_isolado:
            doc = match_doc_isolado.group(1)
            corpo = corpo.replace(doc, " ", 1)

        descricao = re.sub(r"\s+", " ", corpo).strip()
        descricao_normalizada = normalizar_texto(descricao)

        if "debconvtributos federais - rfb" in descricao_normalizada.lower():
            fornecedor_val = "RECEITA FEDERAL"
        elif "tarifa" in descricao_normalizada.lower():
            fornecedor_val = banco_val
        else:
            fornecedor_val = gerar_fornecedor_com_filtro(descricao_normalizada)

        fornecedor_val = re.sub(r"\d+", "", fornecedor_val)
        fornecedor_val = re.sub(r"\s+", " ", fornecedor_val).strip()

        transacoes_dados.append({
            "banco": banco_val,
            "agencia": agencia_val,
            "conta": conta_val,
            "unidade": unidade_val,
            "data": data_reutilizar,
            "descricao": descricao_normalizada,
            "obs": normalizar_texto(doc),
            "valor": float(valor),
            "tipo": tipo,
            "fornecedores": fornecedor_val,
        })

    return transacoes_dados
    
def padronizar_dataframe(transacoes):
    df = pd.DataFrame(transacoes)

    # Garante que a coluna 'valor' seja numérica (float)
    if "valor" in df.columns:
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce").fillna(0.0)

    # Trata a coluna UNIDADE: se já veio preenchida do extrator, mantém; senão, deixa vazia
    if "unidade" in df.columns:
        df["UNIDADE"] = df["unidade"].fillna("")
        # Remove a coluna minúscula antiga para evitar duplicação
        if "unidade" != "UNIDADE":
            df = df.drop(columns=["unidade"])
    else:
        df["UNIDADE"] = ""

    # Adiciona as outras colunas extras caso não existam
    df["CONTRATANTE"] = ""
    df["CPF_CNPJ"] = ""
    df["PLANO DE CONTA"] = ""
    df["GRUPO DE CONTA"] = ""
    df["E-DRE"] = ""

    ordem_colunas = [
        "CONTRATANTE",
        "UNIDADE",
        "banco",
        "agencia",
        "conta",
        "data",
        "descricao",
        "obs",
        "valor",
        "tipo",
        "fornecedores",
        "CPF_CNPJ",
        "PLANO DE CONTA",
        "GRUPO DE CONTA",
        "E-DRE"
    ]

    df = df[[col for col in ordem_colunas if col in df.columns]]
    df.columns = [str(col).upper() for col in df.columns]
    return df

def processar_pdf(conteudo_bytes: bytes) -> list:
    """Gerenciador centralizador de leitura de arquivos PDF."""
    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        texto_completo = ""
        for pagina in pdf.pages:
            texto_pagina = pagina.extract_text()
            if texto_pagina:
                texto_completo += texto_pagina + "\n"

    texto_lower = texto_completo.lower()

    if "banco do brasil" in texto_lower or "bb.com.br" in texto_lower:
        return processar_pdf_banco_do_brasil(texto_completo)
    else:
        raise HTTPException(
            status_code=400,
            detail="O modelo do PDF enviado não é suportado pelo sistema."
        )

def extrair_transacoes_do_arquivo(file: UploadFile, conteudo_bytes: bytes) -> list:
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
        return processar_pdf(conteudo_bytes)

    else:
        raise HTTPException(status_code=400, detail="Apenas arquivos .ofx e .pdf são permitidos.")

# ==============================================================================
# DATAFRAME & EXCEL FORMULATION
# ==============================================================================

def padronizar_dataframe(transacoes: list) -> pd.DataFrame:
    df = pd.DataFrame(transacoes)

    if "valor" in df.columns:
        df["valor"] = pd.to_numeric(df["valor"], errors="coerce").fillna(0.0)

    for col in ["CONTRATANTE", "UNIDADE", "CPF_CNPJ", "PLANO DE CONTA", "GRUPO DE CONTA", "E-DRE"]:
        df[col] = ""

    ordem_colunas = [
        "CONTRATANTE", "UNIDADE", "banco", "agencia", "conta",
        "data", "descricao", "obs", "valor", "tipo", "fornecedores",
        "CPF_CNPJ", "PLANO DE CONTA", "GRUPO DE CONTA", "E-DRE"
    ]

    df = df[[col for col in ordem_colunas if col in df.columns]]
    df.columns = [str(col).upper() for col in df.columns]
    return df

# ==============================================================================
# ENDPOINTS DA API
# ==============================================================================

@router.post("/preview")
async def converter_preview(file: UploadFile = File(...)):
    conteudo_bytes = await file.read()
    transacoes = extrair_transacoes_do_arquivo(file, conteudo_bytes)
    return {"transacoes": transacoes}

@router.post("/download")
async def converter_download(file: UploadFile = File(...)):
    try:
        conteudo_bytes = await file.read()
        transacoes = extrair_transacoes_do_arquivo(file, conteudo_bytes)

        if not transacoes:
            raise HTTPException(
                status_code=400, 
                detail="Nenhuma transação foi identificada neste arquivo."
            )

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
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar o arquivo Excel: {str(e)}")