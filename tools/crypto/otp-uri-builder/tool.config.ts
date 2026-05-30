import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-otp-uri-builder-v1',
  name: 'OTPAuth URI & QR Builder',
  slug: 'otp-uri-builder',
  description:
    'Build otpauth:// provisioning URIs for TOTP/HOTP authenticator apps from a Base32 secret and render a scannable QR code.',
  category: 'crypto',
  tags: ['otp', 'totp', 'hotp', 'qr', '2fa', 'authenticator'],
  keywords: [
    'otpauth',
    'totp',
    'hotp',
    'two factor',
    '2fa',
    'authenticator',
    'qr code',
    'provisioning uri',
    'base32 secret',
    'google authenticator',
  ],
  icon: 'QrCode',
  relatedTools: [],
};

export default meta;
