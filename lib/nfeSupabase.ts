/**
 * NFe Supabase Integration - Usando REST API Diretamente
 */

import { supabaseUrl } from './supabaseClient';

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZnNtc2l3YXhvcHh6bnVwdXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjAzMTIsImV4cCI6MjA3NDEzNjMxMn0._MGnu8LweUSinOSegxfyiKmYZJe-r54tfCPe6pIM_tI';

function normalizeNFe(record: any) {
  if (!record) return record;
  const {
    pedidoid,
    chaveacesso,
    xmloriginal,
    xmlassinado,
    sefazenvio,
    certificadousado,
    tentativasenvio,
    errodetalhes,
    criadoem,
    atualizadoem,
    ...rest
  } = record;

  return {
    ...rest,
    pedidoId: record.pedidoId ?? record.pedidoid ?? null,
    chaveAcesso: record.chaveAcesso ?? record.chaveacesso ?? null,
    xmlOriginal: record.xmlOriginal ?? record.xmloriginal ?? null,
    xmlAssinado: record.xmlAssinado ?? record.xmlassinado ?? null,
    sefazEnvio: record.sefazEnvio ?? record.sefazenvio ?? null,
    certificadoUsado: record.certificadoUsado ?? record.certificadousado ?? null,
    tentativasEnvio: record.tentativasEnvio ?? record.tentativasenvio ?? 0,
    erroDetalhes: record.erroDetalhes ?? record.errodetalhes ?? null,
    criadoEm: record.criadoEm ?? record.criadoem ?? null,
    atualizadoEm: record.atualizadoEm ?? record.atualizadoem ?? null
  };
}

export async function criarNFe(nfe: any) {
  try {
    console.log('🟡 [CREATE NFe] Iniciando...');
    console.log('🟡 [CREATE NFe] Dados recebidos:', Object.keys(nfe));

    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/inserir_nfe`;
    const url = `${supabaseUrl}/rest/v1/nfes`;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    console.log('🟡 [CREATE NFe] URL RPC:', rpcUrl);
    console.log('🟡 [CREATE NFe] URL fallback:', url);
    console.log('🟡 [CREATE NFe] Montando payload RPC...');

    const fallbackId = nfe.id || `nfe-${Date.now()}`;

    const rpcPayload = {
      v_numero: nfe.numero || '',
      v_serie: nfe.serie || '1',
      v_emissao: nfe.emissao || Date.now(),
      v_cliente: nfe.cliente || {},
      v_valor: nfe.valor || 0,
      v_pedidoid: nfe.pedidoId || null,
      v_status: nfe.status || 'RASCUNHO',
      v_chaveacesso: nfe.chaveAcesso || null,
      v_xmloriginal: nfe.xmlOriginal || null,
      v_xmlassinado: nfe.xmlAssinado || null,
      v_sefazenvio: nfe.sefazEnvio || null,
      v_certificadousado: nfe.certificadoUsado || null
    };

    console.log('🟡 [CREATE NFe] Payload RPC:', JSON.stringify(rpcPayload));

    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(rpcPayload)
    });

    const rpcResponseText = await rpcResponse.text();

    if (rpcResponse.ok) {
      const rpcData = rpcResponseText ? JSON.parse(rpcResponseText) : [];
      const created = normalizeNFe(rpcData?.[0]);
      console.log('✅ [CREATE NFe] Sucesso via RPC');
      return { sucesso: true, nfe: created };
    }

    console.warn('⚠️ [CREATE NFe] RPC indisponível/falhou, usando fallback:', rpcResponseText);

    const fallbackLowercase: any = {
      id: fallbackId,
      numero: nfe.numero || '',
      serie: nfe.serie || '1',
      emissao: nfe.emissao || Date.now(),
      cliente: nfe.cliente || {},
      valor: nfe.valor || 0,
      pedidoid: nfe.pedidoId || null,
      status: nfe.status || 'RASCUNHO'
    };

    if (nfe.chaveAcesso) fallbackLowercase.chaveacesso = nfe.chaveAcesso;
    if (nfe.xmlOriginal) fallbackLowercase.xmloriginal = nfe.xmlOriginal;
    if (nfe.xmlAssinado) fallbackLowercase.xmlassinado = nfe.xmlAssinado;
    if (nfe.sefazEnvio) fallbackLowercase.sefazenvio = nfe.sefazEnvio;
    if (nfe.certificadoUsado) fallbackLowercase.certificadousado = nfe.certificadoUsado;

    const fallbackCamelCase: any = {
      id: fallbackId,
      numero: nfe.numero || '',
      serie: nfe.serie || '1',
      emissao: nfe.emissao || Date.now(),
      cliente: nfe.cliente || {},
      valor: nfe.valor || 0,
      pedidoId: nfe.pedidoId || null,
      status: nfe.status || 'RASCUNHO'
    };

    if (nfe.chaveAcesso) fallbackCamelCase.chaveAcesso = nfe.chaveAcesso;
    if (nfe.xmlOriginal) fallbackCamelCase.xmlOriginal = nfe.xmlOriginal;
    if (nfe.xmlAssinado) fallbackCamelCase.xmlAssinado = nfe.xmlAssinado;
    if (nfe.sefazEnvio) fallbackCamelCase.sefazEnvio = nfe.sefazEnvio;
    if (nfe.certificadoUsado) fallbackCamelCase.certificadoUsado = nfe.certificadoUsado;

    const payloadAttempts = [fallbackLowercase, fallbackCamelCase];
    let lastErrorMessage = 'Erro ao inserir';

    for (const [index, payloadAttempt] of payloadAttempts.entries()) {
      console.log(`🟡 [CREATE NFe] Payload fallback tentativa ${index + 1}:`, JSON.stringify(payloadAttempt));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadAttempt)
      });

      console.log(`🟡 [CREATE NFe] Status tentativa ${index + 1}:`, response.status);
      const responseText = await response.text();
      console.log(`🟡 [CREATE NFe] Corpo tentativa ${index + 1}:`, responseText);

      if (response.ok) {
        const data = responseText ? JSON.parse(responseText) : [];
        console.log(`✅ [CREATE NFe] Sucesso via fallback tentativa ${index + 1}`);
        return { sucesso: true, nfe: normalizeNFe(data[0]) };
      }

      try {
        const parsedError = JSON.parse(responseText);
        lastErrorMessage = parsedError?.message || parsedError?.error || responseText;
      } catch {
        lastErrorMessage = responseText || 'Erro ao inserir';
      }
    }

    return { sucesso: false, erro: lastErrorMessage };
  } catch (err: any) {
    console.error('❌ [CREATE NFe] Exception:', err.message);
    console.error('❌ [CREATE NFe] Stack:', err.stack);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Obter NFe por ID
 */
export async function obterNFe(nfeId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/nfes?id=eq.${nfeId}`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return normalizeNFe(data[0]) || null;
  } catch (err: any) {
    console.error('❌ Erro ao obter NFe:', err.message);
    return null;
  }
}

/**
 * Listar NFes com filtros
 */
export async function listarNFes(filtros?: any) {
  try {
    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/listar_nfes`;
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        v_status: filtros?.status || null,
        v_pedidoid: filtros?.pedidoId || null
      })
    });

    if (rpcResponse.ok) {
      const rpcData = await rpcResponse.json();
      const normalized = (rpcData || []).map(normalizeNFe);
      return { nfes: normalized, count: normalized.length };
    }

    let url = `${supabaseUrl}/rest/v1/nfes?select=*`;
    
    if (filtros?.status) {
      url += `&status=eq.${filtros.status}`;
    }
    if (filtros?.pedidoId) {
      url += `&pedidoid=eq.${filtros.pedidoId}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Erro REST API LIST:', error);
      return { nfes: [], count: 0 };
    }

    const data = await response.json();
    const normalized = (data || []).map(normalizeNFe);
    return { nfes: normalized, count: normalized.length };
  } catch (err: any) {
    console.error('❌ Erro ao listar NFes:', err.message);
    return { nfes: [], count: 0 };
  }
}

/**
 * Atualizar NFe
 */
export async function atualizarNFe(nfeId: string, atualizacoes: any) {
  try {
    const basePayload = {
      status: atualizacoes.status,
      chaveAcesso: atualizacoes.chaveAcesso,
      xmlOriginal: atualizacoes.xmlOriginal,
      xmlAssinado: atualizacoes.xmlAssinado,
      sefazEnvio: atualizacoes.sefazEnvio,
      certificadoUsado: atualizacoes.certificadoUsado,
      erroDetalhes: atualizacoes.erroDetalhes,
      tentativasEnvio: atualizacoes.tentativasEnvio
    };

    const lowerPayload: any = {};
    const camelPayload: any = {};

    if (basePayload.status !== undefined) {
      lowerPayload.status = basePayload.status;
      camelPayload.status = basePayload.status;
    }
    if (basePayload.chaveAcesso !== undefined) {
      lowerPayload.chaveacesso = basePayload.chaveAcesso;
      camelPayload.chaveAcesso = basePayload.chaveAcesso;
    }
    if (basePayload.xmlOriginal !== undefined) {
      lowerPayload.xmloriginal = basePayload.xmlOriginal;
      camelPayload.xmlOriginal = basePayload.xmlOriginal;
    }
    if (basePayload.xmlAssinado !== undefined) {
      lowerPayload.xmlassinado = basePayload.xmlAssinado;
      camelPayload.xmlAssinado = basePayload.xmlAssinado;
    }
    if (basePayload.sefazEnvio !== undefined) {
      lowerPayload.sefazenvio = basePayload.sefazEnvio;
      camelPayload.sefazEnvio = basePayload.sefazEnvio;
    }
    if (basePayload.certificadoUsado !== undefined) {
      lowerPayload.certificadousado = basePayload.certificadoUsado;
      camelPayload.certificadoUsado = basePayload.certificadoUsado;
    }
    if (basePayload.erroDetalhes !== undefined) {
      lowerPayload.errodetalhes = basePayload.erroDetalhes;
      camelPayload.erroDetalhes = basePayload.erroDetalhes;
    }
    if (basePayload.tentativasEnvio !== undefined) {
      lowerPayload.tentativasenvio = basePayload.tentativasEnvio;
      camelPayload.tentativasEnvio = basePayload.tentativasEnvio;
    }

    const attempts = [lowerPayload, camelPayload];
    let lastError = 'Erro ao atualizar NFe';

    for (const payload of attempts) {
      const response = await fetch(`${supabaseUrl}/rest/v1/nfes?id=eq.${nfeId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      if (response.ok) {
        const data = responseText ? JSON.parse(responseText) : [];
        console.log('✅ NFe atualizada:', nfeId);
        return { sucesso: true, nfe: normalizeNFe(data[0]) };
      }

      try {
        const parsed = JSON.parse(responseText);
        lastError = parsed?.message || parsed?.error || responseText;
      } catch {
        lastError = responseText || lastError;
      }
    }

    return { sucesso: false, erro: lastError };
  } catch (err: any) {
    console.error('❌ Erro ao atualizar NFe:', err.message);
    return { sucesso: false, erro: err.message };
  }
}

export async function obterNFePorChaveAcesso(chaveAcesso: string) {
  try {
    const attempts = [
      `${supabaseUrl}/rest/v1/nfes?chaveacesso=eq.${encodeURIComponent(chaveAcesso)}&limit=1`,
      `${supabaseUrl}/rest/v1/nfes?chaveAcesso=eq.${encodeURIComponent(chaveAcesso)}&limit=1`
    ];

    for (const url of attempts) {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      if (!response.ok) continue;
      const data = await response.json();
      if (data?.[0]) {
        return normalizeNFe(data[0]);
      }
    }

    return null;
  } catch (err: any) {
    console.error('❌ Erro ao obter NFe por chave de acesso:', err.message);
    return null;
  }
}

/**
 * Deletar NFe
 */
export async function deletarNFe(nfeId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/nfes?id=eq.${nfeId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Erro REST API DELETE:', error);
      return { sucesso: false, erro: error.message };
    }

    console.log('✅ NFe deletada:', nfeId);
    return { sucesso: true };
  } catch (err: any) {
    console.error('❌ Erro ao deletar NFe:', err.message);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Obter próximo número de NFe
 */
export async function obterProximoNumeroNFe(): Promise<number> {
  try {
    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/obter_proximo_numero_nfe`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (rpcResponse.ok) {
      const rpcData = await rpcResponse.json();
      if (typeof rpcData === 'number') return rpcData;
      if (Array.isArray(rpcData) && typeof rpcData[0] === 'number') return rpcData[0];
      if (Array.isArray(rpcData) && rpcData[0]?.obter_proximo_numero_nfe) {
        return parseInt(String(rpcData[0].obter_proximo_numero_nfe), 10) || 1;
      }
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/nfes?select=numero&order=numero.desc&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) return 1;

    const data = await response.json();
    if (!data || data.length === 0) return 1;

    const ultimoNumero = parseInt(data[0].numero || '0');
    return ultimoNumero + 1;
  } catch (err: any) {
    console.error('❌ Erro ao obter próximo número:', err.message);
    return 1;
  }
}

/**
 * Contar NFes por status
 */
export async function contarNFesPorStatus(status: string): Promise<number> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/nfes?status=eq.${status}&select=id&count=exact`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact'
      }
    });

    if (!response.ok) return 0;

    const count = response.headers.get('content-range')?.split('/')[1] || '0';
    return parseInt(count);
  } catch (err: any) {
    console.error('❌ Erro ao contar NFes:', err.message);
    return 0;
  }
}
