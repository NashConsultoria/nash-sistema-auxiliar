import io
import re
import pdfplumber
import bisect 
import pytesseract
from fastapi import APIRouter
from pdf2image import convert_from_bytes

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
POPPLER_PATH = r'C:\Users\Monetae\Downloads\poppler-26.02.0\Library\bin'

router = APIRouter(prefix="/NashBancoConsultoria/bancos", tags=["Conversor de Extratos"])

def converter_data_extenso(texto_data):
    # Dicionário para converter o nome do mês em número
    meses = {
        'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'março': '03',
        'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
        'agosto': '08', 'setembro': '09', 'outubro': '10',
        'novembro': '11', 'dezembro': '12'
    }
    
    # Extrai dia, nome do mês e ano usando expressão regular
    match = re.search(r'(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)\s+de\s+(\d{4})', texto_data, re.IGNORECASE)
    if match:
        dia = match.group(1).zfill(2)
        nome_mes = match.group(2).lower()
        ano = match.group(3)
        
        mes = meses.get(nome_mes, '01')
        return f"{dia}/{mes}/{ano}"
        
    return texto_data

def pdf_banco_do_brasil(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Processa arquivos PDF de extratos do Banco do Brasil (Modelo Extrato Conta Corrente).
    """
    transacoes_dados = []
    banco_val = "BANCO DO BRASIL"

    padrao_data = re.compile(r"^\d{2}/\d{2}/\d{4}$")
    padrao_valor = re.compile(r"^[\d.]+,\d{2}$")

    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        texto_completo = ""
        for pagina in pdf.pages:
            texto_pagina = pagina.extract_text() or ""
            texto_completo += texto_pagina + "\n"

        # Extração de Agência e Conta
        agencia_match = re.search(r"Ag[êe]ncia[:\s]+([\d-]+)", texto_completo, re.IGNORECASE)
        conta_match = re.search(r"Conta[:\s]+([\d-]+)", texto_completo, re.IGNORECASE)

        agencia_val = agencia_match.group(1).strip() if agencia_match else ""
        conta_val = conta_match.group(1).strip() if conta_match else ""

        ultima_data = ""
        descricoes_pendentes = []

        for pagina in pdf.pages:
            palavras = pagina.extract_words(
                x_tolerance=1,
                y_tolerance=2,
                keep_blank_chars=False,
                use_text_flow=False,
            )
            if not palavras:
                continue

            x_lote = 91
            x_documento = 135
            x_historico = 240
            x_valor = 500

            textos_excluidos = {
                "EXTRATO", "DE", "CONTA", "CORRENTE", "CLIENTE",
                "LANÇAMENTOS", "DIA", "LOTE", "DOCUMENTO", "HISTÓRICO",
                "VALOR", "AGÊNCIA:", "CONTA:", "NOME", "DO", "USUÁRIO:",
                "Extrato", "de", "Conta", "Corrente", "Cliente",
                "Lançamentos", "Dia", "Lote", "Documento", "Histórico",
                "Valor", "Agência:", "Conta:"
            }

            palavras_historico = [
                p for p in palavras
                if p["x0"] >= x_historico - 10
                and p["x0"] < x_valor - 10
                and p["text"].strip() not in textos_excluidos
            ]

            # Agrupa palavras do Histórico por linhas
            linhas_historico = []
            for palavra in sorted(palavras_historico, key=lambda p: (p["top"], p["x0"])):
                linha_existente = None
                for linha in reversed(linhas_historico):
                    if abs(linha["top"] - palavra["top"]) <= 2.5:
                        linha_existente = linha
                        break
                    if palavra["top"] - linha["top"] > 5:
                        break

                if linha_existente is None:
                    linhas_historico.append({"top": palavra["top"], "palavras": [palavra]})
                else:
                    linha_existente["palavras"].append(palavra)

            for linha in linhas_historico:
                linha["texto"] = re.sub(
                    r"\s+",
                    " ",
                    " ".join(p["text"] for p in sorted(linha["palavras"], key=lambda p: p["x0"])),
                ).strip()
            linhas_historico.sort(key=lambda l: l["top"])

            # Datas da coluna 'Dia'
            datas = sorted(
                [
                    p for p in palavras
                    if padrao_data.fullmatch(p["text"].strip())
                    and p["x0"] < x_lote - 10
                    and p["text"].strip() != "00/00/0000"
                ],
                key=lambda p: p["top"],
            )

            # Âncoras de Valores
            valores = []
            for palavra in palavras:
                texto = palavra["text"].strip()
                if not padrao_valor.fullmatch(texto):
                    continue
                centro = (palavra["x0"] + palavra["x1"]) / 2
                if centro < x_valor - 30:
                    continue

                sinais = [
                    p for p in palavras
                    if abs(p["top"] - palavra["top"]) <= 3
                    and p["x0"] > palavra["x1"] - 2
                    and p["text"].strip() in {"(+) ", "(+)", "(-)"}
                ]
                sinal = sinais[0]["text"].strip() if sinais else ""
                valores.append({
                    "top": palavra["top"],
                    "valor_texto": texto,
                    "sinal": sinal,
                })

            valores.sort(key=lambda v: v["top"])

            # Âncoras de Documento (ignorando a coluna Lote)
            documentos = [
                p for p in palavras
                if x_documento - 15 <= p["x0"] < x_historico - 10
                and re.fullmatch(r"\d{1,15}", p["text"].strip())
            ]

            movimentos = []
            documentos_usados = set()
            for valor in valores:
                candidatos = [
                    p for p in documentos
                    if abs(p["top"] - valor["top"]) <= 8
                    and id(p) not in documentos_usados
                ]
                
                # Se não encontrar documento na mesma linha, usa valor vazio para a obs
                doc_texto = ""
                top_referencia = valor["top"]
                if candidatos:
                    documento = min(candidatos, key=lambda p: abs(p["top"] - valor["top"]))
                    documentos_usados.add(id(documento))
                    doc_texto = documento["text"].strip()
                    top_referencia = (valor["top"] + documento["top"]) / 2

                movimentos.append({
                    "top": top_referencia,
                    "valor_texto": valor["valor_texto"],
                    "sinal": valor["sinal"],
                    "documento": doc_texto,
                })

            movimentos.sort(key=lambda m: m["top"])
            if not movimentos:
                if datas:
                    ultima_data = datas[-1]["text"].strip()
                continue

            descricoes_por_movimento = [[] for _ in movimentos]
            if descricoes_pendentes:
                descricoes_por_movimento[0].extend(descricoes_pendentes)
                descricoes_pendentes = []

            for linha in linhas_historico:
                texto = linha["texto"]
                texto_lower = texto.lower()
                if not texto or "saldo do dia" in texto_lower or "tar. agrupadas" in texto_lower:
                    continue

                indice = min(
                    range(len(movimentos)),
                    key=lambda i: abs(linha["top"] - movimentos[i]["top"]),
                )
                if abs(linha["top"] - movimentos[indice]["top"]) <= 14:
                    descricoes_por_movimento[indice].append(texto)

            for indice, movimento in enumerate(movimentos):
                datas_anteriores = [d for d in datas if d["top"] <= movimento["top"] + 8]
                if datas_anteriores:
                    data = max(datas_anteriores, key=lambda d: d["top"])["text"].strip()
                    ultima_data = data
                elif ultima_data:
                    data = ultima_data
                else:
                    continue

                descricao = re.sub(r"\s+", " ", " ".join(descricoes_por_movimento[indice])).strip()

                if "saldo do dia" in descricao.lower():
                    continue
                if not descricao:
                    descricao = "LANÇAMENTO"

                valor_base = float(movimento["valor_texto"].replace(".", "").replace(",", "."))
                is_recebimento = movimento["sinal"] == "(+)"
                
                # Se for Saldo Anterior, classifica como SALDO
                if "SALDO ANTERIOR" in descricao.upper():
                    tipo = "SALDO"
                    valor = float(valor_base)
                else:
                    valor = abs(valor_base) if is_recebimento else -abs(valor_base)
                    tipo = "RECEBIMENTO" if is_recebimento else "PAGAMENTO"

                fornecedor_val = identificar_fornecedor_fn(descricao, banco_val)

                transacoes_dados.append({
                    "contratante": "",
                    "unidade": "",
                    "banco": banco_val,
                    "agencia": agencia_val,
                    "conta": conta_val,
                    "data": data,
                    "descricao": descricao,
                    "obs": movimento["documento"],
                    "valor": float(valor),
                    "tipo": tipo,
                    "fornecedor": fornecedor_val,
                    "cpf_cnpj": "",
                    "planoConta": "",
                    "grupoConta": "",
                    "edre": ""
                })

            ultimo_movimento = movimentos[-1]["top"]
            textos_ja_associados = {texto for grupo in descricoes_por_movimento for texto in grupo}
            descricoes_pendentes = [
                linha["texto"] for linha in linhas_historico
                if linha["top"] > ultimo_movimento + 5
                and linha["texto"] not in textos_ja_associados
                and "saldo do dia" not in linha["texto"].lower()
                and "tar. agrupadas" not in linha["texto"].lower()
            ]

            if datas:
                ultima_data = datas[-1]["text"].strip()

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }

def pdf_bradesco(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato Bradesco usando as coordenadas originais
    das palavras no PDF.
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "BRADESCO"
    padrao_data = re.compile(r"^\d{2}/\d{2}/\d{4}$")
    padrao_valor = re.compile(r"^-?[\d.]+,\d{2}$")
    cabecalhos_ignorados = {
        "Extrato Mensal", "Nome do usuário", "Data da operação:", "Folha",
        "Agência", "Conta", "Total Disponível", "Extrato de:",
        "Data", "Lançamento", "Dcto.", "Crédito", "Débito", "Saldo",
        "Total", "Últimos Lançamentos", "Saldos Invest Fácil",
        "Data Histórico", "Não há lançamentos"
    }

    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        texto_primeira_pagina = ""

        # Captura texto da primeira página para extração de Agência e Conta
        for pagina in pdf.pages:
            texto_pagina = pagina.extract_text() or ""
            texto_primeira_pagina += texto_pagina + "\n"

        agencia_match = re.search(
            r"Ag[:\s]*([\d-]+)", texto_primeira_pagina, re.IGNORECASE
        )
        conta_match = re.search(
            r"CC[:\s]*([\d-]+)", texto_primeira_pagina, re.IGNORECASE
        )

        if not agencia_match or not conta_match:
            ag_cc_tabela = re.search(
                r"(\d+)\s*\|\s*([\d-]+)", texto_primeira_pagina
            )
            agencia_val = ag_cc_tabela.group(1).strip() if ag_cc_tabela else ""
            conta_val = ag_cc_tabela.group(2).strip() if ag_cc_tabela else ""
        else:
            agencia_val = agencia_match.group(1).strip()
            conta_val = conta_match.group(1).strip()

        def numero(valor_texto):
            return float(
                valor_texto.replace("-", "")
                .replace(".", "")
                .replace(",", ".")
            )

        def normalizar_linha(palavras):
            palavras = sorted(palavras, key=lambda p: p["x0"])
            return re.sub(
                r"\s+", " ", " ".join(p["text"] for p in palavras)
            ).strip()

        ultima_data_conhecida = ""
        descricoes_pendentes_entre_paginas = []

        for pagina in pdf.pages:
            palavras = pagina.extract_words(
                x_tolerance=1,
                y_tolerance=2,
                keep_blank_chars=False,
                use_text_flow=False,
            )

            if not palavras:
                continue

            # Descarta rodapé informativo se presente
            marcadores_rodape = [
                p["top"] for p in palavras
                if p["text"].strip() == "Os" and p["x0"] < 60
            ]
            if marcadores_rodape:
                limite_quadro_principal = min(marcadores_rodape)
                palavras = [
                    p for p in palavras
                    if p["top"] < limite_quadro_principal
                ]

            # Mapeamento dinâmico de cabeçalho
            cabecalho = {}
            for palavra in palavras:
                texto = palavra["text"].strip()
                if texto in {"Data", "Lançamento", "Dcto.", "Crédito", "Débito", "Saldo"}:
                    cabecalho[texto] = palavra["x0"]

            x_data = cabecalho.get("Data", 40.0)
            x_descricao = cabecalho.get("Lançamento", 100.0)
            x_dcto = cabecalho.get("Dcto.", 266.0)
            x_credito = cabecalho.get("Crédito", 358.0)
            x_debito = cabecalho.get("Débito", 443.0)
            x_saldo = cabecalho.get("Saldo", 533.0)

            def esta_na_coluna(palavra, inicio, fim):
                centro = (palavra["x0"] + palavra["x1"]) / 2
                return inicio <= centro <= fim

            palavras_data = [
                p for p in palavras
                if padrao_data.fullmatch(p["text"].strip())
                and p["x0"] <= x_descricao - 10
            ]
            palavras_data.sort(key=lambda p: p["top"])
            data_contexto_anterior = ultima_data_conhecida

            # Processamento de linhas da Descrição
            palavras_descricao = [
                p for p in palavras
                if p["x0"] >= x_descricao - 8
                and p["x0"] < x_dcto - 12
                and p["text"].strip() not in cabecalhos_ignorados
                and not padrao_data.fullmatch(p["text"].strip())
            ]

            linhas_descricao = []
            tolerancia_linha = 2.5
            for palavra in sorted(palavras_descricao, key=lambda p: (p["top"], p["x0"])):
                linha_existente = None
                for linha in reversed(linhas_descricao):
                    if abs(linha["top"] - palavra["top"]) <= tolerancia_linha:
                        linha_existente = linha
                        break
                    if palavra["top"] - linha["top"] > 5:
                        break

                if linha_existente is None:
                    linhas_descricao.append({"top": palavra["top"], "palavras": [palavra]})
                else:
                    linha_existente["palavras"].append(palavra)

            for linha in linhas_descricao:
                linha["texto"] = normalizar_linha(linha["palavras"])
            linhas_descricao.sort(key=lambda l: l["top"])

            # Âncoras financeiras (Crédito / Débito)
            palavras_movimento = []
            for palavra in palavras:
                texto = palavra["text"].strip()
                if not padrao_valor.fullmatch(texto):
                    continue

                centro = (palavra["x0"] + palavra["x1"]) / 2
                distancia_credito = abs(centro - x_credito)
                distancia_debito = abs(centro - x_debito)
                distancia_saldo = abs(centro - x_saldo)

                if distancia_saldo < min(distancia_credito, distancia_debito):
                    continue
                if min(distancia_credito, distancia_debito) > 55:
                    continue

                tipo_movimento = (
                    "credito" if distancia_credito <= distancia_debito else "debito"
                )
                palavras_movimento.append({
                    "top": palavra["top"],
                    "valor_texto": texto,
                    "tipo_movimento": tipo_movimento,
                })

            palavras_movimento.sort(key=lambda m: m["top"])

            # Vincula documento ao movimento
            palavras_dcto = [
                p for p in palavras
                if esta_na_coluna(p, x_dcto - 35, x_credito - 35)
                and re.fullmatch(r"\d{1,10}", p["text"].strip())
            ]

            movimentos = []
            tolerancia_dcto = 8.0
            for movimento in palavras_movimento:
                candidatos = [
                    p for p in palavras_dcto
                    if abs(p["top"] - movimento["top"]) <= tolerancia_dcto
                ]
                if not candidatos:
                    continue

                dcto = min(candidatos, key=lambda p: abs(p["top"] - movimento["top"]))
                movimentos.append({
                    **movimento,
                    "top": (movimento["top"] + dcto["top"]) / 2,
                    "dcto": dcto["text"].strip(),
                })

            movimentos.sort(key=lambda m: m["top"])
            if not movimentos:
                continue

            descricoes_por_movimento = [[] for _ in movimentos]

            for linha in linhas_descricao:
                if "SALDO ANTERIOR" in linha["texto"].upper():
                    continue
                indice_mais_proximo = min(
                    range(len(movimentos)),
                    key=lambda i: abs(linha["top"] - movimentos[i]["top"])
                )
                if abs(linha["top"] - movimentos[indice_mais_proximo]["top"]) <= 12:
                    descricoes_por_movimento[indice_mais_proximo].append(linha["texto"])

            if descricoes_pendentes_entre_paginas and movimentos:
                descricoes_por_movimento[0] = (
                    descricoes_pendentes_entre_paginas
                    + descricoes_por_movimento[0]
                )
                descricoes_pendentes_entre_paginas = []

            # Tratamento de Saldo Anterior
            for data_palavra in palavras_data:
                existe_saldo = any(
                    "SALDO ANTERIOR" in linha["texto"].upper()
                    and abs(linha["top"] - data_palavra["top"]) <= 4
                    for linha in linhas_descricao
                )
                if not existe_saldo:
                    continue

                valores_saldo = [
                    p for p in palavras
                    if padrao_valor.fullmatch(p["text"].strip())
                    and abs(p["top"] - data_palavra["top"]) <= 4
                    and p["x0"] >= x_saldo - 40
                ]
                if not valores_saldo:
                    continue

                valor_saldo_texto = min(
                    valores_saldo,
                    key=lambda p: abs(p["top"] - data_palavra["top"])
                )["text"].strip()
                
                transacoes_dados.append({
                    "contratante": "",
                    "unidade": "",
                    "banco": banco_val,
                    "agencia": agencia_val,
                    "conta": conta_val,
                    "data": data_palavra["text"].strip(),
                    "descricao": "SALDO ANTERIOR",
                    "obs": "",
                    "valor": float(numero(valor_saldo_texto)),
                    "tipo": "SALDO",
                    "fornecedor": banco_val,
                    "cpf_cnpj": "",
                    "planoConta": "",
                    "grupoConta": "",
                    "edre": ""
                })

            # Montagem final das transações
            for indice, movimento in enumerate(movimentos):
                datas_anteriores = [
                    d for d in palavras_data if d["top"] <= movimento["top"] + 1
                ]
                if datas_anteriores:
                    data_atual = max(datas_anteriores, key=lambda d: d["top"])
                    data = data_atual["text"].strip()
                elif data_contexto_anterior:
                    data_atual = {"top": movimento["top"] - 1}
                    data = data_contexto_anterior
                else:
                    continue

                descricoes = descricoes_por_movimento[indice]
                descricao = re.sub(r"\s+", " ", " ".join(descricoes)).strip()
                if not descricao:
                    descricao = "LANÇAMENTO"

                valor_base = numero(movimento["valor_texto"])
                if movimento["tipo_movimento"] == "debito":
                    valor = -abs(valor_base)
                    tipo = "PAGAMENTO"
                else:
                    valor = abs(valor_base)
                    tipo = "RECEBIMENTO"

                # Aplicação da regra global de fornecedores
                fornecedor_val = identificar_fornecedor_fn(descricao, banco_val)

                transacoes_dados.append({
                    "contratante": "",
                    "unidade": "",
                    "banco": banco_val,
                    "agencia": agencia_val,
                    "conta": conta_val,
                    "data": data,
                    "descricao": descricao,
                    "obs": re.sub(r"\s+", " ", movimento["dcto"]).strip(),
                    "valor": float(valor),
                    "tipo": tipo,
                    "fornecedor": fornecedor_val,
                    "cpf_cnpj": "",
                    "planoConta": "",
                    "grupoConta": "",
                    "edre": ""
                })

            ultimo_top_movimento = movimentos[-1]["top"]
            descricoes_pendentes_entre_paginas = [
                linha["texto"] for linha in linhas_descricao
                if linha["top"] >= ultimo_top_movimento + 5
                and "SALDO ANTERIOR" not in linha["texto"].upper()
            ]

            if palavras_data:
                ultima_data_conhecida = max(
                    palavras_data, key=lambda d: d["top"]
                )["text"].strip()

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }

def pdf_caixa(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato da Caixa Econômica Federal a partir de layout/texto do PDF.
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "CAIXA ECONOMICA FEDERAL"

    texto_completo = ""
    try:
        with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
            for pagina in pdf.pages:
                txt = pagina.extract_text(layout=True)
                if txt:
                    texto_completo += txt + "\n"
    except Exception as e:
        print(f"[ERRO PDFPLUMBER LAYOUT CAIXA]: {e}")

    # Fallback via OCR caso o texto venha vazio ou mascarado
    if not texto_completo.strip() or "000000" in texto_completo[:200]:
        try:
            from pdf2image import convert_from_bytes
            import pytesseract

            # O poppler_path pode ser configurado conforme o ambiente se necessário
            imagens = convert_from_bytes(conteudo_bytes)
            texto_completo = ""
            for imagem in imagens:
                texto_ocr = pytesseract.image_to_string(
                    imagem,
                    lang="por",
                    config="--psm 6",
                )
                if texto_ocr:
                    texto_completo += texto_ocr + "\n"
        except Exception as e:
            print(f"[ERRO OCR CAIXA]: {e}")

    agencia_val = ""
    conta_val = ""
    conta_linha_match = re.search(
        r"Conta\s*[:]?\s*([^\r\n]+)",
        texto_completo,
        re.IGNORECASE,
    )
    if conta_linha_match:
        conta_texto = conta_linha_match.group(1).strip()
        if "/" in conta_texto:
            parte_esq, parte_dir = conta_texto.split("/", 1)
            agencia_val = re.sub(r"\D", "", parte_esq)[:4]
            conta_val = parte_dir.strip()

    historicos_conhecidos = [
        "ENVIO TRANSF INTERNET TEV",
        "TRANSF INTERNET TEV",
        "DEBITO CAPITALIZACAO",
        "CRED LEVANT JUDICIAL",
        "SAQUE DIN AG CHEQUE",
        "CHEQUE COMPENSADO",
        "PAGAMENTO TELEFONE",
        "DEB PAGAMENTO IPVA",
        "PAGAMENTO AGUA",
        "PAG PREFEITURA",
        "PAG BOLETO",
        "PAGBOLETO",
        "PIX RECEBIDO",
        "PIX ENVIADO",
        "DEB PIX CHAVE",
        "SALDO DIA",
        "PLANO MAIS VALOR",
        "CAIXA CAP",
        "TRANSFERENCIA",
        "TARIFA",
        "TED",
        "DOC",
        "TRANSF",
    ]
    historicos_conhecidos.sort(key=len, reverse=True)

    linhas_ignoradas = [
        "EXTRATO POR PERÍODO",
        "CLIENTE:",
        "CONTA:",
        "DATA:",
        "MÊS:",
        "PERÍODO DOS LANÇAMENTOS",
        "LANÇAMENTOS",
        "NR. DOC",
        "HISTÓRICO/COMPLEMENTO",
        "FAVORECIDO",
        "CPF/CNPJ",
        "VALOR",
        "SALDO",
        "#PESSOAL",
        "FOLHA",
        "ALÔ CAIXA",
        "SAC CAIXA",
        "OUVIDORIA",
        "PESSOAS COM DEFICIÊNCIA",
    ]

    def converter_valor(valor_texto):
        texto = valor_texto.strip().replace("R$", "")
        texto = re.sub(r"\s+", "", texto)
        texto = texto.replace(".", "").replace(",", ".")
        return float(texto)

    def limpar_documentos(texto):
        texto = re.sub(r"\S*\*+\S*", " ", texto)
        texto = re.sub(r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b", " ", texto)
        texto = re.sub(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b", " ", texto)
        texto = re.sub(r"\s{2,}", " ", texto)
        return texto.strip(" -–—|:")

    for linha in texto_completo.splitlines():
        linha_original = linha.rstrip()
        linha_str = linha_original.strip()
        if not linha_str:
            continue

        linha_upper = linha_str.upper()
        if any(cabecalho in linha_upper for cabecalho in linhas_ignoradas):
            continue

        # Validação do formato de data no início do lançamento
        match_inicio = re.match(
            r"^(\d{2}/\d{2}/\d{4})\s*-\s*[\d:]+\s+(\d{4,10})\s+(.*)$",
            linha_str,
        )
        if not match_inicio:
            continue

        data_lanc, doc, corpo = match_inicio.groups()
        if doc == "000000":
            continue

        matches_valores = list(
            re.finditer(
                r"([+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s*([CD])(?=\s|$)",
                corpo,
                re.IGNORECASE,
            )
        )
        if not matches_valores:
            continue

        match_valor = matches_valores[0]
        val_str = match_valor.group(1)
        tipo_cd = match_valor.group(2).upper()
        try:
            valor_base = converter_valor(val_str)
        except ValueError:
            continue

        if tipo_cd == "C":
            tipo = "RECEBIMENTO"
            valor = abs(valor_base)
        elif tipo_cd == "D":
            tipo = "PAGAMENTO"
            valor = -abs(valor_base)
        else:
            continue

        corpo_sem_valor = corpo[:match_valor.start()].strip()
        corpo_sem_valor = limpar_documentos(corpo_sem_valor)

        historico = ""
        resto = corpo_sem_valor
        resto_upper = resto.upper()
        for historico_candidato in historicos_conhecidos:
            pos = resto_upper.find(historico_candidato)
            if pos >= 0:
                historico = resto[pos:pos + len(historico_candidato)].strip()
                resto = (resto[:pos] + " " + resto[pos + len(historico_candidato):]).strip()
                break

        if not historico:
            blocos = re.split(r"\s{2,}", corpo_sem_valor, maxsplit=1)
            historico = blocos[0].strip() if blocos else ""
            resto = blocos[1].strip() if len(blocos) > 1 else ""

        resto = re.sub(r"^[\s|–—:-]+", "", resto).strip()
        favorecido = resto
        favorecido = re.sub(r"\s{2,}", " ", favorecido).strip(" -–—|:")
        favorecido = limpar_documentos(favorecido)

        descricao_final = re.sub(r"\s+", " ", historico).strip()
        if not descricao_final:
            descricao_final = "LANCAMENTO CAIXA"

        # Se houver um favorecido explícito com tamanho válido, preserva-o; caso contrário, chama a resolução central
        if favorecido and not favorecido.isdigit() and len(favorecido) > 2:
            fornecedor_val = favorecido
        else:
            fornecedor_val = identificar_fornecedor_fn(descricao_final, banco_val)

        transacoes_dados.append({
            "contratante": "",
            "unidade": "",
            "banco": banco_val,
            "agencia": agencia_val,
            "conta": conta_val,
            "data": data_lanc,
            "descricao": descricao_final,
            "obs": doc,
            "valor": float(valor),
            "tipo": tipo,
            "fornecedor": fornecedor_val,
            "cpf_cnpj": "",
            "planoConta": "",
            "grupoConta": "",
            "edre": ""
        })

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }

def pdf_sicoob(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato do SICOOB utilizando a lógica de agrupamento por coordenadas.
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "SICOOB"

    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        texto_completo = ""
        for pagina in pdf.pages:
            txt = pagina.extract_text(layout=True)
            if txt:
                texto_completo += txt + "\n"

        agencia_val = ""
        coop_match = re.search(r"COOP\.\s*:\s*([^\r\n]+)", texto_completo, re.IGNORECASE)
        if coop_match:
            agencia_val = coop_match.group(1).split("/")[0].strip()

        conta_val = ""
        conta_match = re.search(r"CONTA\s*:\s*([^\r\n]+)", texto_completo, re.IGNORECASE)
        if conta_match:
            partes_conta = conta_match.group(1).split("/")
            conta_val = partes_conta[0].strip()

        ano_match = re.search(r"/\d{2}/(\d{4})", texto_completo)
        ano_padrao = ano_match.group(1) if ano_match else "2026"

        SHIFT = 8
        COL_VALOR_X0 = 400

        for pagina in pdf.pages:
            palavras = pagina.extract_words(use_text_flow=False, keep_blank_chars=False)
            if not palavras:
                continue

            ancoras = sorted(
                [p for p in palavras if re.fullmatch(r"\d{2}/\d{2}", p["text"]) and p["x0"] < 150],
                key=lambda a: a["top"]
            )
            if not ancoras:
                continue

            starts = [a["top"] - SHIFT for a in ancoras]
            grupos = [[] for _ in ancoras]

            for p in palavras:
                idx = bisect.bisect_right(starts, p["top"]) - 1
                if idx < 0:
                    continue
                grupos[idx].append(p)

            for i, ancora in enumerate(ancoras):
                grupo = grupos[i]
                data_parcial = ancora["text"]
                data_completa = f"{data_parcial}/{ano_padrao}"

                hist_words = sorted(
                    [p for p in grupo if p["x0"] < COL_VALOR_X0 and p["text"] != data_parcial],
                    key=lambda p: (round(p["top"], 1), p["x0"])
                )
                valor_words = sorted(
                    [p for p in grupo if p["x0"] >= COL_VALOR_X0],
                    key=lambda p: (round(p["top"], 1), p["x0"])
                )

                descricao_bruta = " ".join(p["text"] for p in hist_words)
                valor_bruto = " ".join(p["text"] for p in valor_words)

                match_val = re.search(r"([\d\.]+,\d{2})", valor_bruto)
                if not match_val:
                    continue
                val_str = match_val.group(1)

                match_tipo = re.search(r"\b([CD\*])\b", valor_bruto[match_val.end():] or valor_bruto)
                if not match_tipo:
                    match_tipo = re.search(r"([CD\*])\s*$", valor_bruto)
                tipo_cd = match_tipo.group(1).upper() if match_tipo else "C"

                try:
                    valor_num = float(val_str.replace(".", "").replace(",", "."))
                except ValueError:
                    valor_num = 0.0

                if tipo_cd in ["C", "*"]:
                    tipo = "RECEBIMENTO"
                    valor = abs(valor_num)
                else:
                    tipo = "PAGAMENTO"
                    valor = -abs(valor_num)

                match_doc = re.search(r"DOC\.?\s*[:]?\s*(\S+)", descricao_bruta, re.IGNORECASE)
                doc = match_doc.group(1) if match_doc else ""

                descricao = re.sub(r"DOC\.?\s*[:]?\s*\S+", "", descricao_bruta, flags=re.IGNORECASE)
                descricao = re.sub(r"\s{2,}", " ", descricao).strip()

                if not descricao:
                    continue
                if any(h in descricao.upper() for h in ["RESUMO", "SALDO EM CONTA", "OUVIDORIA", "CUSTO EFETIVO", "LIMITES DE", "EXTRATOS EMITIDOS", "TAXA CHEQUE", "ENCARGOS"]):
                    continue

                fornecedor_val = identificar_fornecedor_fn(descricao, banco_val)

                transacoes_dados.append({
                    "contratante": "",
                    "unidade": "",
                    "banco": banco_val,
                    "agencia": agencia_val,
                    "conta": conta_val,
                    "data": data_completa,
                    "descricao": descricao,
                    "obs": doc,
                    "valor": float(valor),
                    "tipo": tipo,
                    "fornecedor": fornecedor_val,
                    "cpf_cnpj": "",
                    "planoConta": "",
                    "grupoConta": "",
                    "edre": ""
                })

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }

def pdf_safra(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato Safra sem misturar valor/saldo na descrição.
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "BANCO SAFRA"

    texto_completo = ""
    linhas_completas = []

    try:
        with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
            for pagina in pdf.pages:
                txt = pagina.extract_text(layout=True) or ""
                if txt:
                    texto_completo += txt + "\n"
                    linhas_completas.extend(
                        linha.strip()
                        for linha in txt.splitlines()
                        if linha.strip()
                    )
    except Exception as exc:
        print(f"[ERRO PDFPLUMBER SAFRA]: {exc}")
        return {
            "agencia": "",
            "conta": "",
            "transacoes": []
        }

    agencia_match = re.search(
        r"AG\s*:\s*([^\s|]+)", texto_completo, re.IGNORECASE
    )
    conta_match = re.search(
        r"CONTA\s*:\s*([^\s|]+)", texto_completo, re.IGNORECASE
    )
    agencia_val = agencia_match.group(1).strip() if agencia_match else ""
    conta_val = conta_match.group(1).strip() if conta_match else ""

    ano_match = re.search(
        r"Período de\s+\d{2}/\d{2}/(\d{4})", texto_completo, re.IGNORECASE
    )
    if not ano_match:
        ano_match = re.search(r"/\d{2}/(\d{4})", texto_completo)
    ano_padrao = ano_match.group(1) if ano_match else "2026"

    pos_lancamentos = texto_completo.upper().find("LANÇAMENTOS REALIZADOS")
    texto_util = (
        texto_completo[pos_lancamentos:]
        if pos_lancamentos != -1
        else texto_completo
    )

    linhas = [linha.strip() for linha in texto_util.splitlines() if linha.strip()]
    linhas_uteis = []
    ignorar_bloco_suporte = False
    termos_suporte = (
        "CENTRAL DE SUPORTE", "SAC E DEFICIENTES", "OUVIDORIA",
        "CAPITAL E GRANDE SP", "DEMAIS LOCALIDADES", "24H POR DIA",
    )
    termos_cabecalho = (
        "LANÇAMENTOS REALIZADOS", "DATA", "LANÇAMENTO", "COMPLEMENTO",
        "Nº DOCUMENTO", "VALOR", "PÁGINA",
    )

    for linha in linhas:
        linha_upper = linha.upper()
        if any(termo in linha_upper for termo in termos_suporte):
            ignorar_bloco_suporte = True
            continue

        if ignorar_bloco_suporte:
            if re.match(r"^\d{2}/\d{2}", linha):
                ignorar_bloco_suporte = False
            else:
                continue

        if any(cabecalho in linha_upper for cabecalho in termos_cabecalho):
            continue
        linhas_uteis.append(linha)

    texto_unificado = "\n".join(linhas_uteis)
    fragmentos = re.split(r"(?=\b\d{2}/\d{2}\b)", texto_unificado)

    padrao_valor = re.compile(r"[-+]?\d{1,3}(?:\.\d{3})*,\d{2}|[-+]?\d+,\d{2}")
    padrao_documento = re.compile(r"\b\d{5,}\b")

    for fragmento in fragmentos:
        frag_str = fragmento.strip()
        if not frag_str:
            continue

        match_data = re.match(r"^(\d{2}/\d{2})", frag_str)
        if not match_data:
            continue

        data_parcial = match_data.group(1)
        data_completa = f"{data_parcial}/{ano_padrao}"
        frag_upper = frag_str.upper()
        if "SALDO" in frag_upper:
            continue

        valores_encontrados = list(padrao_valor.finditer(frag_str))
        if not valores_encontrados:
            continue

        match_val = valores_encontrados[0]
        val_str = match_val.group(0)
        val_sem_sinal = val_str.replace("+", "").replace("-", "")

        try:
            valor_base = float(val_sem_sinal.replace(".", "").replace(",", "."))
        except ValueError:
            continue

        if val_str.startswith("-"):
            valor = -abs(valor_base)
            tipo = "PAGAMENTO"
        else:
            valor = abs(valor_base)
            tipo = "RECEBIMENTO"

        texto_sem_data = re.sub(r"^\d{2}/\d{2}\s*", "", frag_str, count=1)

        descricao = padrao_valor.sub(" ", texto_sem_data)

        documentos = padrao_documento.findall(descricao)
        doc = documentos[0] if documentos else ""
        if doc:
            descricao = re.sub(rf"\b{re.escape(doc)}\b", " ", descricao, count=1)

        descricao = re.split(
            r"(CENTRAL DE SUPORTE|SAC E DEFICIENTES|OUVIDORIA)",
            descricao,
            flags=re.IGNORECASE,
        )[0]
        descricao = re.sub(r"\s+", " ", descricao).strip(" -")
        if not descricao:
            continue

        fornecedor_val = identificar_fornecedor_fn(descricao, banco_val)

        transacoes_dados.append({
            "contratante": "",
            "unidade": "",
            "banco": banco_val,
            "agencia": agencia_val,
            "conta": conta_val,
            "data": data_completa,
            "descricao": descricao,
            "obs": doc,
            "valor": float(valor),
            "tipo": tipo,
            "fornecedor": fornecedor_val,
            "cpf_cnpj": "",
            "planoConta": "",
            "grupoConta": "",
            "edre": ""
        })

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }

def pdf_sicredi(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato Sicredi utilizando bounding boxes (coordenadas) por página.
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "SICREDI"
    
    texto_completo = ""
    try:
        with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
            for pagina in pdf.pages:
                txt = pagina.extract_text()
                if txt:
                    texto_completo += txt + "\n"
    except Exception as e:
        print(f"[ERRO PDFPLUMBER SICREDI]: {e}")

    # Extração de Metadados do Cabeçalho
    match_coop = re.search(r"Cooperativa\s*:\s*([^\r\n]+)", texto_completo, re.IGNORECASE)
    agencia_val = match_coop.group(1).strip() if match_coop else ""

    match_conta = re.search(r"Conta\s*:\s*([^\r\n]+)", texto_completo, re.IGNORECASE)
    conta_val = match_conta.group(1).strip() if match_conta else ""

    # Extração Baseada em Coordenadas (Bounding Boxes) por Página
    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        for pagina in pdf.pages:
            palavras = pagina.extract_words()
            
            linhas_agrupadas = {}
            for p in palavras:
                y = round(p['top'])
                if y not in linhas_agrupadas:
                    linhas_agrupadas[y] = []
                linhas_agrupadas[y].append(p)
            
            for y, itens in linhas_agrupadas.items():
                itens.sort(key=lambda x: x['x0'])
                
                # Mapeamento por faixas horizontais (Eixo X) do layout do Sicredi:
                # - Data: X < 90
                # - Descrição: 90 <= X < 320
                # - Documento (Ignorado/Descartado): 320 <= X < 450
                # - Valor: X >= 450
                data = " ".join([i['text'] for i in itens if i['x0'] < 90])
                descricao = " ".join([i['text'] for i in itens if 90 <= i['x0'] < 320])
                valor_raw = " ".join([i['text'] for i in itens if i['x0'] >= 450])
                
                # Validação: linha deve iniciar com uma data válida e não ser linha de saldo
                if not re.match(r'\d{2}/\d{2}/\d{4}', data) or "SALDO" in descricao.upper():
                    continue
                
                match_val = re.search(r'(-?[\d\.]+,\d{2})', valor_raw)
                if not match_val:
                    continue
                    
                val_str = match_val.group(1).replace(".", "").replace(",", ".")
                try:
                    valor_base = float(val_str)
                except ValueError:
                    valor_base = 0.0
                    
                if valor_base < 0:
                    tipo = "PAGAMENTO"
                    valor = -abs(valor_base)
                else:
                    tipo = "RECEBIMENTO"
                    valor = abs(valor_base)

                descricao_limpa = descricao.strip()
                fornecedor_val = identificar_fornecedor_fn(descricao_limpa, banco_val)

                transacoes_dados.append({
                    "contratante": "",
                    "unidade": "",
                    "banco": banco_val,
                    "agencia": agencia_val,
                    "conta": conta_val,
                    "data": data,
                    "descricao": descricao_limpa,
                    "obs": "",
                    "valor": float(valor),
                    "tipo": tipo,
                    "fornecedor": fornecedor_val,
                    "cpf_cnpj": "",
                    "planoConta": "",
                    "grupoConta": "",
                    "edre": ""
                })

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }

def pdf_c6(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato C6 Bank utilizando leitura de bounding boxes e 
    tratamento de descrições multi-linhas.
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "BANCO C6"

    texto_completo = ""
    try:
        with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
            for pagina in pdf.pages:
                txt = pagina.extract_text()
                if txt:
                    texto_completo += txt + "\n"
    except Exception as e:
        print(f"[ERRO PDFPLUMBER C6]: {e}")

    agencia_match = re.search(
        r"Ag[êe]ncia[:\s]+([\d-]+)", texto_completo, re.IGNORECASE
    )
    conta_match = re.search(
        r"Conta[:\s]+([\d-]+)", texto_completo, re.IGNORECASE
    )
    agencia_val = agencia_match.group(1).strip() if agencia_match else ""
    conta_val = conta_match.group(1).strip() if conta_match else ""

    ano_match = re.search(r"de\s+(\d{4})", texto_completo, re.IGNORECASE)
    if not ano_match:
        ano_match = re.search(r"/(\d{4})", texto_completo)
    ano_padrao = ano_match.group(1) if ano_match else "2026"

    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        for pagina in pdf.pages:
            palavras = pagina.extract_words()
            linhas_agrupadas = {}
            for p in palavras:
                y = round(p["top"])
                linhas_agrupadas.setdefault(y, []).append(p)

            for y, itens in sorted(linhas_agrupadas.items(), key=lambda item: item[0]):
                itens.sort(key=lambda x: x["x0"])

                data_lanc = " ".join(
                    i["text"] for i in itens if i["x0"] < 65
                )
                descricao_atual = " ".join(
                    i["text"] for i in itens if 230 <= i["x0"] < 450
                )
                valor_raw = " ".join(
                    i["text"] for i in itens if i["x0"] >= 450
                )

                if not re.match(r"^\d{2}/\d{2}$", data_lanc):
                    continue
                if "SALDO" in descricao_atual.upper() or "EXTRATO" in descricao_atual.upper():
                    continue

                match_val = re.search(
                    r"(-?R?\$?\s*[\d\.]+,\d{2})", valor_raw
                )
                if not match_val:
                    continue

                valor_str = match_val.group(1)
                valor_limpo_str = re.sub(r"[R\$\s]", "", valor_str)
                valor_limpo_str = valor_limpo_str.replace(".", "").replace(",", ".")
                try:
                    valor_base = float(valor_limpo_str)
                except ValueError:
                    continue

                if valor_base < 0:
                    tipo = "PAGAMENTO"
                    valor = -abs(valor_base)
                else:
                    tipo = "RECEBIMENTO"
                    valor = abs(valor_base)

                # Captura linhas adicionais de descrição que não contenham data/valor
                continuacoes = []
                for y_extra, itens_extra in linhas_agrupadas.items():
                    if y_extra == y or abs(y_extra - y) > 8:
                        continue

                    texto_extra = " ".join(
                        i["text"] for i in sorted(
                            itens_extra, key=lambda x: x["x0"]
                        ) if 230 <= i["x0"] < 450
                    ).strip()
                    if not texto_extra:
                        continue

                    possui_data = any(
                        re.match(r"^\d{2}/\d{2}$", i["text"])
                        and i["x0"] < 65
                        for i in itens_extra
                    )
                    possui_valor = any(
                        i["x0"] >= 450 and "R$" in i["text"]
                        for i in itens_extra
                    )
                    if not possui_data and not possui_valor:
                        continuacoes.append((y_extra, texto_extra))

                partes_descricao = []
                if descricao_atual.strip():
                    partes_descricao.append((y, descricao_atual.strip()))
                partes_descricao.extend(continuacoes)
                descricao = " ".join(
                    texto for _, texto in sorted(partes_descricao, key=lambda p: p[0])
                ).strip()

                if not descricao:
                    continue

                data_completa = f"{data_lanc}/{ano_padrao}"
                fornecedor_val = identificar_fornecedor_fn(descricao, banco_val)

                transacoes_dados.append({
                    "contratante": "",
                    "unidade": "",
                    "banco": banco_val,
                    "agencia": agencia_val,
                    "conta": conta_val,
                    "data": data_completa,
                    "descricao": descricao.strip(),
                    "obs": "",
                    "valor": float(valor),
                    "tipo": tipo,
                    "fornecedor": fornecedor_val,
                    "cpf_cnpj": "",
                    "planoConta": "",
                    "grupoConta": "",
                    "edre": ""
                })

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }

def pdf_inter(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato Banco Inter utilizando leitura por coordenadas 
    e agrupamento de datas por cabeçalho.
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "BANCO INTER"
    
    texto_completo = ""
    try:
        with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
            for pagina in pdf.pages:
                txt = pagina.extract_text()
                if txt:
                    texto_completo += txt + "\n"
    except Exception as e:
        print(f"[ERRO PDFPLUMBER INTER]: {e}")

    # Extração de Metadados do Cabeçalho
    match_coop = re.search(r"Agência\s*:\s*([\d-]+)", texto_completo, re.IGNORECASE)
    agencia_val = match_coop.group(1).strip() if match_coop else ""

    match_conta = re.search(r"Conta\s*:\s*([\d-]+)", texto_completo, re.IGNORECASE)
    conta_val = match_conta.group(1).strip() if match_conta else ""

    data_atual_fixa = ""
    
    with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
        for pagina in pdf.pages:
            palavras = pagina.extract_words()
            if not palavras:
                continue
                
            linhas_agrupadas = {}
            for p in palavras:
                y = round(p['top'])
                if y not in linhas_agrupadas:
                    linhas_agrupadas[y] = []
                linhas_agrupadas[y].append(p)
            
            for y, itens in linhas_agrupadas.items():
                itens.sort(key=lambda x: x['x0'])
                
                texto_linha = " ".join([i['text'] for i in itens])
                
                # Identifica a linha de cabeçalho de data do Banco Inter (ex: "22 de Julho de 2026")
                match_data_cabecalho = re.search(r"(\d{1,2}\s+de\s+[A-Za-zç]+\s+de\s+\d{4})", texto_linha, re.IGNORECASE)
                if match_data_cabecalho:
                    data_bruta = match_data_cabecalho.group(1).strip()
                    data_atual_fixa = converter_data_extenso(data_bruta)
                    continue
                    
                if "SALDO DO DIA" in texto_linha.upper() or "VALOR" in texto_linha.upper():
                    continue

                descricao = " ".join([i['text'] for i in itens if i['x0'] < 320]).strip()
                valor_raw = " ".join([i['text'] for i in itens if i['x0'] >= 320])
                
                match_val = re.search(r'(-?R?\$?\s*[\d\.]+,\d{2})', valor_raw)
                if not match_val or not descricao:
                    continue
                    
                data_transacao = data_atual_fixa

                valor_str = match_val.group(1)
                valor_limpo_str = re.sub(r"[R\$\s]", "", valor_str).replace(".", "").replace(",", ".")
                
                try:
                    valor_base = float(valor_limpo_str)
                except ValueError:
                    continue
                    
                tipo = "PAGAMENTO" if valor_base < 0 else "RECEBIMENTO"
                valor = -abs(valor_base) if valor_base < 0 else abs(valor_base)

                fornecedor_val = identificar_fornecedor_fn(descricao, banco_val)

                transacoes_dados.append({
                    "contratante": "",
                    "unidade": "",
                    "banco": banco_val,
                    "agencia": agencia_val,
                    "conta": conta_val,
                    "data": data_transacao,
                    "descricao": descricao,
                    "obs": "", 
                    "valor": float(valor),
                    "tipo": tipo,
                    "fornecedor": fornecedor_val,
                    "cpf_cnpj": "",
                    "planoConta": "",
                    "grupoConta": "",
                    "edre": ""
                })

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }

def pdf_cora(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato CORA utilizando leitura por coordenadas e 
    mapeamento de tabela fixa (colunas de tipo, nome, documento e valor).
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "BANCO CORA"

    padrao_data = re.compile(r"^\d{2}/\d{2}/\d{4}$")
    padrao_documento = re.compile(
        r"^(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})$"
    )
    termos_ignorados = {
        "EXTRATO GERADO",
        "SALDO DO DIA",
        "SALDO INICIAL",
        "SALDO FINAL",
        "TOTAL DE ENTRADAS",
        "TOTAL DE SAÍDAS",
        "CORA SCFI",
        "OUVIDORIA",
    }

    try:
        with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
            texto_completo = "\n".join(
                pagina.extract_text() or "" for pagina in pdf.pages
            )

            agencia_match = re.search(
                r"Ag[êe]ncia[:\s]*([\d-]+)",
                texto_completo,
                re.IGNORECASE,
            )
            conta_match = re.search(
                r"Conta[:\s]*([\d-]+)",
                texto_completo,
                re.IGNORECASE,
            )
            agencia_val = agencia_match.group(1).strip() if agencia_match else ""
            conta_val = conta_match.group(1).strip() if conta_match else ""

            data_atual = ""

            datas_geracao = set(
                re.findall(
                    r"Extrato gerado no dia\s+(\d{2}/\d{2}/\d{4})",
                    texto_completo,
                    re.IGNORECASE,
                )
            )

            for pagina in pdf.pages:
                palavras = pagina.extract_words(
                    x_tolerance=1,
                    y_tolerance=2,
                    keep_blank_chars=False,
                    use_text_flow=False,
                )
                if not palavras:
                    continue

                linhas = []
                for palavra in sorted(
                    palavras,
                    key=lambda p: (p["top"], p["x0"]),
                ):
                    linha = None
                    for candidata in reversed(linhas):
                        if abs(candidata["top"] - palavra["top"]) <= 3:
                            linha = candidata
                            break
                        if palavra["top"] - candidata["top"] > 5:
                            break
                    if linha is None:
                        linha = {"top": palavra["top"], "palavras": []}
                        linhas.append(linha)
                    linha["palavras"].append(palavra)

                linhas.sort(key=lambda l: l["top"])

                for linha in linhas:
                    itens = sorted(linha["palavras"], key=lambda p: p["x0"])
                    texto_linha = re.sub(
                        r"\s+",
                        " ",
                        " ".join(p["text"] for p in itens),
                    ).strip()
                    texto_alto = texto_linha.upper()

                    datas_linha = [
                        p for p in itens
                        if padrao_data.fullmatch(p["text"].strip())
                        and p["x0"] < 180
                    ]
                    if datas_linha:
                        data_linha = datas_linha[0]["text"].strip()
                        if (
                            data_linha != "00/00/0000"
                            and data_linha not in datas_geracao
                        ):
                            data_atual = data_linha

                    if any(termo in texto_alto for termo in termos_ignorados):
                        continue
                    if not data_atual:
                        continue

                    palavras_valor = [p for p in itens if p["x0"] >= 475]
                    texto_valor = " ".join(p["text"] for p in palavras_valor)
                    match_valor = re.search(
                        r"([+-])?\s*R\$\s*([\d.]+,\d{2})",
                        texto_valor,
                    )
                    if not match_valor:
                        continue

                    sinal = match_valor.group(1) or "+"
                    valor_str = match_valor.group(2)
                    try:
                        valor_base = float(
                            valor_str.replace(".", "").replace(",", ".")
                        )
                    except ValueError:
                        continue
                    valor = abs(valor_base) if sinal == "+" else -abs(valor_base)
                    tipo = "RECEBIMENTO" if valor >= 0 else "PAGAMENTO"

                    palavras_nome = [
                        p for p in itens
                        if 205 <= p["x0"] < 340
                        and not padrao_data.fullmatch(p["text"].strip())
                    ]
                    nome = re.sub(
                        r"\s+",
                        " ",
                        " ".join(p["text"] for p in palavras_nome),
                    ).strip()
                    if not nome:
                        continue

                    cpf_cnpj = ""
                    for p in itens:
                        token = p["text"].strip()
                        if padrao_documento.fullmatch(token):
                            cpf_cnpj = token
                            break

                    fornecedor_val = identificar_fornecedor_fn(nome, banco_val)

                    transacoes_dados.append({
                        "contratante": "",
                        "unidade": "",
                        "banco": banco_val,
                        "agencia": str(agencia_val),
                        "conta": str(conta_val),
                        "data": str(data_atual),
                        "descricao": nome,
                        "obs": "",
                        "valor": float(valor),
                        "tipo": tipo,
                        "fornecedor": fornecedor_val,
                        "cpf_cnpj": cpf_cnpj,
                        "planoConta": "",
                        "grupoConta": "",
                        "edre": ""
                    })

    except Exception as e:
        print(f"[ERRO PDFPLUMBER CORA LEITURA]: {e}")
        return {
            "agencia": "",
            "conta": "",
            "transacoes": []
        }

    return {
        "agencia": str(agencia_val),
        "conta": str(conta_val),
        "transacoes": transacoes_dados
    }

def pdf_stone(conteudo_bytes: bytes, identificar_fornecedor_fn) -> dict:
    """
    Extrai lançamentos do extrato STONE utilizando coordenadas e leitura multi-linhas
    para compor descrições completas.
    Retorna o dicionário com agência, conta e lista de transações extraídas.
    """
    transacoes_dados = []
    banco_val = "BANCO STONE"
    texto_completo = ""

    try:
        with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
            for pagina in pdf.pages:
                txt = pagina.extract_text()
                if txt:
                    texto_completo += txt + "\n"
    except Exception as e:
        print(f"[ERRO PDFPLUMBER STONE]: {e}")

    # Captura de agência e conta (trata o caractere especial de hífen gráfico do PDF)
    match_conta = re.search(
        r"^\s*Institui[cç][aã]o\s+Ag[êe]ncia\s+Conta\s*$\n"
        r"\s*(.+?)\s+(\d{1,6})\s+(\S+)\s*$",
        texto_completo,
        re.IGNORECASE | re.MULTILINE,
    )
    agencia_val = match_conta.group(2).strip() if match_conta else ""
    conta_val = match_conta.group(3).strip() if match_conta else ""
    conta_val = conta_val.replace("\ue088", "-").replace("", "-")

    def normalizar(texto):
        return re.sub(r"\s+", " ", texto).strip()

    padrao_data = re.compile(r"^\d{2}/\d{2}/\d{2,4}$")
    padrao_valor = re.compile(
        r"([+-])?\s*R\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})"
    )

    try:
        with pdfplumber.open(io.BytesIO(conteudo_bytes)) as pdf:
            for pagina in pdf.pages:
                palavras = pagina.extract_words(
                    x_tolerance=1,
                    y_tolerance=2,
                    keep_blank_chars=False,
                    use_text_flow=False,
                )
                if not palavras:
                    continue

                linhas = {}
                for palavra in palavras:
                    y = round(palavra["top"])
                    linhas.setdefault(y, []).append(palavra)
                linhas = dict(sorted(linhas.items()))

                def itens_linha(y):
                    return sorted(linhas[y], key=lambda p: p["x0"])

                for y, itens in linhas.items():
                    itens = itens_linha(y)
                    texto_data = normalizar(
                        " ".join(p["text"] for p in itens if p["x0"] < 70)
                    )
                    if not padrao_data.fullmatch(texto_data):
                        continue

                    valor_tokens = [
                        p for p in itens if 275 <= p["x0"] < 350
                    ]
                    valor_raw = normalizar(
                        " ".join(p["text"] for p in valor_tokens)
                    )
                    match_valor = padrao_valor.search(valor_raw)
                    if not match_valor:
                        continue

                    sinal = match_valor.group(1) or "+"
                    valor_str = match_valor.group(2)
                    try:
                        valor_base = float(
                            valor_str.replace(".", "").replace(",", ".")
                        )
                    except ValueError:
                        continue

                    if sinal == "-":
                        valor = -abs(valor_base)
                        tipo = "PAGAMENTO"
                    else:
                        valor = abs(valor_base)
                        tipo = "RECEBIMENTO"

                    partes_descricao = []
                    for y_extra, itens_extra in linhas.items():
                        if abs(y_extra - y) > 15:
                            continue

                        possui_data = any(
                            p["x0"] < 70
                            and padrao_data.fullmatch(p["text"].strip())
                            for p in itens_extra
                        )
                        possui_valor = any(
                            285 <= p["x0"] < 350 and "R$" in p["text"]
                            for p in itens_extra
                        )
                        if possui_data or possui_valor:
                            if y_extra != y:
                                continue

                        descricao_tokens = [
                            p for p in itens_extra
                            if 115 <= p["x0"] < 280
                            and p["text"].strip().upper() != "R$"
                            and not re.fullmatch(
                                r"[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}",
                                p["text"].strip(),
                            )
                        ]
                        if not descricao_tokens:
                            continue

                        texto_descricao = normalizar(
                            " ".join(
                                p["text"] for p in sorted(
                                    descricao_tokens, key=lambda p: p["x0"]
                                )
                            )
                        )
                        if texto_descricao:
                            partes_descricao.append((y_extra, texto_descricao))

                    descricao_partes_unicas = []
                    vistos = set()
                    for _, parte in sorted(partes_descricao):
                        chave = parte.upper()
                        if chave not in vistos:
                            vistos.add(chave)
                            descricao_partes_unicas.append(parte)
                    descricao = normalizar(
                        " ".join(descricao_partes_unicas)
                    )
                    if not descricao:
                        continue

                    fornecedor_val = identificar_fornecedor_fn(descricao, banco_val)

                    transacoes_dados.append({
                        "contratante": "",
                        "unidade": "",
                        "banco": banco_val,
                        "agencia": agencia_val,
                        "conta": conta_val,
                        "data": texto_data,
                        "descricao": descricao,
                        "obs": "",
                        "valor": float(valor),
                        "tipo": tipo,
                        "fornecedor": fornecedor_val,
                        "cpf_cnpj": "",
                        "planoConta": "",
                        "grupoConta": "",
                        "edre": ""
                    })
    except Exception as e:
        print(f"[ERRO PDFPLUMBER STONE COORDENADAS]: {e}")
        return {
            "agencia": "",
            "conta": "",
            "transacoes": []
        }

    return {
        "agencia": agencia_val,
        "conta": conta_val,
        "transacoes": transacoes_dados
    }