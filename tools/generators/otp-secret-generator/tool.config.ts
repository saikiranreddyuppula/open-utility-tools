import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-otp-secret-generator-v1',
  name: 'OTP Secret Generator',
  slug: 'otp-secret-generator',
  description: 'Generate Base32 TOTP/HOTP shared secrets and a matching otpauth:// URI.',
  category: 'generators',
  tags: ['otp', 'totp', 'base32', 'secret', '2fa'],
  keywords: ['otp secret', 'totp', 'hotp', '2fa', 'authenticator', 'base32 secret', 'otpauth uri', 'mfa'],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
