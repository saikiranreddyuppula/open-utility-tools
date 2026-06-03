import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-dkim-record-decoder-v1",
  name: "DKIM Record Decoder",
  slug: "dkim-record-decoder",
  description: "Decode DKIM TXT records and extract version, key type, flags, hash list, service, and public key hints.",
  category: "web",
  tags: ["dkim","dns","email","txt"],
  keywords: ["dkim","dns","email","txt"],
  icon: "KeyRound",
  relatedTools: [],
};

export default meta;
