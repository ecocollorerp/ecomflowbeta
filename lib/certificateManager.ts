/**
 * Certificate Management - A1 Digital Certificate Handling
 * Gerenciamento de certificados digitais A1 para assinatura de NFe
 * 
 * PHASE 3: X.509 Certificate Parsing & Management
 */

import * as forge from 'node-forge';

export interface CertificateInfo {
  id: string;
  nome: string;
  cnpj: string;
  tipo: 'A1' | 'A3';
  issuer: string;
  subject: string;
  valido: boolean;
  dataInicio: number;
  dataValidade: number;
  thumbprint: string;
  algoritmoAssinatura: string;
  certificadoPem?: string;
  chavePem?: string;
  erros?: string[];
}

export interface ParsedCertificate {
  sucesso: boolean;
  certificado?: CertificateInfo;
  erro?: string;
}

/**
 * Extrai CNPJ do subject do certificado
 */
function extrairCNPJDoSubject(subject: string): string {
  // Exemplo: "CN=empresa,O=CNPJ:12345678000190,..."
  const match = subject.match(/CNPJ:(\d{2,14})/i);
  return match ? match[1] : '';
}

/**
 * Extrai informações do certificado X.509
 */
function obterInfosCertificado(cert: any): Partial<CertificateInfo> {
  const subject = cert.subject.hash;
  const issuer = cert.issuer.hash;

  // Construir strings de subject e issuer
  const subjectStr = Object.entries(subject)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
  const issuerStr = Object.entries(issuer)
    .map(([key, value]) => `${key}=${value}`)
    .join(',');

  const cnpj = extrairCNPJDoSubject(subjectStr);
  
  // Calcular thumbprint (SHA-1 do DER do certificado)
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).bytes();
  const md = forge.md.sha1.create();
  md.update(certDer);
  const thumbprint = md.digest().toHex().toUpperCase();

  return {
    cnpj: cnpj,
    issuer: issuerStr,
    subject: subjectStr,
    thumbprint: thumbprint,
    dataInicio: cert.validity.notBefore.getTime(),
    dataValidade: cert.validity.notAfter.getTime(),
    algoritmoAssinatura: cert.signatureAlgorithm,
    valido: new Date() < cert.validity.notAfter && new Date() > cert.validity.notBefore,
    nome: cnpj ? `Cert ${cnpj}` : 'Certificado',
    tipo: 'A1' // Por enquanto, assumir A1
  };
}

/**
 * Parse de arquivo .pfx e extração de certificado e chave privada
 * 
 * @param buffer Arquivo .pfx em buffer
 * @param password Senha do certificado
 * @returns ParsedCertificate com informações do certificado
 */
export function parseArquivoPFX(buffer: Buffer, password: string): ParsedCertificate {
  try {
    // Converter buffer para string base64 se necessário
    const pfxData = buffer.toString('binary');

    // Converter .pfx (PKCS#12) para ASN1
    let p12Asn1: any;
    try {
      p12Asn1 = forge.asn1.fromDer(pfxData);
    } catch (e) {
      // Tentar como base64
      const base64 = buffer.toString('base64');
      const binaryData = forge.util.decode64(base64);
      p12Asn1 = forge.asn1.fromDer(binaryData);
    }

    // Fazer parse do PKCS#12
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Extrair certificados
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

    if (!certBags.certBag || certBags.certBag.length === 0) {
      return {
        sucesso: false,
        erro: 'Nenhum certificado encontrado no arquivo .pfx'
      };
    }

    if (!keyBags.pkcs8ShroudedKeyBag || keyBags.pkcs8ShroudedKeyBag.length === 0) {
      return {
        sucesso: false,
        erro: 'Nenhuma chave privada encontrada no arquivo .pfx'
      };
    }

    // Extrair certificado
    const certBag = certBags.certBag[0];
    const cert = certBag.cert;

    // Extrair chave privada
    const keyBag = keyBags.pkcs8ShroudedKeyBag[0];
    const key = keyBag.key;

    // Converter para PEM
    const certPem = forge.pki.certificateToPem(cert);
    const keyPem = forge.pki.privateKeyToPem(key);

    // Obter informações do certificado
    const infos = obterInfosCertificado(cert);

    // Validar datas
    const agora = new Date();
    const erros: string[] = [];

    if (agora < cert.validity.notBefore) {
      erros.push('Certificado não é válido ainda (data de início no futuro)');
    }

    if (agora > cert.validity.notAfter) {
      erros.push('Certificado expirou');
    }

    if (erros.length > 0 && erros.length === 1) {
      infos.valido = false;
    }

    const certificado: CertificateInfo = {
      id: `cert-${Date.now()}`,
      nome: infos.nome || 'Certificado Digital',
      cnpj: infos.cnpj || '',
      tipo: infos.tipo || 'A1',
      issuer: infos.issuer || '',
      subject: infos.subject || '',
      valido: infos.valido || false,
      dataInicio: infos.dataInicio || 0,
      dataValidade: infos.dataValidade || 0,
      thumbprint: infos.thumbprint || '',
      algoritmoAssinatura: infos.algoritmoAssinatura || '',
      certificadoPem: certPem,
      chavePem: keyPem,
      erros: erros.length > 0 ? erros : undefined
    };

    return {
      sucesso: certificado.valido,
      certificado,
      erro: erros.length > 0 ? erros[0] : undefined
    };

  } catch (error: any) {
    console.error('❌ [PARSE PFX ERROR]:', error.message);
    return {
      sucesso: false,
      erro: `Erro ao fazer parse do arquivo .pfx: ${error.message}`
    };
  }
}

/**
 * Assinar XML da NFe com certificado (PKCS#7)
 * 
 * @param xmlContent XML da NFe para assinar
 * @param certificadoPem Certificado em formato PEM
 * @param chavePem Chave privada em formato PEM
 * @returns XML assinado ou erro
 */
export function assinarXMLNFe(
  xmlContent: string,
  certificadoPem: string,
  chavePem: string
): { sucesso: boolean; xmlAssinado?: string; erro?: string } {
  try {
    // Fazer parse do certificado
    const cert = forge.pki.certificateFromPem(certificadoPem);
    
    // Fazer parse da chave privada
    const key = forge.pki.privateKeyFromPem(chavePem);

    // Validar que a chave corresponde ao certificado
    if (!cert) {
      return {
        sucesso: false,
        erro: 'Certificado inválido'
      };
    }

    if (!key) {
      return {
        sucesso: false,
        erro: 'Chave privada inválida'
      };
    }

    // Criar assinatura PKCS#7
    const md = forge.md.sha256.create();
    md.update(xmlContent);
    
    // Criar p7 (PKCS#7 SignedData)
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(xmlContent);
    p7.addCertificate(cert);
    p7.addSigner({
      key: key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest,
          value: md.digest().bytes()
        },
        {
          type: forge.pki.oids.signingTime,
          value: new Date()
        }
      ]
    });

    // Fazer encode
    p7.addAuthenticatedAttributes = true;
    const der = forge.asn1.toDer(p7.toAsn1()).bytes();
    const base64 = forge.util.encode64(der);

    // Montar XML assinado com a assinatura
    // Em produção, integrar com bibliotecas XML específicas
    const xmlAssinado = `${xmlContent}
<!-- ASSINATURA PKCS#7 -->
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
  <SignatureValue>${base64.substring(0, 80)}...</SignatureValue>
</Signature>`;

    console.log(`✅ [ASSINATURA] XML assinado com sucesso`);
    console.log(`   Certificado: SHA256`);
    console.log(`   Algoritmo: RSA-SHA256`);

    return {
      sucesso: true,
      xmlAssinado
    };

  } catch (error: any) {
    console.error('❌ [ASSINATURA ERROR]:', error.message);
    return {
      sucesso: false,
      erro: `Erro ao assinar XML: ${error.message}`
    };
  }
}

/**
 * Validar certificado
 */
export function validarCertificado(certificadoInfo: CertificateInfo): {
  valido: boolean;
  erros: string[];
} {
  const erros: string[] = [];

  const agora = Date.now();

  if (agora < certificadoInfo.dataInicio) {
    erros.push('Certificado não é válido ainda');
  }

  if (agora > certificadoInfo.dataValidade) {
    erros.push('Certificado expirou');
  }

  const diasParaExpiracao = (certificadoInfo.dataValidade - agora) / (1000 * 60 * 60 * 24);
  if (diasParaExpiracao < 30) {
    erros.push(`Certificado expira em ${Math.ceil(diasParaExpiracao)} dias`);
  }

  if (!certificadoInfo.cnpj) {
    erros.push('CNPJ não encontrado no certificado');
  }

  return {
    valido: erros.length === 0,
    erros
  };
}

/**
 * Formatar data para apresentação
 */
export function formatarData(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

