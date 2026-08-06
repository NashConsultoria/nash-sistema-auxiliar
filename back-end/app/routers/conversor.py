import io
import re
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
import pandas as pd
from openpyxl.styles import Alignment, Font, PatternFill

# Supondo que esses imports venham da sua estrutura atual
from app.config import MAPA_BANCOS
from app.utils import normalizar_texto

router = APIRouter(prefix="/NashBancoConsultoria/conversor", tags=["Conversor OFX"])


def gerar_fornecedor_com_filtro(descricao_texto):
  if not descricao_texto:
    return ""
  palavras_remover = [
      "recebimento",
      "pagamento",
      "pix",
      "saque",
      "outra if",
      "recebido",
      "emitido",
      "deb",
      "cred",
      "transf",
      "recebida",
  ]
  pattern = re.compile(
      r"\b(" + "|".join(palavras_remover) + r")\b", flags=re.IGNORECASE
  )
  fornecedor_limpo = pattern.sub("", descricao_texto)
  fornecedor_limpo = re.sub(r"\s*-\s*-\s*", " - ", fornecedor_limpo)
  fornecedor_limpo = re.sub(r"^\s*-\s*", "", fornecedor_limpo)
  fornecedor_limpo = re.sub(r"\s*-\s*$", "", fornecedor_limpo)
  fornecedor_limpo = re.sub(r"\s+", " ", fornecedor_limpo).strip()
  return fornecedor_limpo


def processar_conteudo_ofx(conteudo_texto):
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

    tipo = tipo_match.group(1).strip() if tipo_match else "OTHER"

    data_str = data_match.group(1).strip() if data_match else ""
    data_formatada = data_str
    if len(data_str) >= 8:
      ano = data_str[0:4]
      mes = data_str[4:6]
      dia = data_str[6:8]
      data_formatada = f"{dia}/{mes}/{ano}"

    valor_str = valor_match.group(1).strip() if valor_match else "0"
    valor_str = valor_str.replace(",", ".")
    try:
      valor = float(valor_str)
    except ValueError:
      valor = 0.0

    memo = normalizar_texto(memo_match.group(1).strip() if memo_match else "")
    payee = normalizar_texto(payee_match.group(1).strip() if payee_match else "")
    checknum_val = (
        normalizar_texto(checknum_match.group(1).strip())
        if checknum_match
        else ""
    )

    if payee and memo:
      descricao_original = f"{payee} - {memo}"
    elif payee:
      descricao_original = payee
    else:
      descricao_original = memo

    if "tarifa" in descricao_original.lower():
      fornecedor_val = banco_val
    else:
      fornecedor_val = gerar_fornecedor_com_filtro(descricao_original)

    transacoes_dados.append({
        "banco": banco_val,
        "agencia": agencia_val,
        "conta": conta_val,
        "data": data_formatada,
        "descricao": descricao_original,
        "obs": checknum_val,
        "valor": valor,
        "tipo": tipo,
        "fornecedor": fornecedor_val,
    })

  return transacoes_dados


@router.post("/preview")
async def converter_preview(file: UploadFile = File(...)):
  if not file.filename.lower().endswith(".ofx"):
    raise HTTPException(
        status_code=400, detail="Apenas arquivos .ofx são permitidos."
    )

  conteudo_bytes = await file.read()
  conteudo_texto = None
  for encoding in ["cp1252", "latin-1", "utf-8"]:
    try:
      conteudo_texto = conteudo_bytes.decode(encoding)
      break
    except UnicodeDecodeError:
      continue

  if not conteudo_texto:
    raise HTTPException(
        status_code=400, detail="Não foi possível decodificar o arquivo."
    )

  transacoes = processar_conteudo_ofx(conteudo_texto)

  # AQUI VOCÊ DEVE INSERIR OS DADOS NA TABELA 'Conversor' DO BANCO DE DADOS
  # Exemplo: db.query(Conversor).delete() seguido de add_all(transacoes) e commit()

  return {"transacoes": transacoes}


@router.post("/download")
async def converter_download(file: UploadFile = File(...)):
  if not file.filename.lower().endswith(".ofx"):
    raise HTTPException(
        status_code=400, detail="Apenas arquivos .ofx são permitidos."
    )

  conteudo_bytes = await file.read()
  conteudo_texto = None
  for encoding in ["cp1252", "latin-1", "utf-8"]:
    try:
      conteudo_texto = conteudo_bytes.decode(encoding)
      break
    except UnicodeDecodeError:
      continue

  if not conteudo_texto:
    raise HTTPException(
        status_code=400, detail="Não foi possível decodificar o arquivo."
    )

  transacoes = processar_conteudo_ofx(conteudo_texto)

  df = pd.DataFrame(transacoes)

  # Gera o excel em memória RAM (sem salvar arquivo físico no servidor)
  output = io.BytesIO()
  with pd.ExcelWriter(output, engine="openpyxl") as writer:
    df.to_excel(writer, index=False, sheet_name="Extrato")
    worksheet = writer.sheets["Extrato"]

    fill_azul_escuro = PatternFill(
        start_color="1F497D", end_color="1F497D", fill_type="solid"
    )
    fonte_branca = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    for col in range(1, len(df.columns) + 1):
      cell = worksheet.cell(row=1, column=col)
      cell.fill = fill_azul_escuro
      cell.font = fonte_branca
      cell.alignment = Alignment(horizontal="center", vertical="center")

    for column in worksheet.columns:
      max_len = max(len(str(cell.value or "")) for cell in column)
      col_letter = column[0].column_letter
      worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

  output.seek(0)

  # AQUI VOCÊ FAZ A LIMPEZA/EXCLUSÃO DOS DADOS DA TABELA 'Conversor' NO BANCO DE DADOS
  # Exemplo: db.query(Conversor).delete(); db.commit() cumprindo a regra de exclusão

  return StreamingResponse(
      output,
      media_type=(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      ),
      headers={"Content-Disposition": "attachment; filename=extrato_convertido.xlsx"},
  )