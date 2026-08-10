from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from app.config import ORDEM_DRE, PERFIL_CLIENTE
from app.database import obter_conexao
from app.schemas.usuarios import UsuarioToken
from app.security import obter_usuario_atual
from app.utils import obter_ordem_efolha, normalizar_texto

router = APIRouter(tags=["Relatórios"])

@router.get("/{banco}/dre")
def obter_dre(
    banco: str,
    ano: int = 2026,
    contratante: Optional[str] = None,
    unidade: Optional[str] = None,
    usuario: UsuarioToken = Depends(obter_usuario_atual),
):
    try:
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        condicoes = ["YEAR(m.data) = ?"]
        parametros = [ano]

        if usuario.perfil == PERFIL_CLIENTE:
            if not usuario.contratanteId:
                raise HTTPException(
                    status_code=403,
                    detail="Usuário cliente sem contratante vinculado.",
                )
            condicoes.append("c.id = ?")
            parametros.append(usuario.contratanteId)
        else:
            if contratante:
                nomes = [
                    n.strip().upper() for n in contratante.split(",") if n.strip()
                ]
                if nomes:
                    placeholders = ",".join(["?"] * len(nomes))
                    condicoes.append(f"UPPER(TRIM(c.nome)) IN ({placeholders})")
                    parametros.extend(nomes)
            if unidade:
                unidades_list = [
                    u.strip().upper() for u in unidade.split(",") if u.strip()
                ]
                if unidades_list:
                    placeholders_u = ",".join(["?"] * len(unidades_list))
                    condicoes.append(f"UPPER(TRIM(u.nome)) IN ({placeholders_u})")
                    parametros.extend(unidades_list)

        clausula_where = " AND ".join(condicoes)

        query = f"""
            SELECT 
                pc.edre,
                pc.grupoConta,
                pc.planoConta,
                MONTH(m.data) AS mes,
                SUM(ISNULL(m.valor, 0)) AS total
            FROM dbo.Movimentacao m
            INNER JOIN dbo.PlanoContas pc ON m.planoContaId = pc.id
            LEFT JOIN dbo.Unidade u ON m.unidadeId = u.id
            LEFT JOIN dbo.Contratante c ON u.contratanteId = c.id
            WHERE {clausula_where}
            GROUP BY pc.edre, pc.grupoConta, pc.planoConta, MONTH(m.data)
        """

        cursor.execute(query, parametros)
        linhas = cursor.fetchall()

        estrutura_dre = {}

        # 1. Agrupamento inicial dos dados do banco
        for row in linhas:
            edre = str(row[0]).strip() if row[0] else ""
            grupo_conta = str(row[1]).strip() if row[1] else ""
            plano_conta = str(row[2]).strip() if row[2] else ""
            mes = int(row[3])
            total_valor = float(row[4] or 0.0)

            if edre not in estrutura_dre:
                estrutura_dre[edre] = {
                    "nome": edre,
                    "valores": [0.0] * 12,
                    "ordem": ORDEM_DRE.get(edre.upper(), 99),
                    "grupos_contas": {},
                }

            if grupo_conta not in estrutura_dre[edre]["grupos_contas"]:
                estrutura_dre[edre]["grupos_contas"][grupo_conta] = {
                    "nome": grupo_conta,
                    "valores": [0.0] * 12,
                    "contas": {},
                }

            if (
                plano_conta
                not in estrutura_dre[edre]["grupos_contas"][grupo_conta]["contas"]
            ):
                estrutura_dre[edre]["grupos_contas"][grupo_conta]["contas"][
                    plano_conta
                ] = {"nome": plano_conta, "valores": [0.0] * 12}

            if 1 <= mes <= 12:
                idx = mes - 1
                estrutura_dre[edre]["valores"][idx] += total_valor
                estrutura_dre[edre]["grupos_contas"][grupo_conta]["valores"][
                    idx
                ] += total_valor
                estrutura_dre[edre]["grupos_contas"][grupo_conta]["contas"][
                    plano_conta
                ]["valores"][idx] += total_valor

        # 2. Inicialização dos vetores de cálculo DRE (12 meses)
        valores_receita_bruta = [0.0] * 12
        valores_deducoes = [0.0] * 12
        valores_custos = [0.0] * 12
        valores_despesas = [0.0] * 12
        valores_retirada_socios = [0.0] * 12
        valores_nao_operacional = [0.0] * 12

        for edre_nome, dados_op in estrutura_dre.items():
            nome_normalizado = normalizar_texto(edre_nome)
            
            for i in range(12):
                val = dados_op["valores"][i]
                if "RECEITA OPERACIONAL" in nome_normalizado or "RECEITA" in nome_normalizado:
                    valores_receita_bruta[i] += val
                elif "DEDUCAO" in nome_normalizado or "DEDUCOES" in nome_normalizado:
                    valores_deducoes[i] += val
                elif "CUSTO" in nome_normalizado:
                    valores_custos[i] += val
                elif "DESP" in nome_normalizado or "ADMINISTRATIVA" in nome_normalizado:
                    valores_despesas[i] += val
                elif "RETIRADA SOCIOS" in nome_normalizado or "SOCIOS" in nome_normalizado:
                    valores_retirada_socios[i] += val
                elif "MOV" in nome_normalizado and "OPERACIONAL" in nome_normalizado:
                    valores_nao_operacional[i] += val

        # Operações matemáticas
        valores_receita_liquida = [round(valores_receita_bruta[i] + valores_deducoes[i], 2) for i in range(12)]
        valores_lucro_bruto = [round(valores_receita_liquida[i] + valores_custos[i], 2) for i in range(12)]
        valores_resultado_operacional = [round(valores_lucro_bruto[i] + valores_despesas[i], 2) for i in range(12)]
        valores_resultado_apos_socios = [round(valores_resultado_operacional[i] + valores_retirada_socios[i], 2) for i in range(12)]
        valores_resultado_final = [round(valores_resultado_apos_socios[i] + valores_nao_operacional[i], 2) for i in range(12)]

        # 3. Formatação hierárquica
        def formatar_grupo(dados_op, tipo_grupo):
            lista_nivel2 = sorted(dados_op["grupos_contas"].values(), key=lambda x: x["nome"])
            for g_conta in lista_nivel2:
                g_conta["valores"] = [round(v, 2) for v in g_conta["valores"]]
                g_conta["tipo"] = "subgrupo"

                lista_contas = sorted(g_conta["contas"].values(), key=lambda x: x["nome"])
                for conta in lista_contas:
                    conta["valores"] = [round(v, 2) for v in conta["valores"]]
                    conta["tipo"] = "conta_folha"
                g_conta["contas"] = lista_contas

            return {
                "nome": dados_op["nome"],
                "valores": [round(v, 2) for v in dados_op["valores"]],
                "tipo": tipo_grupo,
                "grupos_contas": lista_nivel2,
            }

        # 4. Estrutura final ordenada
        dre_final = []

        def buscar_grupo_por_termo(termo_busca):
            termo_norm = normalizar_texto(termo_busca)
            for chave, obj in estrutura_dre.items():
                if termo_norm in normalizar_texto(chave):
                    return obj
            return None

        grupo_receita = buscar_grupo_por_termo("RECEITA OPERACIONAL BRUTA") or buscar_grupo_por_termo("RECEITA OPERACIONAL")
        if grupo_receita:
            dre_final.append(formatar_grupo(grupo_receita, "grupo"))

        grupo_deducao = buscar_grupo_por_termo("DEDUCAO DA RECEITA") or buscar_grupo_por_termo("DEDUCOES")
        if grupo_deducao:
            dre_final.append(formatar_grupo(grupo_deducao, "grupo"))

        dre_final.append({
            "nome": "RECEITA OPERACIONAL LÍQUIDA",
            "valores": valores_receita_liquida,
            "tipo": "calculo",
            "grupos_contas": [],
        })

        grupo_custo = buscar_grupo_por_termo("CUSTO OPERACIONAL") or buscar_grupo_por_termo("CUSTOS")
        if grupo_custo:
            dre_final.append(formatar_grupo(grupo_custo, "grupo"))

        dre_final.append({
            "nome": "LUCRO BRUTO",
            "valores": valores_lucro_bruto,
            "tipo": "calculo",
            "grupos_contas": [],
        })

        grupo_despesa = buscar_grupo_por_termo("DESP. OPERACIONAL") or buscar_grupo_por_termo("DESPESAS")
        if grupo_despesa:
            dre_final.append(formatar_grupo(grupo_despesa, "grupo"))

        dre_final.append({
            "nome": "RESULTADO OPERACIONAL",
            "valores": valores_resultado_operacional,
            "tipo": "calculo",
            "grupos_contas": [],
        })

        grupo_socios = buscar_grupo_por_termo("RETIRADA SOCIOS") or buscar_grupo_por_termo("SOCIOS")
        if grupo_socios:
            dre_final.append(formatar_grupo(grupo_socios, "grupo"))

        dre_final.append({
            "nome": "RESULTADO APÓS SÓCIOS",
            "valores": valores_resultado_apos_socios,
            "tipo": "calculo",
            "grupos_contas": [],
        })

        grupo_nao_op = None
        for chave, obj in estrutura_dre.items():
            chave_norm = normalizar_texto(chave)
            if "MOV" in chave_norm and "OPERACIONAL" in chave_norm:
                if "RECEITA" not in chave_norm and "CUSTO" not in chave_norm and "DESP" not in chave_norm:
                    grupo_nao_op = obj
                    break

        if grupo_nao_op:
            dre_final.append(formatar_grupo(grupo_nao_op, "grupo"))

        dre_final.append({
            "nome": "RESULTADO FINAL",
            "valores": valores_resultado_final,
            "tipo": "calculo",
            "grupos_contas": [],
        })

        conexao.close()
        return {"sucesso": True, "dre": dre_final}

    except Exception as e:
        if "conexao" in locals() and conexao:
            conexao.close()
        return {"sucesso": False, "mensagem": f"Erro ao gerar DRE: {str(e)}"}

@router.get("/{banco}/relatorio-folha-pagamento")
def obter_folha_pagamento(
    banco: str,
    ano: int = 2026,
    contratante: Optional[str] = None,
    unidade: Optional[str] = None,
    usuario: UsuarioToken = Depends(obter_usuario_atual),
):
    try:
        conexao = obter_conexao(banco)
        cursor = conexao.cursor()

        cursor.execute(
            "SELECT DISTINCT YEAR(dataCompetencia) FROM dbo.MovimentacaoFolhaPagamento"
        )
        anos_disponiveis = [r[0] for r in cursor.fetchall() if r[0] is not None]

        condicoes = []
        parametros = []

        if ano in anos_disponiveis:
            condicoes.append("YEAR(m.dataCompetencia) = ?")
            parametros.append(ano)
        elif anos_disponiveis:
            ano_mais_recente = max(anos_disponiveis)
            condicoes.append("YEAR(m.dataCompetencia) = ?")
            parametros.append(ano_mais_recente)

        if usuario.perfil == PERFIL_CLIENTE:
            if usuario.contratanteId:
                condicoes.append("c.id = ?")
                parametros.append(usuario.contratanteId)
        else:
            if contratante:
                nomes = [
                    n.strip().upper() for n in contratante.split(",") if n.strip()
                ]
                if nomes:
                    placeholders = ",".join(["?"] * len(nomes))
                    condicoes.append(f"UPPER(TRIM(c.nome)) IN ({placeholders})")
                    parametros.extend(nomes)

            if unidade:
                unidades_list = [
                    u.strip().upper() for u in unidade.split(",") if u.strip()
                ]
                if unidades_list:
                    placeholders_u = ",".join(["?"] * len(unidades_list))
                    condicoes.append(f"UPPER(TRIM(u.nome)) IN ({placeholders_u})")
                    parametros.extend(unidades_list)

        clausula_where = ("WHERE " + " AND ".join(condicoes)) if condicoes else ""

        query = f"""
            SELECT 
                ISNULL(pc.efolha, 'PROVENTOS / DESCONTOS') AS efolha,
                ISNULL(pc.grupoConta, 'GERAL') AS grupoConta,
                ISNULL(pc.planoConta, ISNULL(m.descricao, 'OUTROS')) AS planoConta,
                ISNULL(m.nome, 'DIVERSOS') AS nome_funcionario,
                MONTH(m.dataCompetencia) AS mes,
                SUM(ISNULL(m.valor, 0)) AS total
            FROM dbo.MovimentacaoFolhaPagamento m
            LEFT JOIN dbo.PlanoContas pc ON m.planoContaId = pc.id
            LEFT JOIN dbo.Unidade u ON m.unidadeAtuacaoId = u.id
            LEFT JOIN dbo.Contratante c ON u.contratanteId = c.id
            {clausula_where}
            GROUP BY 
                pc.efolha, 
                pc.grupoConta, 
                pc.planoConta, 
                m.descricao,
                m.nome, 
                MONTH(m.dataCompetencia)
        """

        cursor.execute(query, parametros)
        linhas = cursor.fetchall()

        if not linhas:
            conexao.close()
            return {
                "sucesso": True,
                "folha": [],
                "mensagem": "Nenhum registro encontrado para estes filtros.",
            }

        estrutura = {}
        for row in linhas:
            efolha = str(row[0]).strip() if row[0] else "PROVENTOS / DESCONTOS"
            grupo_conta = str(row[1]).strip() if row[1] else "GERAL"
            plano_conta = str(row[2]).strip() if row[2] else "OUTROS"
            nome_func = str(row[3]).strip() if row[3] else "DIVERSOS"
            mes = int(row[4]) if row[4] else 1
            total_valor = float(row[5] or 0.0)

            if efolha not in estrutura:
                estrutura[efolha] = {
                    "nome": efolha,
                    "valores": [0.0] * 12,
                    "tipo": "grupo",
                    "grupos_contas": {},
                }

            if grupo_conta not in estrutura[efolha]["grupos_contas"]:
                estrutura[efolha]["grupos_contas"][grupo_conta] = {
                    "nome": grupo_conta,
                    "valores": [0.0] * 12,
                    "tipo": "subgrupo",
                    "contas": {},
                }

            if (
                plano_conta
                not in estrutura[efolha]["grupos_contas"][grupo_conta]["contas"]
            ):
                estrutura[efolha]["grupos_contas"][grupo_conta]["contas"][
                    plano_conta
                ] = {
                    "nome": plano_conta,
                    "valores": [0.0] * 12,
                    "tipo": "subgrupo",
                    "nomes": {},
                }

            if (
                nome_func
                not in estrutura[efolha]["grupos_contas"][grupo_conta]["contas"][
                    plano_conta
                ]["nomes"]
            ):
                estrutura[efolha]["grupos_contas"][grupo_conta]["contas"][
                    plano_conta
                ]["nomes"][nome_func] = {
                    "nome": nome_func,
                    "valores": [0.0] * 12,
                    "tipo": "conta_folha",
                }

            if 1 <= mes <= 12:
                idx = mes - 1
                estrutura[efolha]["valores"][idx] += total_valor
                estrutura[efolha]["grupos_contas"][grupo_conta]["valores"][
                    idx
                ] += total_valor
                estrutura[efolha]["grupos_contas"][grupo_conta]["contas"][
                    plano_conta
                ]["valores"][idx] += total_valor
                estrutura[efolha]["grupos_contas"][grupo_conta]["contas"][
                    plano_conta
                ]["nomes"][nome_func]["valores"][idx] += total_valor

        folha_final = []
        categorias_ordenadas = sorted(
            estrutura.values(),
            key=lambda item: (obter_ordem_efolha(item["nome"]), item["nome"]),
        )

        for g_efolha in categorias_ordenadas:
            g_efolha["valores"] = [round(v, 2) for v in g_efolha["valores"]]

            lista_nivel2 = sorted(
                g_efolha["grupos_contas"].values(), key=lambda x: x["nome"]
            )

            for g_conta in lista_nivel2:
                g_conta["valores"] = [round(v, 2) for v in g_conta["valores"]]

                lista_nivel3 = sorted(
                    g_conta["contas"].values(), key=lambda x: x["nome"]
                )

                for p_conta in lista_nivel3:
                    p_conta["valores"] = [
                        round(v, 2) for v in p_conta["valores"]
                    ]

                    lista_nivel4 = sorted(
                        p_conta["nomes"].values(), key=lambda x: x["nome"]
                    )
                    for item_nome in lista_nivel4:
                        item_nome["valores"] = [
                            round(v, 2) for v in item_nome["valores"]
                        ]

                    p_conta["contas"] = lista_nivel4
                    del p_conta["nomes"]

                g_conta["contas"] = lista_nivel3

            g_efolha["grupos_contas"] = lista_nivel2
            folha_final.append(g_efolha)

        conexao.close()
        return {"sucesso": True, "folha": folha_final}

    except Exception as e:
        if "conexao" in locals() and conexao:
            conexao.close()
        return {
            "sucesso": False,
            "mensagem": f"Erro ao gerar Folha de Pagamento: {str(e)}",
        }