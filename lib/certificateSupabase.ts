/**
 * Certificate Supabase Integration - Usando REST API
 */

import { supabaseUrl } from './supabaseClient';

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZnNtc2l3YXhvcHh6bnVwdXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjAzMTIsImV4cCI6MjA3NDEzNjMxMn0._MGnu8LweUSinOSegxfyiKmYZJe-r54tfCPe6pIM_tI';

export async function criarCertificado(cert: any) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/certificados`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: cert.id || `cert-${Date.now()}`,
        nome: cert.nome || '',
        cnpj: cert.cnpj || '',
        tipo: cert.tipo || 'A1',
        issuer: cert.issuer || null,
        subject: cert.subject || null,
        valido: cert.valido || true,
        dataInicio: cert.dataInicio || null,
        dataValidade: cert.dataValidade || null,
        thumbprint: cert.thumbprint || null,
        algoritmoAssinatura: cert.algoritmoAssinatura || null,
        certificadoPem: cert.certificadoPem || null,
        chavePem: cert.chavePem || null,
        erros: cert.erros || null
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { sucesso: false, erro: error.message };
    }

    const data = await response.json();
    return { sucesso: true, certificado: data[0] };
  } catch (err: any) {
    console.error('❌ Erro ao criar certificado:', err.message);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Obter certificado por ID
 */
export async function obterCertificado(certId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/certificados?id=eq.${certId}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data[0] || null;
  } catch (err: any) {
    console.error('❌ Erro ao obter certificado:', err.message);
    return null;
  }
}

/**
 * Listar certificados válidos
 */
export async function listarCertificados(apenasValidos: boolean = true) {
  try {
    let url = `${supabaseUrl}/rest/v1/certificados?select=*`;
    if (apenasValidos) {
      url += `&valido=eq.true`;
    }

    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) return [];
    const data = await response.json();
    return data || [];
  } catch (err: any) {
    console.error('❌ Erro ao listar certificados:', err.message);
    return [];
  }
}

/**
 * Obter certificado por CNPJ
 */
export async function obterCertificadoPorCNPJ(cnpj: string) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/certificados?cnpj=eq.${cnpj}&valido=eq.true&limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data[0] || null;
  } catch (err: any) {
    console.error('❌ Erro ao obter certificado por CNPJ:', err.message);
    return null;
  }
}

/**
 * Atualizar certificado
 */
export async function atualizarCertificado(certId: string, atualizacoes: any) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/certificados?id=eq.${certId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(atualizacoes)
    });

    if (!response.ok) {
      const error = await response.json();
      return { sucesso: false, erro: error.message };
    }

    const data = await response.json();
    return { sucesso: true, certificado: data[0] };
  } catch (err: any) {
    console.error('❌ Erro ao atualizar certificado:', err.message);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Deletar certificado
 */
export async function deletarCertificado(certId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/certificados?id=eq.${certId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return { sucesso: false, erro: error.message };
    }

    return { sucesso: true };
  } catch (err: any) {
    console.error('❌ Erro ao deletar certificado:', err.message);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Contar certificados
 */
export async function contarCertificados(): Promise<number> {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/certificados?select=id&count=exact`, {
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
    console.error('❌ Erro ao contar certificados:', err.message);
    return 0;
  }
}
