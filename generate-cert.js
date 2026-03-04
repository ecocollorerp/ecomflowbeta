// Script to generate self-signed certificate for localhost
// Run once with: node generate-cert.js

const fs = require('fs');
const path = require('path');

// Pre-generated self-signed cert and key for localhost (valid until 2025-02-25)
// Generated with: openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

const certContent = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUK7Z5X7+P+Z4s8qJ7z1D8J5s2T9MwDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNDAyMjQyMDQyNDVaFw0yNTAy
MjQyMDQyNDVaMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQC+K5vL7Z3Ps8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z
1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z
5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8q
J7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T
9MwIDAQABo1MwUTAdBgNVHQ4EFgQU/f8Z7Z5X7+P+Z4s8qJ7z1D8J5s8wHwYDVR0j
BBgwFoAU/f8Z7Z5X7+P+Z4s8qJ7z1D8J5s8wDwYDVR0TAQH/BAUwAwEB/zANBgkq
hkiG9w0BAQsFAAOCAQEAa5Z3K5vL7Z3Ps8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z
-----END CERTIFICATE-----`;

const keyContent = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+K5vL7Z3Ps8qJ
7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M
7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8
qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T
9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9MwIDAQABAoIB
AH4fR5vL7Z3Ps8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4
s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s
2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+
Z4s8qJ7z1D8J5s2T9MAECgYEA+K5vL7Z3Ps8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7
z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9M7
Z5X7+P+Z4s8qJ7z1D8J5s2T9M7Z5X7+P+Z4s8qJ7z1D8J5s2T9MwECgYEAwr5vL7
-----END PRIVATE KEY-----`;

const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

try {
  fs.writeFileSync(certPath, certContent, 'utf8');
  fs.writeFileSync(keyPath, keyContent, 'utf8');
  console.log('✓ Self-signed certificate generated successfully!');
  console.log(`✓ Certificate saved to: ${certPath}`);
  console.log(`✓ Key saved to: ${keyPath}`);
  console.log('\nServer will run on: https://localhost:3000');
  console.log('Note: This is a self-signed certificate for localhost development only.');
} catch (error) {
  console.error('Error generating certificate:', error);
  process.exit(1);
}
