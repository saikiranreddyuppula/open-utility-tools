'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, Field, OptionsBar, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { CopyButton } from '@/components/tools/copy-button';
import { ResultPreview } from '@/components/tools/result-preview';
import { formatBytes } from '@/lib/download';

type Wrap = 'raw' | 'css' | 'html' | 'md';

export default function ImageToBase64Tool() {
  const [dataUri, setDataUri] = useState('');
  const [name, setName] = useState('');
  const [size, setSize] = useState(0);
  const [mime, setMime] = useState('');
  const [wrap, setWrap] = useState<Wrap>('raw');
  const [blob, setBlob] = useState<Blob | null>(null);

  const onFiles = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setName(file.name);
    setSize(file.size);
    setMime(file.type || 'application/octet-stream');
    setBlob(file);
    const reader = new FileReader();
    reader.onload = () => setDataUri(String(reader.result));
    reader.readAsDataURL(file);
  }, []);

  const output = (() => {
    if (!dataUri) return '';
    switch (wrap) {
      case 'css':
        return `background-image: url("${dataUri}");`;
      case 'html':
        return `<img src="${dataUri}" alt="${name}" />`;
      case 'md':
        return `![${name}](${dataUri})`;
      default:
        return dataUri;
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone onFiles={onFiles} accept="image/*" label="Drop an image" hint="any image · click to browse" compact={!!dataUri} />

      {dataUri && (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
            <ResultPreview data={blob} mime={mime} filename={name} />
            <Panel>
              <PanelHeader title="Data URI">
                <CopyButton value={() => output} />
              </PanelHeader>
              <OptionsBar className="rounded-none border-0 border-b bg-muted/30">
                <Field label="Wrap as">
                  <Tabs value={wrap} onValueChange={(v) => setWrap(v as Wrap)}>
                    <TabsList>
                      <TabsTrigger value="raw">Raw</TabsTrigger>
                      <TabsTrigger value="css">CSS</TabsTrigger>
                      <TabsTrigger value="html">HTML</TabsTrigger>
                      <TabsTrigger value="md">MD</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </Field>
              </OptionsBar>
              <textarea
                value={output}
                readOnly
                className="min-h-40 w-full resize-y bg-transparent p-3 font-mono text-xs outline-none"
              />
              <StatBar
                items={[
                  `source: ${formatBytes(size)}`,
                  `base64: ${formatBytes(dataUri.length)}`,
                  `+${Math.round((dataUri.length / size - 1) * 100)}% size`,
                ]}
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
