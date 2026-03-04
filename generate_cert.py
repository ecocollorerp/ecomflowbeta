#!/usr/bin/env python
"""Generate self-signed certificate for localhost"""

import ssl
import socket
import os
from datetime import datetime, timedelta

def generate_self_signed_cert():
    """Generate a self-signed certificate for localhost"""
    cert_file = 'cert.pem'
    key_file = 'key.pem'
    
    # Check if certificates already exist
    if os.path.exists(cert_file) and os.path.exists(key_file):
        print(f"✓ Certificados já existem:")
        print(f"  - {cert_file}")
        print(f"  - {key_file}")
        return
    
    try:
        # Try to use cryptography library if available
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        # Generate certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"BR"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"SP"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, u"São Paulo"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Local Development"),
            x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow()
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName(u"localhost"),
                x509.DNSName(u"*.localhost"),
                x509.DNSName(u"127.0.0.1"),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        # Write certificate
        with open(cert_file, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        # Write private key
        with open(key_file, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        print("✓ Certificado auto-assinado gerado com sucesso!")
        print(f"✓ Certificado: {cert_file}")
        print(f"✓ Chave privada: {key_file}")
        print(f"\n✓ Válido até: {(datetime.utcnow() + timedelta(days=365)).strftime('%Y-%m-%d')}")
        print("\nO servidor rodará em: https://localhost:3000")
        print("Nota: Este é um certificado auto-assinado apenas para desenvolvimento local.")
        
    except ImportError:
        print("⚠ Erro: Biblioteca 'cryptography' não instalada")
        print("Instale com: pip install cryptography")
        exit(1)
    except Exception as e:
        print(f"✗ Erro ao gerar certificado: {e}")
        exit(1)

if __name__ == "__main__":
    generate_self_signed_cert()
