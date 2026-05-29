import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-totp-v1',
  name: 'TOTP / 2FA Code Generator',
  slug: 'totp-generator',
  description: 'Generate time-based one-time passwords (TOTP) from a Base32 secret.',
  category: 'crypto',
  tags: ['totp', '2fa', 'otp', 'authenticator', 'mfa'],
  keywords: ['totp', '2fa', 'one time password', 'authenticator', 'google authenticator', 'mfa'],
  icon: 'Timer',
  relatedTools: ['hmac-generator', 'jwt-generator', 'password-generator'],
};

export default meta;
