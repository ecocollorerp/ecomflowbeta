
/**
 * Utilitário para geração programática de ZPL nativo (Zebra Programming Language)
 * para DANFE Simplificada e Etiquetas de Transporte.
 */

export interface ZPLDanfeData {
    chaveAcesso: string;
    numeroNota: string;
    serie: string;
    valorTotal: number;
    emitente: {
        nome: string;
        cnpj: string;
    };
    destinatario: {
        nome: string;
        endereco: string;
        bairro: string;
        cidade: string;
        uf: string;
        cep: string;
    };
}

export interface ZPLEtiquetaData {
    transportadora: string;
    servico: string;
    rastreio: string;
    pedidoLoja?: string;
    cliente: string;
    endereco: string;
    cidadeUf: string;
    cep: string;
}

const prettyService = (s?: string) => {
    if (!s) return '';
    return String(s).replace(/[_-]/g, ' ').replace(/([A-Za-z])([0-9])/g, '$1 $2').replace(/\s+/g, ' ').trim();
}

export class ZPLGenerator {
    /**
     * Gera uma DANFE Simplificada em ZPL (Layout 100x150mm aproximadamente)
     */
    static generateDanfeSimplificada(data: ZPLDanfeData): string {
        const { chaveAcesso, numeroNota, serie, valorTotal, emitente, destinatario } = data;
        
        // Formata chave de acesso para exibição (grupos de 4)
        const chaveFormatada = chaveAcesso.replace(/(.{4})/g, '$1 ').trim();

        return `^XA
^CI28
^CF0,30
^FO50,30^FD${emitente.nome.substring(0, 35)}^FS
^CF0,20
^FO50,65^FDCNPJ: ${emitente.cnpj}^FS

^FO50,100^GB700,2,2^FS

^CF0,30
^FO250,120^FDDANFE SIMPLIFICADA^FS
^CF0,20
^FO50,160^FDNota: ${numeroNota}  Serie: ${serie}  Valor: R$ ${valorTotal.toFixed(2)}^FS

^FO50,200^GB700,2,2^FS

^CF0,25^FO50,220^FDDESTINATARIO:^FS
^CF0,20
^FO50,250^FD${destinatario.nome.substring(0, 45)}^FS
^FO50,275^FD${destinatario.endereco.substring(0, 45)}^FS
^FO50,300^FD${destinatario.bairro} - ${destinatario.cep}^FS
^FO50,325^FD${destinatario.cidade} / ${destinatario.uf}^FS

^FO50,365^GB700,2,2^FS

^CF0,20^FO50,385^FDCHAVE DE ACESSO:^FS
^FO50,410^BY2,2,80^BCN,80,Y,N,N^FD${chaveAcesso}^FS
^CF0,18^FO50,510^FD${chaveFormatada}^FS

^CF0,15^FO50,560^FDDocumento Auxiliar da Nota Fiscal Eletronica^FS
^FO50,580^FDConsulta de autenticidade no portal nacional da NF-e^FS
^FO50,600^FDwww.nfe.fazenda.gov.br^FS

^XZ`;
    }

    /**
     * Gera uma Etiqueta de Transporte em ZPL (Layout padrão Correios/Marketplace)
     */
    static generateEtiquetaTransporte(data: ZPLEtiquetaData): string {
        const { transportadora, servico, rastreio, pedidoLoja, cliente, endereco, cidadeUf, cep } = data;

        return `^XA
    ^CI28
    ^CF0,30
    ^FO50,30^FD${transportadora.substring(0, 20)} - ${prettyService(servico).substring(0, 15)}^FS

^FO50,80^GB700,2,2^FS

^FO100,100^BY3,2,100^BCN,100,Y,N,N^FD${rastreio}^FS

^CF0,25
^FO50,250^FDPedido: ${pedidoLoja || 'N/A'}^FS
^FO50,290^GB700,2,2^FS

^CF0,25^FO50,310^FDDestinatario:^FS
^CF0,30^FO50,345^FB700,1,0,L,0^FD${cliente.substring(0, 40)}^FS
^CF0,25
^FO50,385^FB700,2,0,L,0^FD${endereco.substring(0, 80)}^FS
^FO50,445^FD${cidadeUf}^FS
^CF0,40^FO50,485^FDCEP: ${cep}^FS

^FO50,550^GB700,2,2^FS
^CF0,15^FO50,570^FDGerado por EcomFlow - Sistema ERP Independente^FS
^XZ`;
    }

    /**
     * Une DANFE e Etiqueta em um único arquivo ZPL
     */
    static combine(danfeZpl: string, etiquetaZpl: string): string {
        return danfeZpl + '\n' + etiquetaZpl;
    }
}
