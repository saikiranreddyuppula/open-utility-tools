import { yamlToJson } from '../data/yaml';

export type DeveloperToolFieldType = 'text' | 'textarea' | 'select' | 'checkbox';

export interface DeveloperToolFieldOption {
  label: string;
  value: string;
}

export interface DeveloperToolField {
  id: string;
  label: string;
  type: DeveloperToolFieldType;
  defaultValue: string;
  placeholder?: string;
  rows?: number;
  options?: readonly DeveloperToolFieldOption[];
}

export interface DeveloperToolDefinition {
  slug: string;
  name: string;
  description: string;
  category: 'web' | 'crypto' | 'data' | 'encoding' | 'generators';
  icon: string;
  tags: readonly string[];
  keywords: readonly string[];
  relatedTools: readonly string[];
  kind: DeveloperToolKind;
  fields: readonly DeveloperToolField[];
}

export interface DeveloperToolSection {
  title: string;
  body: string;
  language?: 'json' | 'xml' | 'html' | 'shell' | 'yaml' | 'text';
}

export interface DeveloperToolResult {
  title: string;
  summary: string;
  output: string;
  outputLanguage?: DeveloperToolSection['language'];
  stats: readonly string[];
  warnings: readonly string[];
  sections: readonly DeveloperToolSection[];
}

type DeveloperToolKind =
  | 'saml-request-decoder'
  | 'saml-response-decoder'
  | 'saml-redirect-binding-builder'
  | 'saml-post-form-generator'
  | 'saml-metadata-parser'
  | 'saml-metadata-builder-sp'
  | 'saml-metadata-builder-idp'
  | 'saml-assertion-inspector'
  | 'saml-condition-time-validator'
  | 'saml-signature-reference-inspector'
  | 'saml-attribute-mapper'
  | 'oidc-discovery-inspector'
  | 'oidc-id-token-validator'
  | 'oauth-pkce-generator'
  | 'oauth-authorization-url-builder'
  | 'oauth-token-response-inspector'
  | 'jwks-inspector'
  | 'jwk-rotation-diff'
  | 'scim-user-payload-builder'
  | 'scim-filter-tester'
  | 'soap-envelope-builder'
  | 'soap-request-debugger'
  | 'wsdl-operation-explorer'
  | 'wsdl-to-sample-soap'
  | 'soap-fault-parser'
  | 'soap-action-header-builder'
  | 'http-request-replay-sanitizer'
  | 'postman-collection-viewer'
  | 'openapi-validator-linter'
  | 'openapi-breaking-change-diff'
  | 'openapi-schema-example-generator'
  | 'openapi-security-scheme-inspector'
  | 'asyncapi-validator-preview'
  | 'cloudevents-validator'
  | 'webhook-signature-verifier'
  | 'webhook-retry-schedule-calculator'
  | 'graphql-introspection-viewer'
  | 'graphql-operation-complexity-estimator'
  | 'graphql-variables-validator'
  | 'grpc-proto-viewer'
  | 'grpcurl-command-builder'
  | 'protobuf-binary-decoder'
  | 'protobuf-json-converter'
  | 'mqtt-topic-matcher'
  | 'kafka-message-header-viewer'
  | 'avro-schema-validator'
  | 'avro-schema-evolution-checker'
  | 'json-schema-compatibility-diff'
  | 'http-multipart-form-data-builder'
  | 'server-sent-events-event-parser'
  | 'dns-record-dig-ui'
  | 'dns-propagation-comparison'
  | 'dns-zone-file-validator'
  | 'dnssec-chain-visualizer'
  | 'spf-record-builder'
  | 'spf-flattening-analyzer'
  | 'dkim-record-decoder'
  | 'dmarc-record-builder'
  | 'dmarc-report-xml-parser'
  | 'bimi-record-checker'
  | 'mta-sts-policy-checker'
  | 'tls-rpt-record-builder'
  | 'certificate-decoder-x509'
  | 'certificate-chain-builder'
  | 'csr-generator-validator'
  | 'ocsp-response-decoder'
  | 'tls-cipher-suite-explainer'
  | 'hsts-preload-checker'
  | 'security-headers-auditor'
  | 'subresource-integrity-generator';

type Values = Record<string, string>;

interface RawDefinition {
  slug: string;
  name: string;
  description: string;
  category?: DeveloperToolDefinition['category'];
  icon?: string;
  tags: readonly string[];
  keywords?: readonly string[];
  relatedTools?: readonly string[];
  kind?: DeveloperToolKind;
  fields?: readonly DeveloperToolField[];
}

const SAMPLE_SAML_RESPONSE = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" Destination="https://app.example.com/saml/acs" IssueInstant="2026-06-03T12:00:00Z">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
    <saml:Subject><saml:NameID>ada@example.com</saml:NameID></saml:Subject>
    <saml:Conditions NotBefore="2026-06-03T11:55:00Z" NotOnOrAfter="2026-06-03T12:05:00Z">
      <saml:AudienceRestriction><saml:Audience>urn:example:sp</saml:Audience></saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AttributeStatement>
      <saml:Attribute Name="email"><saml:AttributeValue>ada@example.com</saml:AttributeValue></saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

const SAMPLE_SAML_METADATA = `<EntityDescriptor entityID="https://idp.example.com" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing"><KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><X509Data><X509Certificate>MIID...</X509Certificate></X509Data></KeyInfo></KeyDescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;

const SAMPLE_OPENAPI = `{
  "openapi": "3.1.0",
  "info": { "title": "Example API", "version": "1.0.0" },
  "paths": {
    "/users": { "get": { "responses": { "200": { "description": "OK" } } } }
  },
  "components": {
    "securitySchemes": { "bearer": { "type": "http", "scheme": "bearer" } }
  }
}`;

const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIBlzCCAT2gAwIBAgIUTkVFRF9SRUFMX0NFUlRfUEFTVEVfSEVSRTANBgkqhkiG
9w0BAQsFADAaMRgwFgYDVQQDDA9leGFtcGxlLmxvY2FsIENBMB4XDTI2MDYwMTAw
MDAwMFoXDTI2MDcwMTAwMDAwMFowFTETMBEGA1UEAwwKZXhhbXBsZS5jb20wXDAN
BgkqhkiG9w0BAQEFAANLADBIAkEA0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIDAQABMA0G
CSqGSIb3DQEBCwUAA0EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==
-----END CERTIFICATE-----`;

function textField(defaultValue = '', placeholder = 'Paste input here...', rows = 14): DeveloperToolField[] {
  return [{ id: 'input', label: 'Input', type: 'textarea', defaultValue, placeholder, rows }];
}

function twoTextFields(a: DeveloperToolField, b: DeveloperToolField): DeveloperToolField[] {
  return [a, b];
}

const defs: readonly RawDefinition[] = [
  { slug: 'saml-request-decoder', name: 'SAML Request Decoder', description: 'Decode a SAMLRequest from URL, query string, or form input and inspect the XML.', tags: ['saml', 'sso', 'decode', 'xml'], keywords: ['samlrequest', 'redirect binding', 'base64', 'deflate'], icon: 'ShieldCheck', fields: textField('SAMLRequest=PHNhbWxwOkF1dGhuUmVxdWVzdCBJRD0iYWJjIiBWZXJzaW9uPSIyLjAiIC8+', 'Paste a SAMLRequest value, query string, or URL') },
  { slug: 'saml-response-decoder', name: 'SAML Response Decoder', description: 'Decode a SAMLResponse payload and extract assertion, issuer, audience, and subject details.', tags: ['saml', 'sso', 'response', 'assertion'], keywords: ['samlresponse', 'assertion', 'base64', 'xml'], icon: 'ShieldCheck', fields: textField(encodeBase64(SAMPLE_SAML_RESPONSE), 'Paste a SAMLResponse value or XML') },
  { slug: 'saml-redirect-binding-builder', name: 'SAML Redirect Binding Builder', description: 'Build the URL parameters used by SAML HTTP-Redirect binding.', tags: ['saml', 'redirect', 'binding', 'sso'], keywords: ['saml redirect', 'relaystate', 'samlrequest'], icon: 'Route', fields: [
    { id: 'endpoint', label: 'SSO endpoint', type: 'text', defaultValue: 'https://idp.example.com/sso' },
    { id: 'messageName', label: 'Message parameter', type: 'select', defaultValue: 'SAMLRequest', options: [{ label: 'SAMLRequest', value: 'SAMLRequest' }, { label: 'SAMLResponse', value: 'SAMLResponse' }] },
    { id: 'input', label: 'SAML XML', type: 'textarea', rows: 12, defaultValue: '<samlp:AuthnRequest ID="abc" Version="2.0" IssueInstant="2026-06-03T12:00:00Z" />' },
    { id: 'relayState', label: 'RelayState', type: 'text', defaultValue: 'return=/dashboard' },
  ] },
  { slug: 'saml-post-form-generator', name: 'SAML POST Form Generator', description: 'Generate a local HTML form for SAML HTTP-POST binding.', tags: ['saml', 'post', 'html', 'sso'], keywords: ['saml post binding', 'autosubmit form'], icon: 'FileCode', fields: [
    { id: 'endpoint', label: 'ACS or SSO URL', type: 'text', defaultValue: 'https://app.example.com/saml/acs' },
    { id: 'messageName', label: 'Message parameter', type: 'select', defaultValue: 'SAMLResponse', options: [{ label: 'SAMLResponse', value: 'SAMLResponse' }, { label: 'SAMLRequest', value: 'SAMLRequest' }] },
    { id: 'input', label: 'SAML XML', type: 'textarea', rows: 12, defaultValue: SAMPLE_SAML_RESPONSE },
    { id: 'relayState', label: 'RelayState', type: 'text', defaultValue: 'return=/dashboard' },
  ] },
  { slug: 'saml-metadata-parser', name: 'SAML Metadata Parser', description: 'Parse SAML entity metadata and list endpoints, certs, bindings, and entity IDs.', tags: ['saml', 'metadata', 'xml', 'sso'], icon: 'FileSearch', fields: textField(SAMPLE_SAML_METADATA, 'Paste SAML metadata XML') },
  { slug: 'saml-metadata-builder-sp', name: 'SAML SP Metadata Builder', description: 'Build service provider metadata for a SAML integration.', tags: ['saml', 'metadata', 'sp', 'xml'], icon: 'FilePlus', fields: [
    { id: 'entityId', label: 'SP entityID', type: 'text', defaultValue: 'urn:example:sp' },
    { id: 'acsUrl', label: 'ACS URL', type: 'text', defaultValue: 'https://app.example.com/saml/acs' },
    { id: 'sloUrl', label: 'SLO URL', type: 'text', defaultValue: 'https://app.example.com/saml/logout' },
    { id: 'nameIdFormat', label: 'NameID format', type: 'text', defaultValue: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress' },
    { id: 'certificate', label: 'Signing certificate', type: 'textarea', rows: 8, defaultValue: '' },
  ] },
  { slug: 'saml-metadata-builder-idp', name: 'SAML IdP Metadata Builder', description: 'Build identity provider metadata with SSO endpoints and signing certificate.', tags: ['saml', 'metadata', 'idp', 'xml'], icon: 'FilePlus', fields: [
    { id: 'entityId', label: 'IdP entityID', type: 'text', defaultValue: 'https://idp.example.com' },
    { id: 'ssoUrl', label: 'SSO URL', type: 'text', defaultValue: 'https://idp.example.com/sso' },
    { id: 'sloUrl', label: 'SLO URL', type: 'text', defaultValue: 'https://idp.example.com/logout' },
    { id: 'certificate', label: 'Signing certificate', type: 'textarea', rows: 8, defaultValue: '' },
  ] },
  { slug: 'saml-assertion-inspector', name: 'SAML Assertion Inspector', description: 'Extract subject, issuer, audience, session, and attributes from a SAML assertion.', tags: ['saml', 'assertion', 'attributes', 'sso'], icon: 'FileSearch', fields: textField(SAMPLE_SAML_RESPONSE, 'Paste assertion or full SAML response XML') },
  { slug: 'saml-condition-time-validator', name: 'SAML Condition Time Validator', description: 'Validate NotBefore and NotOnOrAfter timestamps with configurable clock skew.', tags: ['saml', 'time', 'condition', 'sso'], icon: 'Clock', fields: [
    { id: 'input', label: 'SAML XML', type: 'textarea', rows: 12, defaultValue: SAMPLE_SAML_RESPONSE },
    { id: 'skewSeconds', label: 'Clock skew seconds', type: 'text', defaultValue: '120' },
  ] },
  { slug: 'saml-signature-reference-inspector', name: 'SAML Signature Reference Inspector', description: 'Inspect XML Signature methods, references, transforms, digests, and embedded certs.', tags: ['saml', 'signature', 'xml', 'security'], icon: 'Fingerprint', fields: textField(SAMPLE_SAML_RESPONSE, 'Paste signed SAML XML') },
  { slug: 'saml-attribute-mapper', name: 'SAML Attribute Mapper', description: 'Map SAML attributes to app claims using a simple mapping table.', tags: ['saml', 'attributes', 'mapping', 'sso'], icon: 'Shuffle', fields: [
    { id: 'input', label: 'SAML XML', type: 'textarea', rows: 12, defaultValue: SAMPLE_SAML_RESPONSE },
    { id: 'mapping', label: 'Mapping lines', type: 'textarea', rows: 8, defaultValue: 'email=email\nfirstName=givenName\nlastName=sn\ngroups=memberOf' },
  ] },
  { slug: 'oidc-discovery-inspector', name: 'OIDC Discovery Inspector', description: 'Parse OpenID Connect discovery metadata and summarize endpoints, algorithms, and grants.', tags: ['oidc', 'openid', 'oauth', 'json'], icon: 'Compass', fields: textField('{"issuer":"https://idp.example.com","authorization_endpoint":"https://idp.example.com/oauth2/v1/authorize","token_endpoint":"https://idp.example.com/oauth2/v1/token","jwks_uri":"https://idp.example.com/oauth2/v1/keys","response_types_supported":["code"],"id_token_signing_alg_values_supported":["RS256"]}', 'Paste .well-known/openid-configuration JSON') },
  { slug: 'oidc-id-token-validator', name: 'OIDC ID Token Validator', description: 'Decode an ID token and check issuer, audience, nonce, expiry, and clock claims.', tags: ['oidc', 'jwt', 'token', 'auth'], icon: 'ShieldCheck', fields: [
    { id: 'token', label: 'ID token', type: 'textarea', rows: 8, defaultValue: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImsxIn0.eyJpc3MiOiJodHRwczovL2lkcC5leGFtcGxlLmNvbSIsImF1ZCI6ImNsaWVudC0xMjMiLCJzdWIiOiJhZGEiLCJleHAiOjk5OTk5OTk5OTksImlhdCI6MTc4MDQ4ODAwMCwibm9uY2UiOiJuLTEyMyJ9.signature' },
    { id: 'issuer', label: 'Expected issuer', type: 'text', defaultValue: 'https://idp.example.com' },
    { id: 'audience', label: 'Expected audience', type: 'text', defaultValue: 'client-123' },
    { id: 'nonce', label: 'Expected nonce', type: 'text', defaultValue: 'n-123' },
  ] },
  { slug: 'oauth-pkce-generator', name: 'OAuth PKCE Generator', description: 'Generate a PKCE verifier and S256 code challenge for OAuth authorization code flows.', category: 'generators', tags: ['oauth', 'pkce', 'security', 'generator'], icon: 'KeyRound', fields: [
    { id: 'length', label: 'Verifier length', type: 'select', defaultValue: '64', options: [{ label: '43', value: '43' }, { label: '64', value: '64' }, { label: '96', value: '96' }, { label: '128', value: '128' }] },
  ] },
  { slug: 'oauth-authorization-url-builder', name: 'OAuth Authorization URL Builder', description: 'Build OAuth 2.0 or OIDC authorization URLs with scopes, PKCE, state, and nonce.', tags: ['oauth', 'oidc', 'url', 'auth'], icon: 'Link', fields: [
    { id: 'endpoint', label: 'Authorization endpoint', type: 'text', defaultValue: 'https://idp.example.com/oauth2/v1/authorize' },
    { id: 'clientId', label: 'Client ID', type: 'text', defaultValue: 'client-123' },
    { id: 'redirectUri', label: 'Redirect URI', type: 'text', defaultValue: 'https://app.example.com/callback' },
    { id: 'scope', label: 'Scope', type: 'text', defaultValue: 'openid profile email' },
    { id: 'state', label: 'State', type: 'text', defaultValue: 'csrf-state-123' },
    { id: 'nonce', label: 'Nonce', type: 'text', defaultValue: 'nonce-123' },
    { id: 'codeChallenge', label: 'PKCE challenge', type: 'text', defaultValue: '' },
  ] },
  { slug: 'oauth-token-response-inspector', name: 'OAuth Token Response Inspector', description: 'Inspect an OAuth token response, token types, scopes, and expiry.', tags: ['oauth', 'token', 'json', 'auth'], icon: 'Key', fields: textField('{"access_token":"eyJhbGciOiJSUzI1NiJ9.eyJzY29wZSI6InJlYWQgd3JpdGUiLCJleHAiOjk5OTk5OTk5OTl9.sig","token_type":"Bearer","expires_in":3600,"scope":"read write","id_token":"eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZGEifQ.sig"}', 'Paste token response JSON') },
  { slug: 'jwks-inspector', name: 'JWKS Inspector', description: 'Inspect JSON Web Key Sets, key IDs, algorithms, use, key type, and rotation readiness.', category: 'crypto', tags: ['jwks', 'jwk', 'jwt', 'keys'], icon: 'KeyRound', fields: textField('{"keys":[{"kty":"RSA","kid":"k1","use":"sig","alg":"RS256","n":"abc","e":"AQAB"}]}', 'Paste JWKS JSON') },
  { slug: 'jwk-rotation-diff', name: 'JWK Rotation Diff', description: 'Compare old and new JWKS documents and identify added, removed, and changed keys.', category: 'crypto', tags: ['jwks', 'jwk', 'rotation', 'diff'], icon: 'GitCompare', fields: twoTextFields({ id: 'old', label: 'Old JWKS', type: 'textarea', rows: 10, defaultValue: '{"keys":[{"kid":"old","kty":"RSA","alg":"RS256"}]}' }, { id: 'new', label: 'New JWKS', type: 'textarea', rows: 10, defaultValue: '{"keys":[{"kid":"old","kty":"RSA","alg":"RS256"},{"kid":"new","kty":"RSA","alg":"RS256"}]}' }) },
  { slug: 'scim-user-payload-builder', name: 'SCIM User Payload Builder', description: 'Build a SCIM 2.0 user JSON payload for provisioning tests.', tags: ['scim', 'identity', 'json', 'provisioning'], icon: 'User', fields: [
    { id: 'userName', label: 'userName', type: 'text', defaultValue: 'ada@example.com' },
    { id: 'givenName', label: 'givenName', type: 'text', defaultValue: 'Ada' },
    { id: 'familyName', label: 'familyName', type: 'text', defaultValue: 'Lovelace' },
    { id: 'email', label: 'Email', type: 'text', defaultValue: 'ada@example.com' },
    { id: 'active', label: 'Active', type: 'checkbox', defaultValue: 'true' },
  ] },
  { slug: 'scim-filter-tester', name: 'SCIM Filter Tester', description: 'Test basic SCIM filter expressions against pasted sample users.', tags: ['scim', 'filter', 'identity', 'json'], icon: 'Filter', fields: [
    { id: 'filter', label: 'SCIM filter', type: 'text', defaultValue: 'userName eq "ada@example.com"' },
    { id: 'input', label: 'Users JSON array', type: 'textarea', rows: 12, defaultValue: '[{"userName":"ada@example.com","active":true},{"userName":"grace@example.com","active":false}]' },
  ] },
  { slug: 'soap-envelope-builder', name: 'SOAP Envelope Builder', description: 'Build SOAP 1.1 or 1.2 envelopes from namespace, operation, and body XML.', tags: ['soap', 'xml', 'request', 'api'], icon: 'FileCode', fields: [
    { id: 'version', label: 'SOAP version', type: 'select', defaultValue: '1.1', options: [{ label: '1.1', value: '1.1' }, { label: '1.2', value: '1.2' }] },
    { id: 'namespace', label: 'Operation namespace', type: 'text', defaultValue: 'urn:example:users' },
    { id: 'operation', label: 'Operation', type: 'text', defaultValue: 'GetUser' },
    { id: 'body', label: 'Body XML', type: 'textarea', rows: 8, defaultValue: '<id>123</id>' },
  ] },
  { slug: 'soap-request-debugger', name: 'SOAP Request Debugger', description: 'Inspect SOAP HTTP headers, envelope version, operation, and body payload.', tags: ['soap', 'http', 'xml', 'debug'], icon: 'Bug', fields: [
    { id: 'headers', label: 'HTTP headers', type: 'textarea', rows: 6, defaultValue: 'POST /Service.svc HTTP/1.1\nContent-Type: text/xml; charset=utf-8\nSOAPAction: "urn:example:GetUser"' },
    { id: 'input', label: 'SOAP envelope', type: 'textarea', rows: 12, defaultValue: soapEnvelope('1.1', 'urn:example:users', 'GetUser', '<id>123</id>') },
  ] },
  { slug: 'wsdl-operation-explorer', name: 'WSDL Operation Explorer', description: 'Parse WSDL XML and list services, ports, bindings, operations, and messages.', tags: ['wsdl', 'soap', 'xml', 'api'], icon: 'ListTree', fields: textField('<definitions name="UserService"><service name="UserService"><port name="UserPort" binding="tns:UserBinding"/></service><portType name="UserPortType"><operation name="GetUser"><input message="tns:GetUserRequest"/><output message="tns:GetUserResponse"/></operation></portType></definitions>', 'Paste WSDL XML') },
  { slug: 'wsdl-to-sample-soap', name: 'WSDL to Sample SOAP', description: 'Generate a starter SOAP envelope for a selected operation name.', tags: ['wsdl', 'soap', 'xml', 'sample'], icon: 'FilePlus', fields: [
    { id: 'input', label: 'WSDL XML', type: 'textarea', rows: 12, defaultValue: '<definitions targetNamespace="urn:example:users"><portType name="UserPortType"><operation name="GetUser"><input message="tns:GetUserRequest"/></operation></portType></definitions>' },
    { id: 'operation', label: 'Operation name', type: 'text', defaultValue: 'GetUser' },
  ] },
  { slug: 'soap-fault-parser', name: 'SOAP Fault Parser', description: 'Parse SOAP 1.1/1.2 faults into code, reason, actor/node, role, and detail.', tags: ['soap', 'fault', 'xml', 'debug'], icon: 'FileX', fields: textField('<soap:Fault xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><faultcode>soap:Client</faultcode><faultstring>Invalid id</faultstring><detail><message>User not found</message></detail></soap:Fault>', 'Paste SOAP fault XML') },
  { slug: 'soap-action-header-builder', name: 'SOAPAction Header Builder', description: 'Build SOAPAction and Content-Type headers for SOAP 1.1 or 1.2 requests.', tags: ['soap', 'headers', 'http', 'api'], icon: 'FileCog', fields: [
    { id: 'version', label: 'SOAP version', type: 'select', defaultValue: '1.1', options: [{ label: '1.1', value: '1.1' }, { label: '1.2', value: '1.2' }] },
    { id: 'action', label: 'Action URI', type: 'text', defaultValue: 'urn:example:GetUser' },
    { id: 'charset', label: 'Charset', type: 'text', defaultValue: 'utf-8' },
  ] },
  { slug: 'http-request-replay-sanitizer', name: 'HTTP Request Replay Sanitizer', description: 'Redact secrets from captured HTTP requests and emit a safer replay snippet.', tags: ['http', 'request', 'redact', 'debug'], icon: 'Eraser', fields: textField('POST /api/users HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer secret-token\nCookie: sid=secret\nX-Api-Key: abc123\n\n{"password":"hunter2","name":"Ada"}', 'Paste raw HTTP request') },
  { slug: 'postman-collection-viewer', name: 'Postman Collection Viewer', description: 'Summarize a Postman collection without importing it into Postman.', tags: ['postman', 'api', 'collection', 'json'], icon: 'List', fields: textField('{"info":{"name":"Example API"},"item":[{"name":"List users","request":{"method":"GET","url":"https://api.example.com/users"}}]}', 'Paste Postman collection JSON') },
  { slug: 'openapi-validator-linter', name: 'OpenAPI Validator & Linter', description: 'Validate common OpenAPI structure and flag missing info, paths, responses, and schemas.', tags: ['openapi', 'swagger', 'api', 'lint'], icon: 'FileSearch', fields: textField(SAMPLE_OPENAPI, 'Paste OpenAPI JSON or simple YAML') },
  { slug: 'openapi-breaking-change-diff', name: 'OpenAPI Breaking Change Diff', description: 'Compare two OpenAPI specs and identify removed paths, methods, parameters, and response codes.', tags: ['openapi', 'diff', 'breaking', 'api'], icon: 'GitCompare', fields: twoTextFields({ id: 'old', label: 'Old OpenAPI', type: 'textarea', rows: 12, defaultValue: SAMPLE_OPENAPI }, { id: 'new', label: 'New OpenAPI', type: 'textarea', rows: 12, defaultValue: SAMPLE_OPENAPI.replace('/users', '/members') }) },
  { slug: 'openapi-schema-example-generator', name: 'OpenAPI Schema Example Generator', description: 'Generate JSON examples from OpenAPI component schemas.', tags: ['openapi', 'schema', 'example', 'json'], icon: 'Braces', fields: [
    { id: 'input', label: 'OpenAPI document or schema', type: 'textarea', rows: 12, defaultValue: '{"type":"object","properties":{"id":{"type":"integer"},"email":{"type":"string","format":"email"},"active":{"type":"boolean"}},"required":["id","email"]}' },
    { id: 'schemaName', label: 'Component schema name', type: 'text', defaultValue: '' },
  ] },
  { slug: 'openapi-security-scheme-inspector', name: 'OpenAPI Security Scheme Inspector', description: 'Summarize API keys, HTTP auth, OAuth flows, OpenID Connect URLs, and operation security.', tags: ['openapi', 'security', 'oauth', 'api'], icon: 'Lock', fields: textField(SAMPLE_OPENAPI, 'Paste OpenAPI JSON or simple YAML') },
  { slug: 'asyncapi-validator-preview', name: 'AsyncAPI Validator Preview', description: 'Validate common AsyncAPI structure and summarize channels, operations, messages, and servers.', tags: ['asyncapi', 'events', 'api', 'yaml'], icon: 'Radio', fields: textField('{"asyncapi":"3.0.0","info":{"title":"Events","version":"1.0.0"},"channels":{"user.created":{"address":"user.created","messages":{"UserCreated":{"payload":{"type":"object"}}}}}', 'Paste AsyncAPI JSON or simple YAML') },
  { slug: 'cloudevents-validator', name: 'CloudEvents Validator', description: 'Validate a CloudEvents JSON event for required attributes and common content-type issues.', tags: ['cloudevents', 'events', 'json', 'api'], icon: 'Webhook', fields: textField('{"specversion":"1.0","id":"evt-1","source":"/users","type":"com.example.user.created","time":"2026-06-03T12:00:00Z","datacontenttype":"application/json","data":{"id":123}}', 'Paste CloudEvents JSON') },
  { slug: 'webhook-signature-verifier', name: 'Webhook Signature Verifier', description: 'Verify HMAC webhook signatures used by GitHub, Slack, Stripe-style integrations.', category: 'crypto', tags: ['webhook', 'hmac', 'signature', 'security'], icon: 'Webhook', fields: [
    { id: 'algorithm', label: 'Algorithm', type: 'select', defaultValue: 'SHA-256', options: [{ label: 'SHA-256', value: 'SHA-256' }, { label: 'SHA-1', value: 'SHA-1' }, { label: 'SHA-384', value: 'SHA-384' }, { label: 'SHA-512', value: 'SHA-512' }] },
    { id: 'secret', label: 'Secret', type: 'text', defaultValue: 'whsec_test' },
    { id: 'payload', label: 'Payload', type: 'textarea', rows: 8, defaultValue: '{"id":"evt_123","type":"user.created"}' },
    { id: 'signature', label: 'Expected signature', type: 'text', defaultValue: '' },
  ] },
  { slug: 'webhook-retry-schedule-calculator', name: 'Webhook Retry Schedule Calculator', description: 'Model webhook retry attempts using delay, multiplier, jitter, and max delay.', tags: ['webhook', 'retry', 'backoff', 'schedule'], icon: 'Timer', fields: [
    { id: 'attempts', label: 'Attempts', type: 'text', defaultValue: '8' },
    { id: 'initialSeconds', label: 'Initial delay seconds', type: 'text', defaultValue: '30' },
    { id: 'multiplier', label: 'Multiplier', type: 'text', defaultValue: '2' },
    { id: 'maxSeconds', label: 'Max delay seconds', type: 'text', defaultValue: '3600' },
    { id: 'jitterPercent', label: 'Jitter percent', type: 'text', defaultValue: '20' },
  ] },
  { slug: 'graphql-introspection-viewer', name: 'GraphQL Introspection Viewer', description: 'Summarize GraphQL introspection JSON types, queries, mutations, interfaces, and scalars.', tags: ['graphql', 'schema', 'introspection', 'json'], icon: 'Component', fields: textField('{"data":{"__schema":{"queryType":{"name":"Query"},"mutationType":{"name":"Mutation"},"types":[{"kind":"OBJECT","name":"Query","fields":[{"name":"user"}]},{"kind":"SCALAR","name":"String"}]}}}', 'Paste GraphQL introspection JSON') },
  { slug: 'graphql-operation-complexity-estimator', name: 'GraphQL Operation Complexity Estimator', description: 'Estimate GraphQL query depth, field count, aliases, fragments, and repeated selections.', tags: ['graphql', 'query', 'complexity', 'api'], icon: 'ChartBar', fields: textField('query GetUser { user(id: "1") { id email posts { id title comments { id body } } } }', 'Paste GraphQL operation') },
  { slug: 'graphql-variables-validator', name: 'GraphQL Variables Validator', description: 'Compare GraphQL variable definitions with a variables JSON payload.', tags: ['graphql', 'variables', 'json', 'validation'], icon: 'Variable', fields: [
    { id: 'operation', label: 'GraphQL operation', type: 'textarea', rows: 8, defaultValue: 'query GetUser($id: ID!, $includePosts: Boolean = false) { user(id: $id) { id } }' },
    { id: 'variables', label: 'Variables JSON', type: 'textarea', rows: 8, defaultValue: '{"id":"123"}' },
  ] },
  { slug: 'grpc-proto-viewer', name: 'gRPC Proto Viewer', description: 'Parse .proto text and list packages, services, RPCs, messages, fields, and enums.', tags: ['grpc', 'protobuf', 'proto', 'api'], icon: 'Network', fields: textField('syntax = "proto3";\npackage users.v1;\nservice UserService { rpc GetUser (GetUserRequest) returns (User); }\nmessage GetUserRequest { string id = 1; }\nmessage User { string id = 1; string email = 2; }', 'Paste .proto text') },
  { slug: 'grpcurl-command-builder', name: 'grpcurl Command Builder', description: 'Build grpcurl commands with host, service method, headers, TLS, and JSON body.', tags: ['grpc', 'grpcurl', 'command', 'api'], icon: 'Terminal', fields: [
    { id: 'host', label: 'Host', type: 'text', defaultValue: 'api.example.com:443' },
    { id: 'method', label: 'Service/method', type: 'text', defaultValue: 'users.v1.UserService/GetUser' },
    { id: 'headers', label: 'Headers', type: 'textarea', rows: 5, defaultValue: 'authorization: Bearer TOKEN' },
    { id: 'body', label: 'JSON body', type: 'textarea', rows: 6, defaultValue: '{"id":"123"}' },
    { id: 'plaintext', label: 'Plaintext', type: 'checkbox', defaultValue: 'false' },
  ] },
  { slug: 'protobuf-binary-decoder', name: 'Protobuf Binary Decoder', description: 'Decode protobuf wire bytes into field numbers, wire types, and raw scalar values.', category: 'encoding', tags: ['protobuf', 'binary', 'decode', 'wire'], icon: 'Binary', fields: textField('08 96 01 12 03 41 64 61', 'Paste protobuf bytes as hex or Base64') },
  { slug: 'protobuf-json-converter', name: 'Protobuf JSON Converter', description: 'Normalize protobuf JSON field names and scalar wrappers for debugging.', tags: ['protobuf', 'json', 'api', 'convert'], icon: 'Braces', fields: textField('{"userId":"123","createdAt":"2026-06-03T12:00:00Z","active":true}', 'Paste protobuf JSON') },
  { slug: 'mqtt-topic-matcher', name: 'MQTT Topic Matcher', description: 'Test MQTT topic filters with + and # wildcards against sample topics.', tags: ['mqtt', 'topic', 'wildcard', 'events'], icon: 'Radio', fields: [
    { id: 'filter', label: 'Topic filter', type: 'text', defaultValue: 'sensors/+/temperature/#' },
    { id: 'input', label: 'Topics', type: 'textarea', rows: 8, defaultValue: 'sensors/kitchen/temperature\nsensors/garage/humidity\nsensors/kitchen/temperature/celsius' },
  ] },
  { slug: 'kafka-message-header-viewer', name: 'Kafka Message Header Viewer', description: 'Parse Kafka header key/value pairs and payload metadata for debugging consumers.', tags: ['kafka', 'headers', 'events', 'debug'], icon: 'Database', fields: [
    { id: 'headers', label: 'Headers', type: 'textarea', rows: 8, defaultValue: 'content-type=application/json\ntraceparent=00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' },
    { id: 'payload', label: 'Payload', type: 'textarea', rows: 8, defaultValue: '{"id":"evt-1","type":"user.created"}' },
  ] },
  { slug: 'avro-schema-validator', name: 'Avro Schema Validator', description: 'Validate common Avro schema structure and summarize records, fields, enums, and unions.', tags: ['avro', 'schema', 'json', 'events'], icon: 'FileJson', fields: textField('{"type":"record","name":"User","fields":[{"name":"id","type":"string"},{"name":"active","type":"boolean","default":true}]}', 'Paste Avro schema JSON') },
  { slug: 'avro-schema-evolution-checker', name: 'Avro Schema Evolution Checker', description: 'Compare Avro record schemas for added, removed, changed, and default-less fields.', tags: ['avro', 'schema', 'compatibility', 'diff'], icon: 'GitCompare', fields: twoTextFields({ id: 'old', label: 'Old Avro schema', type: 'textarea', rows: 10, defaultValue: '{"type":"record","name":"User","fields":[{"name":"id","type":"string"}]}' }, { id: 'new', label: 'New Avro schema', type: 'textarea', rows: 10, defaultValue: '{"type":"record","name":"User","fields":[{"name":"id","type":"string"},{"name":"email","type":"string","default":""}]}' }) },
  { slug: 'json-schema-compatibility-diff', name: 'JSON Schema Compatibility Diff', description: 'Compare JSON Schemas for required fields, property changes, and enum narrowing.', tags: ['json schema', 'schema', 'compatibility', 'diff'], icon: 'GitCompare', fields: twoTextFields({ id: 'old', label: 'Old JSON Schema', type: 'textarea', rows: 10, defaultValue: '{"type":"object","required":["id"],"properties":{"id":{"type":"string"}}}' }, { id: 'new', label: 'New JSON Schema', type: 'textarea', rows: 10, defaultValue: '{"type":"object","required":["id","email"],"properties":{"id":{"type":"string"},"email":{"type":"string"}}}' }) },
  { slug: 'http-multipart-form-data-builder', name: 'Multipart Form-Data Builder', description: 'Build multipart/form-data bodies and cURL snippets from field definitions.', tags: ['http', 'multipart', 'form-data', 'api'], icon: 'Rows3', fields: [
    { id: 'url', label: 'URL', type: 'text', defaultValue: 'https://api.example.com/upload' },
    { id: 'fields', label: 'Fields', type: 'textarea', rows: 10, defaultValue: 'name=Ada\navatar=@./avatar.png\nmetadata={"role":"admin"}' },
  ] },
  { slug: 'server-sent-events-event-parser', name: 'Server-Sent Events Parser', description: 'Parse SSE streams into events, IDs, retry hints, comments, and data payloads.', tags: ['sse', 'events', 'http', 'parser'], icon: 'Rss', fields: textField('event: user.created\nid: 42\nretry: 5000\ndata: {"id":"u1"}\n\n: heartbeat\n\ndata: done\n\n', 'Paste text/event-stream content') },
  { slug: 'dns-record-dig-ui', name: 'DNS Record dig UI', description: 'Build copyable dig commands and summarize pasted DNS records.', tags: ['dns', 'dig', 'records', 'network'], icon: 'Globe', fields: [
    { id: 'domain', label: 'Domain', type: 'text', defaultValue: 'example.com' },
    { id: 'recordType', label: 'Record type', type: 'select', defaultValue: 'A', options: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA', 'SRV'].map((value) => ({ label: value, value })) },
    { id: 'resolver', label: 'Resolver', type: 'text', defaultValue: '1.1.1.1' },
    { id: 'input', label: 'Pasted records', type: 'textarea', rows: 8, defaultValue: 'example.com. 300 IN A 93.184.216.34' },
  ] },
  { slug: 'dns-propagation-comparison', name: 'DNS Propagation Comparison', description: 'Compare pasted DNS answers from multiple resolvers and flag mismatches.', tags: ['dns', 'propagation', 'resolver', 'compare'], icon: 'GitCompare', fields: textField('cloudflare: example.com. 300 IN A 93.184.216.34\ngoogle: example.com. 300 IN A 93.184.216.34\nquad9: example.com. 60 IN A 93.184.216.35', 'Paste resolver: answer lines') },
  { slug: 'dns-zone-file-validator', name: 'DNS Zone File Validator', description: 'Check zone-file records for common SOA, NS, MX, CNAME, TTL, and syntax issues.', tags: ['dns', 'zone', 'records', 'validation'], icon: 'FileSearch', fields: textField('$ORIGIN example.com.\n$TTL 3600\n@ IN SOA ns1.example.com. hostmaster.example.com. 2026060301 7200 3600 1209600 3600\n@ IN NS ns1.example.com.\n@ IN MX 10 mail.example.com.\nwww IN A 93.184.216.34', 'Paste zone file') },
  { slug: 'dnssec-chain-visualizer', name: 'DNSSEC Chain Visualizer', description: 'Inspect pasted DS, DNSKEY, RRSIG, and NSEC records and outline the trust chain.', tags: ['dnssec', 'dns', 'security', 'records'], icon: 'ShieldCheck', fields: textField('example.com. 3600 IN DS 12345 13 2 ABCDEF...\nexample.com. 3600 IN DNSKEY 257 3 13 BASE64KEY...\nexample.com. 3600 IN RRSIG A 13 2 3600 20260701000000 20260601000000 12345 example.com. SIG...', 'Paste DNSSEC records') },
  { slug: 'spf-record-builder', name: 'SPF Record Builder', description: 'Build SPF TXT records from mechanisms, includes, IPv4, IPv6, and all-policy.', tags: ['spf', 'dns', 'email', 'txt'], icon: 'Mail', fields: [
    { id: 'includes', label: 'Includes', type: 'text', defaultValue: '_spf.google.com mailgun.org' },
    { id: 'ipv4', label: 'IPv4 ranges', type: 'text', defaultValue: '203.0.113.10' },
    { id: 'ipv6', label: 'IPv6 ranges', type: 'text', defaultValue: '' },
    { id: 'all', label: 'All policy', type: 'select', defaultValue: '~all', options: [{ label: '~all soft fail', value: '~all' }, { label: '-all hard fail', value: '-all' }, { label: '?all neutral', value: '?all' }, { label: '+all pass', value: '+all' }] },
  ] },
  { slug: 'spf-flattening-analyzer', name: 'SPF Flattening Analyzer', description: 'Count SPF mechanisms and estimate DNS lookup pressure before flattening.', tags: ['spf', 'dns', 'email', 'analysis'], icon: 'FileSearch', fields: textField('v=spf1 include:_spf.google.com include:mailgun.org ip4:203.0.113.10 mx ~all', 'Paste SPF record') },
  { slug: 'dkim-record-decoder', name: 'DKIM Record Decoder', description: 'Decode DKIM TXT records and extract version, key type, flags, hash list, service, and public key hints.', tags: ['dkim', 'dns', 'email', 'txt'], icon: 'KeyRound', fields: textField('v=DKIM1; k=rsa; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...', 'Paste DKIM TXT value') },
  { slug: 'dmarc-record-builder', name: 'DMARC Record Builder', description: 'Build DMARC TXT policies with reporting URIs, alignment, percentage, and subdomain policy.', tags: ['dmarc', 'dns', 'email', 'txt'], icon: 'Mail', fields: [
    { id: 'policy', label: 'Policy', type: 'select', defaultValue: 'quarantine', options: [{ label: 'none', value: 'none' }, { label: 'quarantine', value: 'quarantine' }, { label: 'reject', value: 'reject' }] },
    { id: 'rua', label: 'Aggregate reports', type: 'text', defaultValue: 'mailto:dmarc@example.com' },
    { id: 'ruf', label: 'Forensic reports', type: 'text', defaultValue: '' },
    { id: 'pct', label: 'Percent', type: 'text', defaultValue: '100' },
    { id: 'alignment', label: 'Alignment', type: 'select', defaultValue: 'relaxed', options: [{ label: 'relaxed', value: 'relaxed' }, { label: 'strict', value: 'strict' }] },
  ] },
  { slug: 'dmarc-report-xml-parser', name: 'DMARC Report XML Parser', description: 'Parse aggregate DMARC XML reports into source IPs, counts, dispositions, and auth results.', tags: ['dmarc', 'xml', 'email', 'reports'], icon: 'FileSearch', fields: textField('<feedback><report_metadata><org_name>Example</org_name><report_id>r1</report_id></report_metadata><record><row><source_ip>203.0.113.10</source_ip><count>5</count><policy_evaluated><disposition>none</disposition><dkim>pass</dkim><spf>pass</spf></policy_evaluated></row></record></feedback>', 'Paste DMARC aggregate XML') },
  { slug: 'bimi-record-checker', name: 'BIMI Record Checker', description: 'Inspect BIMI TXT records for version, logo URL, authority URL, and deployment checklist.', tags: ['bimi', 'dns', 'email', 'brand'], icon: 'FileBadge', fields: textField('v=BIMI1; l=https://example.com/bimi.svg; a=https://example.com/vmc.pem', 'Paste BIMI TXT value') },
  { slug: 'mta-sts-policy-checker', name: 'MTA-STS Policy Checker', description: 'Validate MTA-STS TXT and policy file contents for secure inbound mail delivery.', tags: ['mta-sts', 'email', 'tls', 'dns'], icon: 'ShieldCheck', fields: [
    { id: 'txt', label: 'MTA-STS TXT', type: 'text', defaultValue: 'v=STSv1; id=2026060301' },
    { id: 'policy', label: 'Policy file', type: 'textarea', rows: 10, defaultValue: 'version: STSv1\nmode: enforce\nmx: mail.example.com\nmax_age: 86400' },
  ] },
  { slug: 'tls-rpt-record-builder', name: 'TLS-RPT Record Builder', description: 'Build SMTP TLS reporting DNS records for mail delivery diagnostics.', tags: ['tls-rpt', 'email', 'dns', 'txt'], icon: 'Mail', fields: [
    { id: 'rua', label: 'Report URI', type: 'text', defaultValue: 'mailto:tlsrpt@example.com' },
  ] },
  { slug: 'certificate-decoder-x509', name: 'X.509 Certificate Decoder', description: 'Decode PEM certificate structure and extract subject, issuer, validity, SAN hints, and fingerprints when visible.', category: 'crypto', tags: ['certificate', 'x509', 'tls', 'pem'], icon: 'FileBadge', fields: textField(SAMPLE_CERT, 'Paste PEM certificate') },
  { slug: 'certificate-chain-builder', name: 'Certificate Chain Builder', description: 'Inspect pasted PEM certificate chains and flag ordering, duplicate subjects, and missing intermediates.', category: 'crypto', tags: ['certificate', 'chain', 'tls', 'pem'], icon: 'FileStack', fields: textField(`${SAMPLE_CERT}\n${SAMPLE_CERT.replace('example.com', 'Example CA')}`, 'Paste PEM certificate chain') },
  { slug: 'csr-generator-validator', name: 'CSR Generator & Validator', description: 'Generate an OpenSSL CSR command and inspect pasted CSR PEM blocks.', category: 'crypto', tags: ['csr', 'certificate', 'openssl', 'tls'], icon: 'FileKey', fields: [
    { id: 'commonName', label: 'Common name', type: 'text', defaultValue: 'example.com' },
    { id: 'san', label: 'SANs', type: 'text', defaultValue: 'DNS:example.com,DNS:www.example.com' },
    { id: 'organization', label: 'Organization', type: 'text', defaultValue: 'Example Inc' },
    { id: 'input', label: 'Existing CSR PEM', type: 'textarea', rows: 8, defaultValue: '' },
  ] },
  { slug: 'ocsp-response-decoder', name: 'OCSP Response Decoder', description: 'Decode Base64 or PEM OCSP response bytes and summarize visible ASN.1/status hints.', category: 'crypto', tags: ['ocsp', 'certificate', 'tls', 'decode'], icon: 'FileSearch', fields: textField('MIIExampleBase64OcspResponse==', 'Paste OCSP response Base64 or PEM') },
  { slug: 'tls-cipher-suite-explainer', name: 'TLS Cipher Suite Explainer', description: 'Explain TLS cipher suite components, key exchange, authentication, encryption, and hash.', category: 'crypto', tags: ['tls', 'cipher', 'security', 'reference'], icon: 'Lock', fields: [
    { id: 'input', label: 'Cipher suite', type: 'text', defaultValue: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256' },
  ] },
  { slug: 'hsts-preload-checker', name: 'HSTS Preload Checker', description: 'Check Strict-Transport-Security headers against common preload requirements.', tags: ['hsts', 'headers', 'security', 'tls'], icon: 'ShieldCheck', fields: [
    { id: 'input', label: 'Strict-Transport-Security header', type: 'text', defaultValue: 'max-age=63072000; includeSubDomains; preload' },
  ] },
  { slug: 'security-headers-auditor', name: 'Security Headers Auditor', description: 'Audit pasted HTTP response headers for CSP, HSTS, frame, MIME, referrer, and permissions policy.', tags: ['security headers', 'http', 'csp', 'audit'], icon: 'Shield', fields: textField("HTTP/1.1 200 OK\nStrict-Transport-Security: max-age=63072000; includeSubDomains; preload\nContent-Security-Policy: default-src 'self'\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin\nPermissions-Policy: geolocation=()", 'Paste response headers') },
  { slug: 'subresource-integrity-generator', name: 'Subresource Integrity Generator', description: 'Generate SHA-256/384/512 SRI hashes for pasted asset text.', category: 'crypto', tags: ['sri', 'hash', 'security', 'html'], icon: 'Hash', fields: [
    { id: 'algorithm', label: 'Algorithm', type: 'select', defaultValue: 'SHA-384', options: [{ label: 'SHA-256', value: 'SHA-256' }, { label: 'SHA-384', value: 'SHA-384' }, { label: 'SHA-512', value: 'SHA-512' }] },
    { id: 'input', label: 'Asset content', type: 'textarea', rows: 12, defaultValue: 'console.log("hello");' },
  ] },
] as const;

export const DEVELOPER_TOOL_DEFINITIONS: readonly DeveloperToolDefinition[] = defs.map((def) => ({
  category: def.category ?? 'web',
  icon: def.icon ?? 'Wrench',
  keywords: def.keywords ?? def.tags,
  relatedTools: def.relatedTools ?? [],
  kind: def.kind ?? (def.slug as DeveloperToolKind),
  fields: def.fields ?? textField(),
  ...def,
}));

export function getDeveloperToolDefinition(slug: string): DeveloperToolDefinition | undefined {
  return DEVELOPER_TOOL_DEFINITIONS.find((definition) => definition.slug === slug);
}

export function getDefaultDeveloperToolValues(definition: DeveloperToolDefinition): Values {
  return Object.fromEntries(definition.fields.map((field) => [field.id, field.defaultValue]));
}

export async function runDeveloperTool(slug: string, values: Values): Promise<DeveloperToolResult> {
  const definition = getDeveloperToolDefinition(slug);
  if (!definition) throw new Error(`Unknown developer tool: ${slug}`);
  const merged = { ...getDefaultDeveloperToolValues(definition), ...values };

  switch (definition.kind) {
    case 'saml-request-decoder':
      return inspectSamlMessage(definition, await decodeSamlLike(value(merged, 'input'), 'SAMLRequest'));
    case 'saml-response-decoder':
      return inspectSamlMessage(definition, await decodeSamlLike(value(merged, 'input'), 'SAMLResponse'));
    case 'saml-redirect-binding-builder':
      return samlRedirectBinding(definition, merged);
    case 'saml-post-form-generator':
      return samlPostForm(definition, merged);
    case 'saml-metadata-parser':
      return metadataParser(definition, value(merged, 'input'));
    case 'saml-metadata-builder-sp':
      return samlSpMetadata(definition, merged);
    case 'saml-metadata-builder-idp':
      return samlIdpMetadata(definition, merged);
    case 'saml-assertion-inspector':
      return inspectSamlMessage(definition, value(merged, 'input'));
    case 'saml-condition-time-validator':
      return samlTimeValidator(definition, merged);
    case 'saml-signature-reference-inspector':
      return signatureInspector(definition, value(merged, 'input'));
    case 'saml-attribute-mapper':
      return samlAttributeMapper(definition, merged);
    case 'oidc-discovery-inspector':
      return oidcDiscovery(definition, value(merged, 'input'));
    case 'oidc-id-token-validator':
      return oidcTokenValidator(definition, merged);
    case 'oauth-pkce-generator':
      return pkceGenerator(definition, merged);
    case 'oauth-authorization-url-builder':
      return oauthUrlBuilder(definition, merged);
    case 'oauth-token-response-inspector':
      return tokenResponseInspector(definition, value(merged, 'input'));
    case 'jwks-inspector':
      return jwksInspector(definition, value(merged, 'input'));
    case 'jwk-rotation-diff':
      return jwkRotationDiff(definition, merged);
    case 'scim-user-payload-builder':
      return scimPayload(definition, merged);
    case 'scim-filter-tester':
      return scimFilter(definition, merged);
    case 'soap-envelope-builder':
      return soapEnvelopeBuilder(definition, merged);
    case 'soap-request-debugger':
      return soapRequestDebugger(definition, merged);
    case 'wsdl-operation-explorer':
      return wsdlExplorer(definition, value(merged, 'input'));
    case 'wsdl-to-sample-soap':
      return wsdlSampleSoap(definition, merged);
    case 'soap-fault-parser':
      return soapFaultParser(definition, value(merged, 'input'));
    case 'soap-action-header-builder':
      return soapActionBuilder(definition, merged);
    case 'http-request-replay-sanitizer':
      return httpSanitizer(definition, value(merged, 'input'));
    case 'postman-collection-viewer':
      return postmanViewer(definition, value(merged, 'input'));
    case 'openapi-validator-linter':
      return openapiLinter(definition, value(merged, 'input'));
    case 'openapi-breaking-change-diff':
      return openapiDiff(definition, merged);
    case 'openapi-schema-example-generator':
      return openapiExample(definition, merged);
    case 'openapi-security-scheme-inspector':
      return openapiSecurity(definition, value(merged, 'input'));
    case 'asyncapi-validator-preview':
      return asyncApiPreview(definition, value(merged, 'input'));
    case 'cloudevents-validator':
      return cloudEventsValidator(definition, value(merged, 'input'));
    case 'webhook-signature-verifier':
      return webhookVerifier(definition, merged);
    case 'webhook-retry-schedule-calculator':
      return webhookRetry(definition, merged);
    case 'graphql-introspection-viewer':
      return graphqlIntrospection(definition, value(merged, 'input'));
    case 'graphql-operation-complexity-estimator':
      return graphqlComplexity(definition, value(merged, 'input'));
    case 'graphql-variables-validator':
      return graphqlVariables(definition, merged);
    case 'grpc-proto-viewer':
      return protoViewer(definition, value(merged, 'input'));
    case 'grpcurl-command-builder':
      return grpcurlBuilder(definition, merged);
    case 'protobuf-binary-decoder':
      return protobufWireDecoder(definition, value(merged, 'input'));
    case 'protobuf-json-converter':
      return protobufJson(definition, value(merged, 'input'));
    case 'mqtt-topic-matcher':
      return mqttMatcher(definition, merged);
    case 'kafka-message-header-viewer':
      return kafkaHeaders(definition, merged);
    case 'avro-schema-validator':
      return avroValidator(definition, value(merged, 'input'));
    case 'avro-schema-evolution-checker':
      return avroEvolution(definition, merged);
    case 'json-schema-compatibility-diff':
      return jsonSchemaDiff(definition, merged);
    case 'http-multipart-form-data-builder':
      return multipartBuilder(definition, merged);
    case 'server-sent-events-event-parser':
      return sseParser(definition, value(merged, 'input'));
    case 'dns-record-dig-ui':
      return dnsDig(definition, merged);
    case 'dns-propagation-comparison':
      return dnsCompare(definition, value(merged, 'input'));
    case 'dns-zone-file-validator':
      return dnsZone(definition, value(merged, 'input'));
    case 'dnssec-chain-visualizer':
      return dnssec(definition, value(merged, 'input'));
    case 'spf-record-builder':
      return spfBuilder(definition, merged);
    case 'spf-flattening-analyzer':
      return spfAnalyzer(definition, value(merged, 'input'));
    case 'dkim-record-decoder':
      return tagRecord(definition, value(merged, 'input'), 'DKIM');
    case 'dmarc-record-builder':
      return dmarcBuilder(definition, merged);
    case 'dmarc-report-xml-parser':
      return dmarcXml(definition, value(merged, 'input'));
    case 'bimi-record-checker':
      return tagRecord(definition, value(merged, 'input'), 'BIMI');
    case 'mta-sts-policy-checker':
      return mtaSts(definition, merged);
    case 'tls-rpt-record-builder':
      return tlsRpt(definition, merged);
    case 'certificate-decoder-x509':
      return certDecode(definition, value(merged, 'input'));
    case 'certificate-chain-builder':
      return certChain(definition, value(merged, 'input'));
    case 'csr-generator-validator':
      return csrTool(definition, merged);
    case 'ocsp-response-decoder':
      return ocspDecode(definition, value(merged, 'input'));
    case 'tls-cipher-suite-explainer':
      return tlsCipher(definition, value(merged, 'input'));
    case 'hsts-preload-checker':
      return hsts(definition, value(merged, 'input'));
    case 'security-headers-auditor':
      return securityHeaders(definition, value(merged, 'input'));
    case 'subresource-integrity-generator':
      return sriGenerator(definition, merged);
  }
}

function value(values: Values, key: string): string {
  return values[key] ?? '';
}

function result(
  definition: DeveloperToolDefinition,
  output: string,
  options: Partial<Omit<DeveloperToolResult, 'title' | 'output'>> = {},
): DeveloperToolResult {
  return {
    title: definition.name,
    summary: options.summary ?? definition.description,
    output,
    outputLanguage: options.outputLanguage ?? 'text',
    stats: options.stats ?? [],
    warnings: options.warnings ?? [],
    sections: options.sections ?? [],
  };
}

function lines(items: readonly (string | null | undefined | false)[]): string {
  return items.filter(Boolean).join('\n');
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Text(input: string): string {
  const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function extractQueryParam(input: string, param: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.searchParams.get(param);
  } catch {
    const params = new URLSearchParams(trimmed.startsWith('?') ? trimmed.slice(1) : trimmed);
    return params.get(param);
  }
}

async function decodeSamlLike(input: string, param: 'SAMLRequest' | 'SAMLResponse'): Promise<string> {
  const extracted = extractQueryParam(input, param) ?? input;
  const decodedUrl = safeDecodeURIComponent(extracted.replace(/\+/g, '%20'));
  if (/^\s*</.test(decodedUrl)) return decodedUrl;
  try {
    const base64Decoded = decodeBase64Text(decodedUrl);
    if (/^\s*</.test(base64Decoded)) return base64Decoded;
    const inflated = await inflateMaybe(base64ToBytes(decodedUrl));
    if (inflated) return inflated;
    return base64Decoded;
  } catch {
    return decodedUrl;
  }
}

function safeDecodeURIComponent(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function base64ToBytes(input: string): Uint8Array {
  const normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function inflateMaybe(bytes: Uint8Array): Promise<string | null> {
  const Decompression = (globalThis as unknown as { DecompressionStream?: new (format: string) => DecompressionStream }).DecompressionStream;
  if (!Decompression) return null;
  for (const format of ['deflate-raw', 'deflate']) {
    try {
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const stream = new Blob([buffer]).stream().pipeThrough(new Decompression(format));
      return await new Response(stream).text();
    } catch {
      // Try next format.
    }
  }
  return null;
}

function formatXml(xml: string): string {
  const source = xml.trim().replace(/>\s+</g, '><');
  if (!source) return '';
  const parts = source.split(/(?=<)|(?<=>)/g).filter(Boolean);
  let indent = 0;
  const out: string[] = [];
  for (const part of parts) {
    const token = part.trim();
    if (!token) continue;
    if (/^<\//.test(token)) indent = Math.max(0, indent - 1);
    out.push(`${'  '.repeat(indent)}${token}`);
    if (/^<[^!?/][^>]*[^/]>$/.test(token) && !/^<[^>]+><\/[^>]+>$/.test(token)) indent += 1;
  }
  return out.join('\n');
}

function tagValues(xml: string, localName: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escapeRegExp(localName)}>`, 'gi');
  return [...xml.matchAll(re)].map((match) => stripTags(match[1] ?? '').trim()).filter(Boolean);
}

function attrValues(xml: string, attr: string): string[] {
  const re = new RegExp(`\\b${escapeRegExp(attr)}=["']([^"']+)["']`, 'gi');
  return [...xml.matchAll(re)].map((match) => match[1] ?? '').filter(Boolean);
}

function tagCounts(xml: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const match of xml.matchAll(/<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\b[^>/]*(?:\/?)>/g)) {
    const name = match[2] ?? '';
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inspectSamlMessage(definition: DeveloperToolDefinition, xmlInput: string): DeveloperToolResult {
  const xml = xmlInput.trim();
  const formatted = formatXml(xml);
  const attributes = extractSamlAttributes(xml);
  const summary = {
    issuer: first(tagValues(xml, 'Issuer')),
    subject: first(tagValues(xml, 'NameID')) || first(tagValues(xml, 'Subject')),
    audience: tagValues(xml, 'Audience'),
    destination: first(attrValues(xml, 'Destination')),
    assertionId: first(attrValues(xml, 'ID')),
    notBefore: first(attrValues(xml, 'NotBefore')),
    notOnOrAfter: first(attrValues(xml, 'NotOnOrAfter')),
    attributes,
    signatureMethods: attrValues(xml, 'Algorithm').filter((value) => /xmldsig|rsa|ecdsa|sha|dsa/i.test(value)),
  };
  return result(definition, JSON.stringify(summary, null, 2), {
    outputLanguage: 'json',
    stats: [`${Object.keys(tagCounts(xml)).length} tag types`, `${Object.keys(attributes).length} attributes`],
    warnings: formatted.includes('<Signature') ? [] : ['No XML Signature element was found.'],
    sections: [{ title: 'Formatted XML', body: formatted, language: 'xml' }],
  });
}

function extractSamlAttributes(xml: string): Record<string, string[]> {
  const attrs: Record<string, string[]> = {};
  const re = /<([\w.-]+:)?Attribute\b([^>]*)>([\s\S]*?)<\/([\w.-]+:)?Attribute>/gi;
  for (const match of xml.matchAll(re)) {
    const name = /(?:Name|FriendlyName)=["']([^"']+)["']/i.exec(match[2] ?? '')?.[1];
    if (!name) continue;
    attrs[name] = tagValues(match[3] ?? '', 'AttributeValue');
  }
  return attrs;
}

function first(values: readonly string[]): string | null {
  return values[0] ?? null;
}

function samlRedirectBinding(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const endpoint = value(values, 'endpoint').trim();
  const messageName = value(values, 'messageName') || 'SAMLRequest';
  const xml = value(values, 'input').trim();
  const encoded = encodeURIComponent(encodeBase64(xml));
  const params = new URLSearchParams();
  params.set(messageName, encoded);
  if (value(values, 'relayState').trim()) params.set('RelayState', value(values, 'relayState').trim());
  const query = params.toString().replace(/%25/g, '%');
  const url = endpoint ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}` : query;
  return result(definition, url, {
    stats: [`${messageName} length: ${encoded.length}`],
    warnings: ['SAML HTTP-Redirect normally uses DEFLATE before Base64. This browser-safe builder emits the query structure and Base64 payload; use the decoded XML section to verify before sending.'],
    sections: [
      { title: 'Query string', body: query },
      { title: 'Decoded XML', body: formatXml(xml), language: 'xml' },
    ],
  });
}

function samlPostForm(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const endpoint = escapeHtml(value(values, 'endpoint').trim());
  const messageName = value(values, 'messageName') || 'SAMLResponse';
  const encoded = encodeBase64(value(values, 'input'));
  const relayState = value(values, 'relayState').trim();
  const html = `<form method="post" action="${endpoint}">
  <input type="hidden" name="${messageName}" value="${escapeHtml(encoded)}" />
${relayState ? `  <input type="hidden" name="RelayState" value="${escapeHtml(relayState)}" />\n` : ''}  <button type="submit">Continue</button>
</form>
<script>document.forms[0].submit();</script>`;
  return result(definition, html, { outputLanguage: 'html', stats: [`${messageName}: ${encoded.length} chars`] });
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function metadataParser(definition: DeveloperToolDefinition, xml: string): DeveloperToolResult {
  const summary = {
    entityId: first(attrValues(xml, 'entityID')),
    acs: extractElementsWithAttrs(xml, 'AssertionConsumerService'),
    sso: extractElementsWithAttrs(xml, 'SingleSignOnService'),
    slo: extractElementsWithAttrs(xml, 'SingleLogoutService'),
    certificates: tagValues(xml, 'X509Certificate').map((cert) => cert.replace(/\s+/g, '')).map((cert) => ({ length: cert.length, preview: `${cert.slice(0, 24)}...` })),
    roles: ['SPSSODescriptor', 'IDPSSODescriptor'].filter((tag) => new RegExp(`<[^>]*${tag}\\b`, 'i').test(xml)),
  };
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json', sections: [{ title: 'Formatted XML', body: formatXml(xml), language: 'xml' }] });
}

function extractElementsWithAttrs(xml: string, localName: string): Record<string, string>[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b([^>]*)\\/?>`, 'gi');
  return [...xml.matchAll(re)].map((match) => Object.fromEntries([...((match[1] ?? '').matchAll(/([\w:-]+)=["']([^"']+)["']/g))].map((attr) => [attr[1] ?? '', attr[2] ?? ''])));
}

function samlSpMetadata(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const cert = cleanPem(value(values, 'certificate'));
  const xml = `<EntityDescriptor entityID="${escapeHtml(value(values, 'entityId'))}" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
  <SPSSODescriptor AuthnRequestsSigned="${cert ? 'true' : 'false'}" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>${escapeHtml(value(values, 'nameIdFormat'))}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${escapeHtml(value(values, 'acsUrl'))}" index="0" isDefault="true"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${escapeHtml(value(values, 'sloUrl'))}"/>
${cert ? `    <KeyDescriptor use="signing"><KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><X509Data><X509Certificate>${cert}</X509Certificate></X509Data></KeyInfo></KeyDescriptor>` : ''}  </SPSSODescriptor>
</EntityDescriptor>`;
  return result(definition, formatXml(xml), { outputLanguage: 'xml' });
}

function samlIdpMetadata(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const cert = cleanPem(value(values, 'certificate'));
  const xml = `<EntityDescriptor entityID="${escapeHtml(value(values, 'entityId'))}" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
  <IDPSSODescriptor WantAuthnRequestsSigned="${cert ? 'true' : 'false'}" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${escapeHtml(value(values, 'ssoUrl'))}"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${escapeHtml(value(values, 'sloUrl'))}"/>
${cert ? `    <KeyDescriptor use="signing"><KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><X509Data><X509Certificate>${cert}</X509Certificate></X509Data></KeyInfo></KeyDescriptor>` : ''}  </IDPSSODescriptor>
</EntityDescriptor>`;
  return result(definition, formatXml(xml), { outputLanguage: 'xml' });
}

function cleanPem(input: string): string {
  return input.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
}

function samlTimeValidator(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const xml = value(values, 'input');
  const skew = Number(value(values, 'skewSeconds')) || 0;
  const now = Date.now();
  const notBefore = first(attrValues(xml, 'NotBefore'));
  const notOnOrAfter = first(attrValues(xml, 'NotOnOrAfter'));
  const nb = notBefore ? Date.parse(notBefore) : NaN;
  const noa = notOnOrAfter ? Date.parse(notOnOrAfter) : NaN;
  const checks = [
    `Now: ${new Date(now).toISOString()}`,
    `Allowed skew: ${skew}s`,
    notBefore ? `NotBefore: ${notBefore} -> ${Number.isNaN(nb) ? 'invalid' : now + skew * 1000 >= nb ? 'ok' : 'too early'}` : 'NotBefore: missing',
    notOnOrAfter ? `NotOnOrAfter: ${notOnOrAfter} -> ${Number.isNaN(noa) ? 'invalid' : now - skew * 1000 < noa ? 'ok' : 'expired'}` : 'NotOnOrAfter: missing',
  ];
  return result(definition, checks.join('\n'), { warnings: [!notBefore && 'No NotBefore condition found.', !notOnOrAfter && 'No NotOnOrAfter condition found.'].filter(Boolean) as string[] });
}

function signatureInspector(definition: DeveloperToolDefinition, xml: string): DeveloperToolResult {
  const summary = {
    signatureMethods: attrValues(xml, 'Algorithm').filter((item) => /rsa|ecdsa|sha|dsa|xmldsig/i.test(item)),
    references: attrValues(xml, 'URI'),
    transforms: extractElementsWithAttrs(xml, 'Transform').map((item) => item.Algorithm ?? item.algorithm ?? ''),
    digestMethods: extractElementsWithAttrs(xml, 'DigestMethod').map((item) => item.Algorithm ?? item.algorithm ?? ''),
    certificateCount: tagValues(xml, 'X509Certificate').length,
  };
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json' });
}

function samlAttributeMapper(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const attrs = extractSamlAttributes(value(values, 'input'));
  const mapped: Record<string, string | string[] | null> = {};
  for (const line of value(values, 'mapping').split(/\r?\n/)) {
    const [target, source] = line.split('=').map((part) => part?.trim());
    if (!target || !source) continue;
    mapped[target] = attrs[source]?.length === 1 ? attrs[source]![0]! : attrs[source] ?? null;
  }
  return result(definition, JSON.stringify({ attributes: attrs, mapped }, null, 2), { outputLanguage: 'json' });
}

function parseJsonish(input: string): unknown {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Input is empty.');
  try {
    return JSON.parse(trimmed);
  } catch {
    return yamlToJson(trimmed);
  }
}

function asRecord(input: unknown, label = 'Input'): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${label} must be an object.`);
  return input as Record<string, unknown>;
}

function oidcDiscovery(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const doc = asRecord(parseJsonish(input), 'Discovery document');
  const summary = {
    issuer: doc.issuer ?? null,
    endpoints: pick(doc, ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint', 'jwks_uri', 'end_session_endpoint']),
    responseTypes: doc.response_types_supported ?? [],
    grants: doc.grant_types_supported ?? [],
    idTokenAlgs: doc.id_token_signing_alg_values_supported ?? [],
    warnings: ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri'].filter((key) => !doc[key]),
  };
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json' });
}

function pick(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((key) => [key, source[key] ?? null]));
}

function decodeJwt(token: string): { header: Record<string, unknown>; payload: Record<string, unknown>; signingInput: string; signature: string } {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('JWT must have exactly three dot-separated parts.');
  const [headerPart, payloadPart, signature] = parts as [string, string, string];
  return {
    header: asRecord(JSON.parse(decodeBase64Text(headerPart)), 'JWT header'),
    payload: asRecord(JSON.parse(decodeBase64Text(payloadPart)), 'JWT payload'),
    signingInput: `${headerPart}.${payloadPart}`,
    signature,
  };
}

function oidcTokenValidator(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const decoded = decodeJwt(value(values, 'token'));
  const payload = decoded.payload;
  const now = Math.floor(Date.now() / 1000);
  const checks = [
    check('Issuer', payload.iss === value(values, 'issuer'), `${String(payload.iss ?? '')} expected ${value(values, 'issuer')}`),
    check('Audience', arrayIncludes(payload.aud, value(values, 'audience')), `${JSON.stringify(payload.aud)} expected ${value(values, 'audience')}`),
    value(values, 'nonce') ? check('Nonce', payload.nonce === value(values, 'nonce'), `${String(payload.nonce ?? '')} expected ${value(values, 'nonce')}`) : null,
    typeof payload.exp === 'number' ? check('Expiry', payload.exp > now, new Date(payload.exp * 1000).toISOString()) : 'WARN exp missing',
    typeof payload.iat === 'number' ? check('Issued at', payload.iat <= now + 300, new Date(payload.iat * 1000).toISOString()) : 'WARN iat missing',
  ];
  return result(definition, lines(checks), {
    sections: [
      { title: 'Header', body: JSON.stringify(decoded.header, null, 2), language: 'json' },
      { title: 'Payload', body: JSON.stringify(decoded.payload, null, 2), language: 'json' },
    ],
  });
}

function arrayIncludes(value: unknown, expected: string): boolean {
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}

function check(label: string, pass: boolean, detail: string): string {
  return `${pass ? 'PASS' : 'FAIL'} ${label}: ${detail}`;
}

async function pkceGenerator(definition: DeveloperToolDefinition, values: Values): Promise<DeveloperToolResult> {
  const length = Math.max(43, Math.min(128, Number(value(values, 'length')) || 64));
  const verifier = randomUrlString(length);
  const challenge = await shaBase64Url(verifier, 'SHA-256');
  return result(definition, JSON.stringify({ code_verifier: verifier, code_challenge: challenge, code_challenge_method: 'S256' }, null, 2), { outputLanguage: 'json' });
}

function randomUrlString(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  globalThis.crypto?.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]!).join('');
}

async function shaBase64Url(input: string, algorithm: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(algorithm, new TextEncoder().encode(input));
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function oauthUrlBuilder(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const endpoint = value(values, 'endpoint');
  const url = new URL(endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', value(values, 'clientId'));
  url.searchParams.set('redirect_uri', value(values, 'redirectUri'));
  url.searchParams.set('scope', value(values, 'scope'));
  if (value(values, 'state')) url.searchParams.set('state', value(values, 'state'));
  if (value(values, 'nonce')) url.searchParams.set('nonce', value(values, 'nonce'));
  if (value(values, 'codeChallenge')) {
    url.searchParams.set('code_challenge', value(values, 'codeChallenge'));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return result(definition, url.toString(), { sections: [{ title: 'Parameters', body: JSON.stringify(Object.fromEntries(url.searchParams), null, 2), language: 'json' }] });
}

function tokenResponseInspector(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const doc = asRecord(parseJsonish(input), 'Token response');
  const decoded: Record<string, unknown> = {};
  for (const key of ['access_token', 'id_token']) {
    if (typeof doc[key] === 'string' && String(doc[key]).split('.').length === 3) {
      try {
        decoded[key] = decodeJwt(String(doc[key])).payload;
      } catch {
        decoded[key] = 'JWT decode failed';
      }
    }
  }
  return result(definition, JSON.stringify({ token_type: doc.token_type, expires_in: doc.expires_in, scope: doc.scope, decoded }, null, 2), { outputLanguage: 'json' });
}

function jwksInspector(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const doc = asRecord(parseJsonish(input), 'JWKS');
  const keys = Array.isArray(doc.keys) ? doc.keys.map((key) => asRecord(key, 'JWK')) : [];
  const summary = keys.map((key) => ({ kid: key.kid ?? null, kty: key.kty ?? null, use: key.use ?? null, alg: key.alg ?? null, material: ['n', 'x', 'crv', 'k'].filter((field) => key[field]).join(', ') }));
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json', stats: [`${keys.length} keys`, `${new Set(keys.map((key) => String(key.kid ?? ''))).size} kids`] });
}

function jwkRotationDiff(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const oldKeys = jwkMap(value(values, 'old'));
  const newKeys = jwkMap(value(values, 'new'));
  const added = [...newKeys.keys()].filter((kid) => !oldKeys.has(kid));
  const removed = [...oldKeys.keys()].filter((kid) => !newKeys.has(kid));
  const changed = [...newKeys.keys()].filter((kid) => oldKeys.has(kid) && JSON.stringify(oldKeys.get(kid)) !== JSON.stringify(newKeys.get(kid)));
  return result(definition, JSON.stringify({ added, removed, changed }, null, 2), { outputLanguage: 'json' });
}

function jwkMap(input: string): Map<string, unknown> {
  const doc = asRecord(parseJsonish(input), 'JWKS');
  const keys = Array.isArray(doc.keys) ? doc.keys.map((key) => asRecord(key, 'JWK')) : [];
  return new Map(keys.map((key, index) => [String(key.kid ?? `index-${index}`), key]));
}

function scimPayload(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const body = {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: value(values, 'userName'),
    name: { givenName: value(values, 'givenName'), familyName: value(values, 'familyName') },
    emails: [{ value: value(values, 'email'), primary: true }],
    active: value(values, 'active') === 'true',
  };
  return result(definition, JSON.stringify(body, null, 2), { outputLanguage: 'json' });
}

function scimFilter(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const filter = value(values, 'filter');
  const rows = parseJsonish(value(values, 'input'));
  if (!Array.isArray(rows)) throw new Error('Users input must be a JSON array.');
  const match = /^([\w.]+)\s+(eq|ne|co|sw|ew)\s+"([^"]*)"$/i.exec(filter.trim());
  if (!match) throw new Error('This tester supports simple filters like userName eq "ada@example.com".');
  const attr = match[1]!;
  const op = match[2]!;
  const expected = match[3]!;
  const matched = rows.filter((row) => matchesOp(String(getPath(row, attr) ?? ''), op.toLowerCase(), expected));
  return result(definition, JSON.stringify(matched, null, 2), { outputLanguage: 'json', stats: [`${matched.length}/${rows.length} matched`] });
}

function getPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), source);
}

function matchesOp(actual: string, op: string, expected: string): boolean {
  if (op === 'eq') return actual === expected;
  if (op === 'ne') return actual !== expected;
  if (op === 'co') return actual.includes(expected);
  if (op === 'sw') return actual.startsWith(expected);
  if (op === 'ew') return actual.endsWith(expected);
  return false;
}

function soapEnvelopeBuilder(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const xml = soapEnvelope(value(values, 'version'), value(values, 'namespace'), value(values, 'operation'), value(values, 'body'));
  return result(definition, xml, { outputLanguage: 'xml' });
}

function soapEnvelope(version: string, namespace: string, operation: string, body: string): string {
  const ns = version === '1.2' ? 'http://www.w3.org/2003/05/soap-envelope' : 'http://schemas.xmlsoap.org/soap/envelope/';
  return formatXml(`<soap:Envelope xmlns:soap="${ns}" xmlns:m="${escapeHtml(namespace)}"><soap:Header/><soap:Body><m:${operation}>${body}</m:${operation}></soap:Body></soap:Envelope>`);
}

function soapRequestDebugger(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const headers = parseHeaderBlock(value(values, 'headers'));
  const xml = value(values, 'input');
  const version = xml.includes('http://www.w3.org/2003/05/soap-envelope') ? '1.2' : '1.1';
  const bodyInner = /<([\w.-]+:)?Body\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?Body>/i.exec(xml)?.[2] ?? '';
  const op = /<([\w.-]+:)?([\w.-]+)\b/.exec(bodyInner)?.[2] ?? null;
  return result(definition, JSON.stringify({ version, soapAction: headers.soapaction ?? headers.action ?? null, contentType: headers['content-type'] ?? null, operation: op }, null, 2), { outputLanguage: 'json', sections: [{ title: 'Formatted envelope', body: formatXml(xml), language: 'xml' }] });
}

function parseHeaderBlock(input: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of input.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function wsdlExplorer(definition: DeveloperToolDefinition, xml: string): DeveloperToolResult {
  const operations = extractElementsWithAttrs(xml, 'operation').map((item) => item.name).filter(Boolean);
  const summary = {
    targetNamespace: first(attrValues(xml, 'targetNamespace')),
    services: extractElementsWithAttrs(xml, 'service').map((item) => item.name).filter(Boolean),
    ports: extractElementsWithAttrs(xml, 'port').map((item) => item.name).filter(Boolean),
    portTypes: extractElementsWithAttrs(xml, 'portType').map((item) => item.name).filter(Boolean),
    operations,
    messages: extractElementsWithAttrs(xml, 'message').map((item) => item.name).filter(Boolean),
  };
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json', stats: [`${operations.length} operations`] });
}

function wsdlSampleSoap(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const namespace = first(attrValues(value(values, 'input'), 'targetNamespace')) ?? 'urn:example';
  const operation =
    value(values, 'operation').trim() ||
    first(
      extractElementsWithAttrs(value(values, 'input'), 'operation')
        .map((item) => item.name)
        .filter((name): name is string => Boolean(name)),
    ) ||
    'Operation';
  return result(definition, soapEnvelope('1.1', namespace, operation, '<!-- TODO: request fields -->'), { outputLanguage: 'xml' });
}

function soapFaultParser(definition: DeveloperToolDefinition, xml: string): DeveloperToolResult {
  const summary = {
    code: first(tagValues(xml, 'faultcode')) ?? first(tagValues(xml, 'Value')),
    reason: first(tagValues(xml, 'faultstring')) ?? first(tagValues(xml, 'Text')),
    actor: first(tagValues(xml, 'faultactor')) ?? first(tagValues(xml, 'Node')),
    detail: first(tagValues(xml, 'detail')) ?? first(tagValues(xml, 'Detail')),
  };
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json', sections: [{ title: 'Formatted XML', body: formatXml(xml), language: 'xml' }] });
}

function soapActionBuilder(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const version = value(values, 'version');
  const action = value(values, 'action');
  const charset = value(values, 'charset') || 'utf-8';
  const output = version === '1.2'
    ? `Content-Type: application/soap+xml; charset=${charset}; action="${action}"`
    : `Content-Type: text/xml; charset=${charset}\nSOAPAction: "${action}"`;
  return result(definition, output);
}

function httpSanitizer(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const redacted = input
    .replace(/(authorization:\s*)(.+)/gi, '$1<redacted>')
    .replace(/(cookie:\s*)(.+)/gi, '$1<redacted>')
    .replace(/(x-api-key:\s*)(.+)/gi, '$1<redacted>')
    .replace(/("(?:password|token|secret|apiKey|api_key)"\s*:\s*")([^"]+)(")/gi, '$1<redacted>$3');
  return result(definition, redacted, { warnings: redacted === input ? ['No obvious secret patterns were redacted.'] : [] });
}

function postmanViewer(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const collection = asRecord(parseJsonish(input), 'Collection');
  const items = flattenPostmanItems(collection.item);
  return result(definition, JSON.stringify({ name: asRecord(collection.info ?? {}, 'info').name ?? null, requests: items }, null, 2), { outputLanguage: 'json', stats: [`${items.length} requests`] });
}

function flattenPostmanItems(value: unknown, prefix = ''): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of value) {
    const row = asRecord(item, 'item');
    const name = [prefix, String(row.name ?? '')].filter(Boolean).join(' / ');
    if (row.request) {
      const req = asRecord(row.request, 'request');
      out.push({ name, method: req.method ?? 'GET', url: typeof req.url === 'string' ? req.url : JSON.stringify(req.url ?? '') });
    }
    out.push(...flattenPostmanItems(row.item, name));
  }
  return out;
}

function openapiLinter(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const spec = asRecord(parseJsonish(input), 'OpenAPI document');
  const issues = lintOpenApi(spec);
  return result(definition, JSON.stringify({ version: spec.openapi ?? spec.swagger ?? null, title: asRecord(spec.info ?? {}, 'info').title ?? null, paths: Object.keys(asRecord(spec.paths ?? {}, 'paths')).length, issues }, null, 2), { outputLanguage: 'json', warnings: issues });
}

function lintOpenApi(spec: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (!spec.openapi && !spec.swagger) issues.push('Missing openapi/swagger version.');
  if (!asRecord(spec.info ?? {}, 'info').title) issues.push('Missing info.title.');
  if (!asRecord(spec.info ?? {}, 'info').version) issues.push('Missing info.version.');
  const paths = asRecord(spec.paths ?? {}, 'paths');
  if (Object.keys(paths).length === 0) issues.push('No paths defined.');
  for (const [path, item] of Object.entries(paths)) {
    const ops = asRecord(item, `path ${path}`);
    for (const [method, op] of Object.entries(ops)) {
      if (!['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'].includes(method)) continue;
      if (!asRecord(asRecord(op, `${method} ${path}`).responses ?? {}, 'responses')['200'] && Object.keys(asRecord(asRecord(op, `${method} ${path}`).responses ?? {}, 'responses')).length === 0) issues.push(`${method.toUpperCase()} ${path} has no responses.`);
    }
  }
  return issues;
}

function openapiDiff(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const oldSpec = asRecord(parseJsonish(value(values, 'old')), 'Old OpenAPI');
  const newSpec = asRecord(parseJsonish(value(values, 'new')), 'New OpenAPI');
  const oldOps = operationSet(oldSpec);
  const newOps = operationSet(newSpec);
  const removed = [...oldOps].filter((op) => !newOps.has(op));
  const added = [...newOps].filter((op) => !oldOps.has(op));
  return result(definition, JSON.stringify({ removed, added, breaking: removed }, null, 2), { outputLanguage: 'json', warnings: removed.map((op) => `Removed operation: ${op}`) });
}

function operationSet(spec: Record<string, unknown>): Set<string> {
  const paths = asRecord(spec.paths ?? {}, 'paths');
  const out = new Set<string>();
  for (const [path, item] of Object.entries(paths)) {
    for (const method of Object.keys(asRecord(item, path))) {
      if (['get', 'put', 'post', 'delete', 'patch', 'options', 'head'].includes(method)) out.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return out;
}

function openapiExample(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const doc = parseJsonish(value(values, 'input'));
  const schemaName = value(values, 'schemaName').trim();
  let schema: unknown = doc;
  if (schemaName) {
    const root = asRecord(doc, 'OpenAPI document');
    schema = asRecord(asRecord(root.components ?? {}, 'components').schemas ?? {}, 'schemas')[schemaName];
  }
  return result(definition, JSON.stringify(exampleFromSchema(asRecord(schema, 'Schema')), null, 2), { outputLanguage: 'json' });
}

function exampleFromSchema(schema: Record<string, unknown>): unknown {
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && Array.isArray(schema.enum)) return schema.enum[0] ?? null;
  if (schema.type === 'array') return [exampleFromSchema(asRecord(schema.items ?? {}, 'items'))];
  if (schema.type === 'object' || schema.properties) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(asRecord(schema.properties ?? {}, 'properties'))) out[key] = exampleFromSchema(asRecord(child, key));
    return out;
  }
  if (schema.type === 'integer' || schema.type === 'number') return 1;
  if (schema.type === 'boolean') return true;
  if (schema.format === 'email') return 'user@example.com';
  if (schema.format === 'date-time') return '2026-06-03T12:00:00Z';
  return 'string';
}

function openapiSecurity(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const spec = asRecord(parseJsonish(input), 'OpenAPI document');
  const schemes = asRecord(asRecord(spec.components ?? {}, 'components').securitySchemes ?? {}, 'securitySchemes');
  const summary = Object.fromEntries(Object.entries(schemes).map(([name, value]) => {
    const scheme = asRecord(value, name);
    return [name, { type: scheme.type, scheme: scheme.scheme, in: scheme.in, name: scheme.name, flows: scheme.flows ? Object.keys(asRecord(scheme.flows, 'flows')) : [] }];
  }));
  return result(definition, JSON.stringify({ schemes: summary, rootSecurity: spec.security ?? [] }, null, 2), { outputLanguage: 'json' });
}

function asyncApiPreview(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const doc = asRecord(parseJsonish(input), 'AsyncAPI document');
  const channels = asRecord(doc.channels ?? {}, 'channels');
  return result(definition, JSON.stringify({ asyncapi: doc.asyncapi ?? null, title: asRecord(doc.info ?? {}, 'info').title ?? null, channels: Object.keys(channels), servers: Object.keys(asRecord(doc.servers ?? {}, 'servers')) }, null, 2), { outputLanguage: 'json', warnings: !doc.asyncapi ? ['Missing asyncapi version.'] : [] });
}

function cloudEventsValidator(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const event = asRecord(parseJsonish(input), 'CloudEvent');
  const required = ['specversion', 'id', 'source', 'type'];
  const missing = required.filter((key) => !event[key]);
  const warnings = [...missing.map((key) => `Missing ${key}.`)];
  if (event.time && Number.isNaN(Date.parse(String(event.time)))) warnings.push('time is not a valid ISO date.');
  return result(definition, JSON.stringify({ valid: missing.length === 0, missing, attributes: Object.keys(event) }, null, 2), { outputLanguage: 'json', warnings });
}

async function webhookVerifier(definition: DeveloperToolDefinition, values: Values): Promise<DeveloperToolResult> {
  const algorithm = value(values, 'algorithm') || 'SHA-256';
  const secret = value(values, 'secret');
  const payload = value(values, 'payload');
  const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: algorithm }, false, ['sign']);
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(sig)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const expected = value(values, 'signature').replace(/^sha\d+=/, '').toLowerCase();
  return result(definition, JSON.stringify({ algorithm, hex, prefixed: `${algorithm.toLowerCase().replace('-', '')}=${hex}`, matchesExpected: expected ? expected === hex : null }, null, 2), { outputLanguage: 'json' });
}

function webhookRetry(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const attempts = Math.max(1, Number(value(values, 'attempts')) || 1);
  const initial = Number(value(values, 'initialSeconds')) || 0;
  const multiplier = Number(value(values, 'multiplier')) || 1;
  const max = Number(value(values, 'maxSeconds')) || Number.POSITIVE_INFINITY;
  const jitter = (Number(value(values, 'jitterPercent')) || 0) / 100;
  let elapsed = 0;
  const rows: string[] = ['attempt,delay_seconds,earliest,latest,cumulative_seconds'];
  for (let i = 1; i <= attempts; i += 1) {
    const delay = Math.min(max, Math.round(initial * multiplier ** (i - 1)));
    elapsed += delay;
    rows.push(`${i},${delay},${Math.round(delay * (1 - jitter))},${Math.round(delay * (1 + jitter))},${elapsed}`);
  }
  return result(definition, rows.join('\n'), { outputLanguage: 'text' });
}

function graphqlIntrospection(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const root = asRecord(parseJsonish(input), 'Introspection JSON');
  const schema = asRecord(asRecord(root.data ?? root, 'data').__schema ?? {}, '__schema');
  const types = Array.isArray(schema.types) ? schema.types.map((item) => asRecord(item, 'type')) : [];
  return result(definition, JSON.stringify({ query: asRecord(schema.queryType ?? {}, 'queryType').name ?? null, mutation: asRecord(schema.mutationType ?? {}, 'mutationType').name ?? null, typeKinds: countBy(types.map((type) => String(type.kind ?? 'UNKNOWN'))), objectTypes: types.filter((type) => type.kind === 'OBJECT').map((type) => type.name) }, null, 2), { outputLanguage: 'json' });
}

function countBy(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

function graphqlComplexity(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const withoutStrings = input.replace(/"([^"\\]|\\.)*"/g, '""');
  let depth = 0;
  let maxDepth = 0;
  for (const ch of withoutStrings) {
    if (ch === '{') maxDepth = Math.max(maxDepth, ++depth);
    if (ch === '}') depth = Math.max(0, depth - 1);
  }
  const fields = [...withoutStrings.matchAll(/(?:^|[\s{])([_A-Za-z][_0-9A-Za-z]*)(?:\s*[:(]|[\s{])/g)].map((match) => match[1] ?? '').filter((name) => !['query', 'mutation', 'subscription', 'fragment', 'on'].includes(name));
  const summary = { maxDepth, fieldCount: fields.length, aliases: (withoutStrings.match(/\w+\s*:/g) ?? []).length, fragments: (withoutStrings.match(/\.\.\./g) ?? []).length, fieldHistogram: countBy(fields) };
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json' });
}

function graphqlVariables(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const op = value(values, 'operation');
  const variables = asRecord(parseJsonish(value(values, 'variables')), 'Variables');
  const varDefs = [...op.matchAll(/\$([_A-Za-z][_0-9A-Za-z]*)\s*:\s*([^,)]+)/g)].map((match) => ({ name: match[1] ?? '', type: (match[2] ?? '').trim(), required: /!/.test(match[2] ?? '') }));
  const missing = varDefs.filter((v) => v.required && variables[v.name] === undefined).map((v) => v.name);
  const extra = Object.keys(variables).filter((key) => !varDefs.some((v) => v.name === key));
  return result(definition, JSON.stringify({ definitions: varDefs, missingRequired: missing, extra }, null, 2), { outputLanguage: 'json', warnings: [...missing.map((key) => `Missing required variable ${key}.`), ...extra.map((key) => `Extra variable ${key}.`)] });
}

function protoViewer(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const services = [...input.matchAll(/\bservice\s+(\w+)\s*\{([\s\S]*?)\}/g)].map((match) => ({ name: match[1], rpcs: [...(match[2] ?? '').matchAll(/\brpc\s+(\w+)\s*\(([^)]+)\)\s+returns\s+\(([^)]+)\)/g)].map((rpc) => ({ name: rpc[1], request: rpc[2], response: rpc[3] })) }));
  const messages = [...input.matchAll(/\bmessage\s+(\w+)\s*\{([\s\S]*?)\}/g)].map((match) => ({ name: match[1], fields: [...(match[2] ?? '').matchAll(/\b(\w+(?:\.\w+)*)\s+(\w+)\s*=\s*(\d+)/g)].map((field) => ({ type: field[1], name: field[2], number: Number(field[3]) })) }));
  return result(definition, JSON.stringify({ package: /\bpackage\s+([\w.]+)\s*;/.exec(input)?.[1] ?? null, services, messages }, null, 2), { outputLanguage: 'json' });
}

function grpcurlBuilder(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const headers = value(values, 'headers').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => `-H ${shellQuote(line)}`);
  const body = value(values, 'body').trim();
  const command = ['grpcurl', value(values, 'plaintext') === 'true' ? '-plaintext' : null, ...headers, body ? `-d ${shellQuote(body)}` : null, shellQuote(value(values, 'host')), shellQuote(value(values, 'method'))].filter(Boolean).join(' \\\n  ');
  return result(definition, command, { outputLanguage: 'shell' });
}

function shellQuote(input: string): string {
  return /^[A-Za-z0-9_./:@%+=,-]+$/.test(input) ? input : `'${input.replace(/'/g, `'\\''`)}'`;
}

function protobufWireDecoder(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const bytes = parseBytes(input);
  const fields: Record<string, unknown>[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const key = readVarint(bytes, offset);
    offset = key.next;
    const fieldNumber = Number(key.value >> 3n);
    const wireType = Number(key.value & 7n);
    let raw = '';
    if (wireType === 0) {
      const value = readVarint(bytes, offset);
      offset = value.next;
      raw = value.value.toString();
    } else if (wireType === 2) {
      const len = readVarint(bytes, offset);
      offset = len.next;
      const length = Number(len.value);
      raw = new TextDecoder().decode(bytes.slice(offset, offset + length));
      offset += length;
    } else {
      raw = 'unsupported wire type';
      break;
    }
    fields.push({ fieldNumber, wireType, value: raw });
  }
  return result(definition, JSON.stringify(fields, null, 2), { outputLanguage: 'json', stats: [`${bytes.length} bytes`] });
}

function parseBytes(input: string): Uint8Array {
  const cleaned = input.trim();
  if (/^[0-9a-f\s]+$/i.test(cleaned)) return new Uint8Array(cleaned.split(/\s+/).filter(Boolean).map((part) => parseInt(part, 16)));
  return base64ToBytes(cleaned);
}

function readVarint(bytes: Uint8Array, start: number): { value: bigint; next: number } {
  let value = 0n;
  let shift = 0n;
  let offset = start;
  while (offset < bytes.length) {
    const byte = BigInt(bytes[offset]!);
    value |= (byte & 0x7fn) << shift;
    offset += 1;
    if ((byte & 0x80n) === 0n) break;
    shift += 7n;
  }
  return { value, next: offset };
}

function protobufJson(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const doc = parseJsonish(input);
  return result(definition, JSON.stringify(normalizeKeys(doc), null, 2), { outputLanguage: 'json' });
}

function normalizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, val]) => [key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), normalizeKeys(val)]));
  }
  return value;
}

function mqttMatcher(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const filter = value(values, 'filter');
  const topics = value(values, 'input').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const results = topics.map((topic) => ({ topic, matches: mqttMatch(filter, topic) }));
  return result(definition, JSON.stringify(results, null, 2), { outputLanguage: 'json', stats: [`${results.filter((row) => row.matches).length}/${results.length} matched`] });
}

function mqttMatch(filter: string, topic: string): boolean {
  const fp = filter.split('/');
  const tp = topic.split('/');
  for (let i = 0; i < fp.length; i += 1) {
    if (fp[i] === '#') return true;
    if (fp[i] !== '+' && fp[i] !== tp[i]) return false;
  }
  return fp.length === tp.length;
}

function kafkaHeaders(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const headers = Object.fromEntries(value(values, 'headers').split(/\r?\n/).map((line) => line.split(/[:=]/)).filter((parts) => parts.length >= 2).map((parts) => [parts[0]!.trim(), parts.slice(1).join('=').trim()]));
  let payload: unknown = value(values, 'payload');
  try {
    payload = parseJsonish(value(values, 'payload'));
  } catch {
    // Keep text payload.
  }
  return result(definition, JSON.stringify({ headers, payload, traceparent: headers.traceparent ?? null, contentType: headers['content-type'] ?? headers.contentType ?? null }, null, 2), { outputLanguage: 'json' });
}

function avroValidator(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const schema = asRecord(parseJsonish(input), 'Avro schema');
  const warnings: string[] = [];
  if (!schema.type) warnings.push('Missing type.');
  if (schema.type === 'record' && !schema.name) warnings.push('Record missing name.');
  const fields = Array.isArray(schema.fields) ? schema.fields.map((field) => asRecord(field, 'field')) : [];
  for (const field of fields) if (!field.name || !field.type) warnings.push(`Field ${String(field.name ?? '<unnamed>')} is missing name or type.`);
  return result(definition, JSON.stringify({ type: schema.type, name: schema.name ?? null, namespace: schema.namespace ?? null, fields: fields.map((field) => ({ name: field.name, type: field.type, hasDefault: field.default !== undefined })) }, null, 2), { outputLanguage: 'json', warnings });
}

function avroEvolution(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const oldFields = fieldMap(value(values, 'old'));
  const newFields = fieldMap(value(values, 'new'));
  const added = [...newFields.keys()].filter((field) => !oldFields.has(field));
  const removed = [...oldFields.keys()].filter((field) => !newFields.has(field));
  const addedWithoutDefault = added.filter((field) => !asRecord(newFields.get(field), field).hasOwnProperty('default'));
  return result(definition, JSON.stringify({ added, removed, addedWithoutDefault }, null, 2), { outputLanguage: 'json', warnings: addedWithoutDefault.map((field) => `New field ${field} has no default.`) });
}

function fieldMap(input: string): Map<string, unknown> {
  const schema = asRecord(parseJsonish(input), 'Schema');
  const fields = Array.isArray(schema.fields) ? schema.fields.map((field) => asRecord(field, 'field')) : [];
  return new Map(fields.map((field) => [String(field.name), field]));
}

function jsonSchemaDiff(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const oldSchema = asRecord(parseJsonish(value(values, 'old')), 'Old JSON Schema');
  const newSchema = asRecord(parseJsonish(value(values, 'new')), 'New JSON Schema');
  const oldProps = new Set(Object.keys(asRecord(oldSchema.properties ?? {}, 'old properties')));
  const newProps = new Set(Object.keys(asRecord(newSchema.properties ?? {}, 'new properties')));
  const oldReq = new Set(Array.isArray(oldSchema.required) ? oldSchema.required.map(String) : []);
  const newReq = new Set(Array.isArray(newSchema.required) ? newSchema.required.map(String) : []);
  const addedRequired = [...newReq].filter((key) => !oldReq.has(key));
  const removedProps = [...oldProps].filter((key) => !newProps.has(key));
  return result(definition, JSON.stringify({ addedProperties: [...newProps].filter((key) => !oldProps.has(key)), removedProperties: removedProps, addedRequired }, null, 2), { outputLanguage: 'json', warnings: [...removedProps.map((key) => `Removed property ${key}.`), ...addedRequired.map((key) => `New required property ${key}.`)] });
}

function multipartBuilder(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const fields = value(values, 'fields').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const curl = ['curl -X POST', ...fields.map((line) => `-F ${shellQuote(line)}`), shellQuote(value(values, 'url'))].join(' \\\n  ');
  return result(definition, curl, { outputLanguage: 'shell' });
}

function sseParser(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const events = input.split(/\n\n+/).map((block) => block.trim()).filter(Boolean).map((block) => {
    const event: Record<string, string[]> = {};
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(':')) {
        event.comment = [...(event.comment ?? []), line.slice(1).trim()];
        continue;
      }
      const idx = line.indexOf(':');
      const key = idx >= 0 ? line.slice(0, idx) : line;
      const val = idx >= 0 ? line.slice(idx + 1).trimStart() : '';
      event[key] = [...(event[key] ?? []), val];
    }
    return event;
  });
  return result(definition, JSON.stringify(events, null, 2), { outputLanguage: 'json', stats: [`${events.length} events`] });
}

function dnsDig(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const domain = value(values, 'domain');
  const type = value(values, 'recordType');
  const resolver = value(values, 'resolver');
  const command = `dig @${resolver} ${domain} ${type} +short`;
  return result(definition, command, { outputLanguage: 'shell', sections: [{ title: 'Pasted record summary', body: dnsRecordSummary(value(values, 'input')), language: 'text' }] });
}

function dnsRecordSummary(input: string): string {
  const rows = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return rows.map((line) => {
    const parts = line.split(/\s+/);
    return `${parts[0] ?? ''} ${parts[2] ?? ''} ${parts[3] ?? ''} ${parts.slice(4).join(' ')}`;
  }).join('\n');
}

function dnsCompare(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const rows = input.split(/\r?\n/).map((line) => {
    const idx = line.indexOf(':');
    return { resolver: idx >= 0 ? line.slice(0, idx).trim() : 'unknown', answer: idx >= 0 ? line.slice(idx + 1).trim() : line.trim() };
  }).filter((row) => row.answer);
  const groups = countBy(rows.map((row) => row.answer.replace(/\s+\d+\s+IN\s+/i, ' IN ')));
  return result(definition, JSON.stringify({ rows, answerGroups: groups, consistent: Object.keys(groups).length <= 1 }, null, 2), { outputLanguage: 'json' });
}

function dnsZone(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const rows = input.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith(';'));
  const warnings: string[] = [];
  if (!rows.some((line) => /\sSOA\s/i.test(line))) warnings.push('No SOA record found.');
  if (!rows.some((line) => /\sNS\s/i.test(line))) warnings.push('No NS record found.');
  const cnameNames = new Set(rows.filter((line) => /\sCNAME\s/i.test(line)).map((line) => line.split(/\s+/)[0]));
  for (const line of rows) {
    const name = line.split(/\s+/)[0];
    if (name && cnameNames.has(name) && !/\sCNAME\s/i.test(line)) warnings.push(`${name} has CNAME and another record.`);
  }
  return result(definition, JSON.stringify({ records: rows.length, warnings }, null, 2), { outputLanguage: 'json', warnings });
}

function dnssec(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const types = ['DS', 'DNSKEY', 'RRSIG', 'NSEC', 'NSEC3'].map((type) => ({ type, count: (input.match(new RegExp(`\\s${type}\\s`, 'gi')) ?? []).length }));
  return result(definition, JSON.stringify({ chain: types, checklist: ['Parent zone publishes DS.', 'Child zone publishes matching DNSKEY.', 'RRsets have current RRSIG signatures.', 'Denial of existence uses NSEC or NSEC3.'] }, null, 2), { outputLanguage: 'json' });
}

function spfBuilder(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const parts = ['v=spf1'];
  for (const item of splitWords(value(values, 'includes'))) parts.push(`include:${item}`);
  for (const item of splitWords(value(values, 'ipv4'))) parts.push(`ip4:${item}`);
  for (const item of splitWords(value(values, 'ipv6'))) parts.push(`ip6:${item}`);
  parts.push(value(values, 'all') || '~all');
  return result(definition, parts.join(' '));
}

function splitWords(input: string): string[] {
  return input.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean);
}

function spfAnalyzer(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const mechanisms = splitWords(input.replace(/^"|"$/g, ''));
  const lookupMechanisms = mechanisms.filter((part) => /^(include:|a\b|mx\b|ptr\b|exists:|redirect=)/i.test(part));
  return result(definition, JSON.stringify({ mechanisms, dnsLookupsEstimated: lookupMechanisms.length, lookupMechanisms, withinLimit: lookupMechanisms.length <= 10 }, null, 2), { outputLanguage: 'json', warnings: lookupMechanisms.length > 10 ? ['SPF exceeds the 10 DNS lookup limit.'] : [] });
}

function tagRecord(definition: DeveloperToolDefinition, input: string, kind: string): DeveloperToolResult {
  const tags = Object.fromEntries(input.replace(/^"|"$/g, '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const idx = part.indexOf('=');
    return [idx >= 0 ? part.slice(0, idx).trim() : part, idx >= 0 ? part.slice(idx + 1).trim() : ''];
  }));
  return result(definition, JSON.stringify({ kind, tags, warnings: recordWarnings(kind, tags) }, null, 2), { outputLanguage: 'json', warnings: recordWarnings(kind, tags) });
}

function recordWarnings(kind: string, tags: Record<string, string>): string[] {
  const warnings: string[] = [];
  if (kind === 'DKIM' && tags.v !== 'DKIM1') warnings.push('DKIM record should start with v=DKIM1.');
  if (kind === 'DKIM' && !tags.p) warnings.push('Missing p= public key.');
  if (kind === 'BIMI' && tags.v !== 'BIMI1') warnings.push('BIMI record should start with v=BIMI1.');
  if (kind === 'BIMI' && !tags.l) warnings.push('Missing l= SVG logo URL.');
  return warnings;
}

function dmarcBuilder(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const parts = [`v=DMARC1`, `p=${value(values, 'policy')}`, `pct=${value(values, 'pct') || '100'}`];
  if (value(values, 'alignment') === 'strict') parts.push('adkim=s', 'aspf=s');
  if (value(values, 'rua')) parts.push(`rua=${value(values, 'rua')}`);
  if (value(values, 'ruf')) parts.push(`ruf=${value(values, 'ruf')}`);
  return result(definition, parts.join('; '));
}

function dmarcXml(definition: DeveloperToolDefinition, xml: string): DeveloperToolResult {
  const summary = {
    org: first(tagValues(xml, 'org_name')),
    reportId: first(tagValues(xml, 'report_id')),
    records: [...xml.matchAll(/<record\b[\s\S]*?<\/record>/gi)].map((match) => {
      const record = match[0];
      return { sourceIp: first(tagValues(record, 'source_ip')), count: Number(first(tagValues(record, 'count')) ?? 0), disposition: first(tagValues(record, 'disposition')), dkim: first(tagValues(record, 'dkim')), spf: first(tagValues(record, 'spf')) };
    }),
  };
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json' });
}

function mtaSts(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const txtOk = /^v=STSv1;\s*id=/.test(value(values, 'txt'));
  const policy = Object.fromEntries(value(values, 'policy').split(/\r?\n/).map((line) => line.split(':')).filter((parts) => parts.length >= 2).map((parts) => [parts[0]!.trim(), parts.slice(1).join(':').trim()]));
  const warnings = [!txtOk && 'TXT record must look like v=STSv1; id=...', policy.version !== 'STSv1' && 'Policy version must be STSv1.', !policy.mode && 'Policy missing mode.', !policy.mx && 'Policy missing mx.', !policy.max_age && 'Policy missing max_age.'].filter(Boolean) as string[];
  return result(definition, JSON.stringify({ txtOk, policy }, null, 2), { outputLanguage: 'json', warnings });
}

function tlsRpt(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  return result(definition, `v=TLSRPTv1; rua=${value(values, 'rua') || 'mailto:tlsrpt@example.com'}`);
}

function certDecode(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const blocks = pemBlocks(input, 'CERTIFICATE');
  const summary = blocks.map((block, index) => ({ index: index + 1, base64Length: cleanPem(block).length, approxBytes: Math.floor(cleanPem(block).length * 0.75), subjectHints: [...block.matchAll(/CN=([^,\n]+)/g)].map((m) => m[1]) }));
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json', warnings: blocks.length === 0 ? ['No PEM certificate block found.'] : [] });
}

function pemBlocks(input: string, label: string): string[] {
  const re = new RegExp(`-----BEGIN ${label}-----[\\s\\S]*?-----END ${label}-----`, 'g');
  return [...input.matchAll(re)].map((match) => match[0]);
}

function certChain(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const blocks = pemBlocks(input, 'CERTIFICATE');
  return result(definition, JSON.stringify({ certificates: blocks.length, order: blocks.map((block, index) => ({ position: index + 1, base64Length: cleanPem(block).length })), checklist: ['Leaf certificate first.', 'Intermediate certificates after leaf.', 'Root usually omitted from server chain.'] }, null, 2), { outputLanguage: 'json' });
}

function csrTool(definition: DeveloperToolDefinition, values: Values): DeveloperToolResult {
  const command = `openssl req -new -newkey rsa:2048 -nodes -keyout ${shellQuote(value(values, 'commonName'))}.key -out ${shellQuote(value(values, 'commonName'))}.csr -subj ${shellQuote(`/CN=${value(values, 'commonName')}/O=${value(values, 'organization')}`)} -addext ${shellQuote(`subjectAltName=${value(values, 'san')}`)}`;
  const csrBlocks = pemBlocks(value(values, 'input'), 'CERTIFICATE REQUEST');
  return result(definition, command, { outputLanguage: 'shell', stats: [`${csrBlocks.length} pasted CSR blocks`] });
}

function ocspDecode(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const cleaned = cleanPem(input);
  let bytes = 0;
  try {
    bytes = base64ToBytes(cleaned).length;
  } catch {
    bytes = cleaned.length;
  }
  return result(definition, JSON.stringify({ inputLength: cleaned.length, decodedBytes: bytes, hints: ['Use openssl ocsp -respin response.der -text for full ASN.1 validation.', 'This local tool confirms payload shape and size without sending it anywhere.'] }, null, 2), { outputLanguage: 'json' });
}

function tlsCipher(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const name = input.trim().toUpperCase();
  const parts = name.replace(/^TLS_/, '').split('_WITH_');
  const pre = parts[0] ?? '';
  const suite = parts[1] ?? name.replace(/^TLS_/, '');
  const tokens = suite.split('_');
  const summary = { keyExchangeAuth: pre || (name.startsWith('TLS_AES') ? 'TLS 1.3 integrated handshake' : null), encryption: tokens.filter((token) => ['AES', 'CHACHA20', 'CAMELLIA', 'DES'].includes(token)).join(' ') || tokens.slice(0, 3).join(' '), mode: tokens.find((token) => ['GCM', 'CBC', 'POLY1305', 'CCM'].includes(token)) ?? null, hash: tokens.find((token) => /^SHA/.test(token)) ?? null, warnings: [/(_RC4_|_DES_|_3DES_|_MD5)/.test(name) ? 'Legacy or weak primitive detected.' : null].filter(Boolean) };
  return result(definition, JSON.stringify(summary, null, 2), { outputLanguage: 'json', warnings: summary.warnings as string[] });
}

function hsts(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const tags = Object.fromEntries(input.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [key, val = 'true'] = part.split('=');
    return [key!.toLowerCase(), val];
  }));
  const maxAge = Number(tags['max-age'] ?? 0);
  const warnings = [maxAge < 31536000 && 'max-age should be at least one year for preload.', !tags.includesubdomains && 'includeSubDomains is required for preload.', !tags.preload && 'preload directive is required for preload submission.'].filter(Boolean) as string[];
  return result(definition, JSON.stringify({ maxAge, includeSubDomains: Boolean(tags.includesubdomains), preload: Boolean(tags.preload), preloadReady: warnings.length === 0 }, null, 2), { outputLanguage: 'json', warnings });
}

function securityHeaders(definition: DeveloperToolDefinition, input: string): DeveloperToolResult {
  const headers = parseHeaderBlock(input);
  const required = ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy'];
  const missing = required.filter((key) => !headers[key]);
  const warnings = missing.map((key) => `Missing ${key}.`);
  return result(definition, JSON.stringify({ present: Object.keys(headers), missing, score: `${required.length - missing.length}/${required.length}` }, null, 2), { outputLanguage: 'json', warnings });
}

async function sriGenerator(definition: DeveloperToolDefinition, values: Values): Promise<DeveloperToolResult> {
  const algorithm = value(values, 'algorithm') || 'SHA-384';
  const digest = await globalThis.crypto.subtle.digest(algorithm, new TextEncoder().encode(value(values, 'input')));
  const b64 = bytesToBase64(new Uint8Array(digest));
  const attr = `${algorithm.toLowerCase().replace('-', '')}-${b64}`;
  return result(definition, attr, { sections: [{ title: 'Script tag example', body: `<script src="/app.js" integrity="${attr}" crossorigin="anonymous"></script>`, language: 'html' }] });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
