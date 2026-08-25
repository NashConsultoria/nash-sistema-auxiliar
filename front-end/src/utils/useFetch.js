import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../context/AuthContext';

export function useFetch(endpoint, token) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const carregar = useCallback(() => {
        if (!endpoint || !token) return;

        let ativo = true;
        setLoading(true);

        fetch(`${API_BASE}${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Erro HTTP! status: ${res.status}`);
                return res.json();
            })
            .then((dados) => {
                if (ativo) {
                    setData(dados);
                    setError(null);
                }
            })
            .catch((err) => {
                if (ativo) setError(err.message);
            })
            .finally(() => {
                if (ativo) setLoading(false);
            });

        return () => { ativo = false; };
    }, [endpoint, token]);

    useEffect(() => {
        const cancel = carregar();
        return cancel;
    }, [carregar]);

    // Retorna a lista, o estado de loading, erro e a função para refazer a requisição
    return { data, loading, error, refetch: carregar };
}