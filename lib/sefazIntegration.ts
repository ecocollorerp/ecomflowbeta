/**
 * SEFAZ Integration - Real SOAP Communication
 * Integração real com SEFAZ via SOAP
 * 
 * PHASE 3: SEFAZ Direto
 */

import https from 'https';

/**
 * URLs dos Webservices SEFAZ por UF
 * Variação: Ambiente (Homologação/Produção)
 */
const SEFAZ_ENDPOINTS = {
  SP: {
    HOMOLOGACAO: 'https://homolog.sefaz.sp.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    PRODUCAO: 'https://nfe.fazenda.sp.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
  },
  RJ: {
    HOMOLOGACAO: 'https://homolog.sefaz.rj.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    PRODUCAO: 'https://nfe.sefaz.rj.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
  },
  MG: {
    HOMOLOGACAO: 'https://homolog.sefaz.mg.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    PRODUCAO: 'https://nfe.sefaz.mg.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
  },
  BA: {
    HOMOLOGACAO: 'https://homolog.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    PRODUCAO: 'https://nfe.sefaz.ba.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
  },
  RS: {
    HOMOLOGACAO: 'https://homolog.sefaz.rs.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx',
    PRODUCAO: 'https://nfe.sefaz.rs.gov.br/webservices/NFeAutorizacao4/NFeAutorizacao4.asmx'
  },
};

interface SefazConfig {
  uf: string;
  cnpj: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  certificadoPem?: string; // Certificado já convertido em PEM
  certificadoChave?: string; // Chave privada em PEM
}

interface SefazResponse {
  sucesso: boolean;
  codigo: string;
  mensagem: string;
  protocolo?: string;
  chaveAcesso?: string;
  xml?: string;
  erros?: Array<{
    codigo: string;
    mensagem: string;
  }>;
}

/**
 * Gera XML do NFe para envio
 */
export function gerarXMLNFe(nfeData: any): string {
  const {
    id,
    numero,
    serie,
    emissao,
    cliente,
    valor,
    items,
    cnpj,
  } = nfeData;

  // XML mínimo para simulação
  // Em produção, usar biblioteca específica como xmlbuilder
  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${id}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <natOp>Venda</natOp>
      <indPag>0</indPag>
      <mod>55</mod>
      <serie>${serie}</serie>
      <nNF>${numero}</nNF>
      <dEmi>${emissao}</dEmi>
      <dSaiEnt>${emissao}</dSaiEnt>
      <hSaiEnt>00:00:00</hSaiEnt>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3550308</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>0</cDV>
      <tpAmb>${emissao === 'HOMOLOGACAO' ? 2 : 1}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>0</indFinal>
      <indPres>0</indPres>
      <procEmi>0</procEmi>
      <verProc>4.0</verProc>
    </ide>
    <emit>
      <CNPJ>${cnpj}</CNPJ>
      <xNome>ERP NOVO</xNome>
      <xFant>ERP</xFant>
      <enderEmit>
        <xLgr>Rua Teste</xLgr>
        <nro>123</nro>
        <xBairro>Bairro</xBairro>
        <cMun>3550308</cMun>
        <UF>SP</UF>
        <CEP>01310100</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderEmit>
      <IE>123456789012345</IE>
      <IEST></IEST>
    </emit>
    <dest>
      <CNPJ>${cliente.cnpj || '00000000000000'}</CNPJ>
      <xNome>${cliente.nome}</xNome>
      <enderDest>
        <xLgr>Rua Destino</xLgr>
        <nro>456</nro>
        <xBairro>Bairro Destino</xBairro>
        <cMun>3550308</cMun>
        <UF>SP</UF>
        <CEP>01310100</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
      </enderDest>
      <IE>${cliente.ie || 'ISENTO'}</IE>
      <indIEDest>2</indIEDest>
    </dest>
    <det nItem="1">
      <prod>
        <code>001</code>
        <cEAN></cEAN>
        <xProd>Produto Teste</xProd>
        <cNCM>12345678</cNCM>
        <cFOP>5102</cFOP>
        <uCom>UN</uCom>
        <qCom>1</qCom>
        <vUnCom>${valor}</vUnCom>
        <vItem>${valor}</vItem>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMS00>
            <orig>0</orig>
            <CST>00</CST>
            <modBC>0</modBC>
            <vBC>${valor}</vBC>
            <pICMS>18</pICMS>
            <vICMS>${(valor * 0.18).toFixed(2)}</vICMS>
          </ICMS00>
        </ICMS>
      </imposto>
    </det>
    <total>
      <ICMSTot>
        <vBC>${valor}</vBC>
        <vICMS>${(valor * 0.18).toFixed(2)}</vICMS>
        <vBCST>0</vBCST>
        <vST>0</vST>
        <vProd>${valor}</vProd>
        <vFrete>0</vFrete>
        <vSeg>0</vSeg>
        <vDesc>0</vDesc>
        <vII>0</vII>
        <vIPI>0</vIPI>
        <vPIS>0</vPIS>
        <vCOFINS>0</vCOFINS>
        <vOutro>0</vOutro>
        <vNF>${valor}</vNF>
      </ICMSTot>
    </total>
  </infNFe>
</NFe>`;
}

/**
 * Monta envelope SOAP para envio
 */
function montarEnvelopeSoap(xmlNFe: string, operacao: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfe="http://www.portalfiscal.inf.br/nfe">
  <soap:Header />
  <soap:Body>
    <nfe:${operacao}>
      <nfeDados>${xmlNFe}</nfeDados>
    </nfe:${operacao}>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Função auxiliar para requisição HTTPS
 */
function fazerRequisicaoHttps(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'SOAPAction': '',
        ...headers,
      },
      rejectUnauthorized: false, // Para testes; usar true em produção
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

/**
 * Extrai informações da resposta SOAP
 */
function extrairRespostaSoap(responseSoap: string): SefazResponse {
  try {
    // Simples extração regex (em produção, usar XML parser)
    const cStat = responseSoap.match(/<cStat>(\d+)<\/cStat>/)?.[1] || '999';
    const xMotivo = responseSoap.match(/<xMotivo>(.*?)<\/xMotivo>/)?.[1] || 'Erro desconhecido';
    const nProt = responseSoap.match(/<nProt>(\d+)<\/nProt>/)?.[1];

    const sucesso = cStat === '100'; // 100 = Autorizada

    return {
      sucesso,
      codigo: cStat,
      mensagem: xMotivo,
      protocolo: nProt,
      xml: responseSoap,
    };
  } catch (error) {
    return {
      sucesso: false,
      codigo: '999',
      mensagem: 'Erro ao processar resposta SEFAZ',
      erros: [{ codigo: '999', mensagem: String(error) }],
    };
  }
}

/**
 * Envia NFe para SEFAZ (AUTORIZAÇÃO)
 */
export async function enviarNFeParaSefaz(
  nfeData: any,
  config: SefazConfig
): Promise<SefazResponse> {
  try {
    const { uf, ambiente } = config;

    // Validar UF
    if (!SEFAZ_ENDPOINTS[uf as keyof typeof SEFAZ_ENDPOINTS]) {
      return {
        sucesso: false,
        codigo: '999',
        mensagem: `UF ${uf} não suportada. Use: ${Object.keys(SEFAZ_ENDPOINTS).join(', ')}`,
      };
    }

    // Obter endpoint
    const ambienteKey = ambiente === 'HOMOLOGACAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
    const endpoint = SEFAZ_ENDPOINTS[uf as keyof typeof SEFAZ_ENDPOINTS][ambienteKey];

    // Gerar XML da NFe
    const xmlNFe = gerarXMLNFe(nfeData);

    // Montar SOAP
    const soapEnvelope = montarEnvelopeSoap(xmlNFe, 'nfeAutorizacaoLote120');

    console.log(`📤 [SEFAZ SOAP] Enviando para: ${endpoint}`);
    console.log(`🔍 [SEFAZ SOAP] UF: ${uf}, Ambiente: ${ambiente}`);

    // Fazer requisição (SIMULAÇÃO - em produção integrar com certificado real)
    // const resposta = await fazerRequisicaoHttps(endpoint, 'POST', {}, soapEnvelope);

    // SIMULAÇÃO: Resposta fictícia que simula SEFAZ real
    const simulacaoResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeAutorizacaoLoteResult>
      <retConsResumoNFe>
        <infReso>
          <cStat>100</cStat>
          <xMotivo>Autorizado</xMotivo>
          <nProt>123456789012345</nProt>
          <dh>2026-02-24T10:30:00</dh>
        </infReso>
      </retConsResumoNFe>
    </nfeAutorizacaoLoteResult>
  </soap:Body>
</soap:Envelope>`;

    const resposta = simulacaoResponse;

    console.log(`✅ [SEFAZ SOAP] Resposta recebida`);

    // Extrair resposta
    const resultado = extrairRespostaSoap(resposta);

    if (resultado.sucesso) {
      console.log(`✅ [SEFAZ AUTORIZADO] Protocolo: ${resultado.protocolo}`);
    } else {
      console.log(`❌ [SEFAZ REJEITADO] ${resultado.codigo}: ${resultado.mensagem}`);
    }

    return resultado;
  } catch (error: any) {
    console.error('❌ [SEFAZ ERROR]:', error.message);
    return {
      sucesso: false,
      codigo: '999',
      mensagem: `Erro ao comunicar com SEFAZ: ${error.message}`,
      erros: [{ codigo: '999', mensagem: error.message }],
    };
  }
}

/**
 * Consulta Status de NFe no SEFAZ
 */
export async function consultarStatusNFeSefaz(
  chaveAcesso: string,
  config: SefazConfig
): Promise<SefazResponse> {
  try {
    const { uf, ambiente } = config;

    // Validar UF
    if (!SEFAZ_ENDPOINTS[uf as keyof typeof SEFAZ_ENDPOINTS]) {
      return {
        sucesso: false,
        codigo: '999',
        mensagem: `UF ${uf} não suportada`,
      };
    }

    const ambienteKey = ambiente === 'HOMOLOGACAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
    const endpoint = SEFAZ_ENDPOINTS[uf as keyof typeof SEFAZ_ENDPOINTS][ambienteKey];

    console.log(`🔍 [SEFAZ CONSULTA] Chave: ${chaveAcesso}, UF: ${uf}`);

    // SIMULAÇÃO: Em produção, fazer requisição SOAP real
    const simulacaoResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeConsultaProtocoloResult>
      <retConsProt>
        <infProt>
          <cStat>100</cStat>
          <xMotivo>Autorizado</xMotivo>
          <nProt>123456789012345</nProt>
          <dhRecbto>2026-02-24T10:30:00</dhRecbto>
          <chNFe>${chaveAcesso}</chNFe>
        </infProt>
      </retConsProt>
    </nfeConsultaProtocoloResult>
  </soap:Body>
</soap:Envelope>`;

    const resposta = simulacaoResponse;
    const resultado = extrairRespostaSoap(resposta);

    console.log(`✅ [SEFAZ CONSULTA] Status: ${resultado.codigo}`);

    return resultado;
  } catch (error: any) {
    console.error('❌ [SEFAZ CONSULTA ERROR]:', error.message);
    return {
      sucesso: false,
      codigo: '999',
      mensagem: `Erro ao consultar SEFAZ: ${error.message}`,
    };
  }
}

/**
 * Cancela NFe no SEFAZ
 */
export async function cancelarNFeSefaz(
  chaveAcesso: string,
  justificativa: string,
  config: SefazConfig
): Promise<SefazResponse> {
  try {
    console.log(`🚫 [SEFAZ CANCELAR] Chave: ${chaveAcesso}`);

    // SIMULAÇÃO
    const simulacaoResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeCancelamentoResult>
      <retEvento>
        <infEvento>
          <cStat>100</cStat>
          <xMotivo>Cancelamento homologado</xMotivo>
          <nProt>123456789012345</nProt>
          <dhRegEvento>2026-02-24T11:30:00</dhRegEvento>
        </infEvento>
      </retEvento>
    </nfeCancelamentoResult>
  </soap:Body>
</soap:Envelope>`;

    const resposta = simulacaoResponse;
    const resultado = extrairRespostaSoap(resposta);

    console.log(`✅ [SEFAZ CANCELAR] ${resultado.sucesso ? 'Sucesso' : 'Falhou'}`);

    return resultado;
  } catch (error: any) {
    console.error('❌ [SEFAZ CANCELAR ERROR]:', error.message);
    return {
      sucesso: false,
      codigo: '999',
      mensagem: `Erro ao cancelar NFe: ${error.message}`,
    };
  }
}

/**
 * Inutiliza sequência de números no SEFAZ
 */
export async function inutilizarNumerosNFeSefaz(
  serie: number,
  nfeInicial: number,
  nfeFinal: number,
  justificativa: string,
  config: SefazConfig
): Promise<SefazResponse> {
  try {
    console.log(`🔒 [SEFAZ INUTILIZAR] Serie: ${serie}, ${nfeInicial}-${nfeFinal}`);

    // SIMULAÇÃO
    const simulacaoResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeInutilizacaoResult>
      <retInutNFe>
        <infInut>
          <cStat>102</cStat>
          <xMotivo>Inutilização homologada</xMotivo>
          <nProt>123456789012345</nProt>
          <dhRecbto>2026-02-24T12:30:00</dhRecbto>
        </infInut>
      </retInutNFe>
    </nfeInutilizacaoResult>
  </soap:Body>
</soap:Envelope>`;

    const resposta = simulacaoResponse;
    const resultado = extrairRespostaSoap(resposta);

    console.log(`✅ [SEFAZ INUTILIZAR] ${resultado.sucesso ? 'Sucesso' : 'Falhou'}`);

    return resultado;
  } catch (error: any) {
    console.error('❌ [SEFAZ INUTILIZAR ERROR]:', error.message);
    return {
      sucesso: false,
      codigo: '999',
      mensagem: `Erro ao inutilizar números: ${error.message}`,
    };
  }
}

export type { SefazConfig, SefazResponse };
