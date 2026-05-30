'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type LicenseId =
  | 'MIT' | 'Apache-2.0' | 'BSD-2-Clause' | 'BSD-3-Clause'
  | 'GPL-3.0' | 'LGPL-3.0' | 'ISC' | 'MPL-2.0' | 'Unlicense';

interface LicenseInfo {
  name: string;
  permissions: string;
  conditions: string;
  limitations: string;
  /** Returns the full license text. `full` indicates whether the body is the complete legal text. */
  build: (year: string, holder: string, project: string) => { text: string; full: boolean };
}

const MIT_TEXT = (year: string, holder: string) =>
`MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const ISC_TEXT = (year: string, holder: string) =>
`ISC License

Copyright (c) ${year} ${holder}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.`;

const BSD2_TEXT = (year: string, holder: string) =>
`BSD 2-Clause License

Copyright (c) ${year} ${holder}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

const BSD3_TEXT = (year: string, holder: string) =>
`BSD 3-Clause License

Copyright (c) ${year} ${holder}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

const UNLICENSE_TEXT = () =>
`This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or distribute
this software, either in source code form or as a compiled binary, for any
purpose, commercial or non-commercial, and by any means.

In jurisdictions that recognize copyright laws, the author or authors of this
software dedicate any and all copyright interest in the software to the public
domain. We make this dedication for the benefit of the public at large and to
the detriment of our heirs and successors. We intend this dedication to be an
overt act of relinquishment in perpetuity of all present and future rights to
this software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>`;

// For the long licenses (Apache, GPL, LGPL, MPL) the canonical text spans
// thousands of lines; we emit the official "how to apply" notice that the
// projects ship, plus a clear pointer to paste the full body below it.
const APACHE_NOTICE = (year: string, holder: string, project: string) =>
`${project ? project + '\n\n' : ''}Copyright ${year} ${holder}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

-----------------------------------------------------------------------
NOTE: Paste the full text of the Apache License 2.0 above this notice
when creating your LICENSE file. Get it from:
    https://www.apache.org/licenses/LICENSE-2.0.txt`;

const GPL_NOTICE = (year: string, holder: string, project: string) =>
`${project || 'This program'}
Copyright (C) ${year} ${holder}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

-----------------------------------------------------------------------
NOTE: Distribute the full GNU GPL v3 text alongside this notice. Get it from:
    https://www.gnu.org/licenses/gpl-3.0.txt`;

const LGPL_NOTICE = (year: string, holder: string, project: string) =>
`${project || 'This library'}
Copyright (C) ${year} ${holder}

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 3 of the License, or (at your option) any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this library; if not, see
<https://www.gnu.org/licenses/>.

-----------------------------------------------------------------------
NOTE: Distribute the full GNU LGPL v3 text alongside this notice. Get it from:
    https://www.gnu.org/licenses/lgpl-3.0.txt`;

const MPL_NOTICE = (year: string, holder: string, project: string) =>
`${project ? project + '\n' : ''}Copyright (c) ${year} ${holder}

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.

-----------------------------------------------------------------------
NOTE: Distribute the full Mozilla Public License 2.0 text alongside this
notice. Get it from:
    https://www.mozilla.org/media/MPL/2.0/index.txt`;

const LICENSES: Record<LicenseId, LicenseInfo> = {
  'MIT': {
    name: 'MIT License',
    permissions: 'Commercial use, modification, distribution, private use',
    conditions: 'Include copyright + license notice',
    limitations: 'No liability, no warranty',
    build: (y, h) => ({ text: MIT_TEXT(y, h), full: true }),
  },
  'Apache-2.0': {
    name: 'Apache License 2.0',
    permissions: 'Commercial use, modification, distribution, patent grant',
    conditions: 'License + NOTICE, state changes',
    limitations: 'No trademark use, no liability, no warranty',
    build: (y, h, p) => ({ text: APACHE_NOTICE(y, h, p), full: false }),
  },
  'BSD-2-Clause': {
    name: 'BSD 2-Clause License',
    permissions: 'Commercial use, modification, distribution, private use',
    conditions: 'Include copyright + license notice',
    limitations: 'No liability, no warranty',
    build: (y, h) => ({ text: BSD2_TEXT(y, h), full: true }),
  },
  'BSD-3-Clause': {
    name: 'BSD 3-Clause License',
    permissions: 'Commercial use, modification, distribution, private use',
    conditions: 'Include notice; no endorsement using author names',
    limitations: 'No liability, no warranty',
    build: (y, h) => ({ text: BSD3_TEXT(y, h), full: true }),
  },
  'GPL-3.0': {
    name: 'GNU GPL v3.0',
    permissions: 'Commercial use, modification, distribution, patent grant',
    conditions: 'Disclose source, same license, state changes',
    limitations: 'No liability, no warranty',
    build: (y, h, p) => ({ text: GPL_NOTICE(y, h, p), full: false }),
  },
  'LGPL-3.0': {
    name: 'GNU LGPL v3.0',
    permissions: 'Commercial use, modification, distribution (linking allowed)',
    conditions: 'Disclose source of library, same license for library',
    limitations: 'No liability, no warranty',
    build: (y, h, p) => ({ text: LGPL_NOTICE(y, h, p), full: false }),
  },
  'ISC': {
    name: 'ISC License',
    permissions: 'Commercial use, modification, distribution, private use',
    conditions: 'Include copyright + license notice',
    limitations: 'No liability, no warranty',
    build: (y, h) => ({ text: ISC_TEXT(y, h), full: true }),
  },
  'MPL-2.0': {
    name: 'Mozilla Public License 2.0',
    permissions: 'Commercial use, modification, distribution, patent grant',
    conditions: 'Disclose source (file-level copyleft), same license per file',
    limitations: 'No trademark use, no liability, no warranty',
    build: (y, h, p) => ({ text: MPL_NOTICE(y, h, p), full: false }),
  },
  'Unlicense': {
    name: 'The Unlicense',
    permissions: 'Public domain — do anything',
    conditions: 'None',
    limitations: 'No liability, no warranty',
    build: () => ({ text: UNLICENSE_TEXT(), full: true }),
  },
};

const ORDER: LicenseId[] = [
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause',
  'GPL-3.0', 'LGPL-3.0', 'ISC', 'MPL-2.0', 'Unlicense',
];

export default function OpenSourceLicenseGeneratorTool() {
  const currentYear = new Date().getFullYear().toString();
  const [license, setLicense] = useState<LicenseId>('MIT');
  const [year, setYear] = useState(currentYear);
  const [endYear, setEndYear] = useState('');
  const [holder, setHolder] = useState('Your Name');
  const [project, setProject] = useState('');
  const [spdxHeader, setSpdxHeader] = useState(false);

  const info = LICENSES[license];

  const output = useMemo(() => {
    const yr = endYear.trim() ? `${year.trim()}-${endYear.trim()}` : year.trim() || currentYear;
    const built = info.build(yr, holder.trim() || 'Your Name', project.trim());
    let text = built.text;
    if (spdxHeader) {
      text = `SPDX-License-Identifier: ${license}\n\n${text}`;
    }
    return { text, full: built.full };
  }, [info, license, year, endYear, holder, project, spdxHeader, currentYear]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="License">
            <Select value={license} onValueChange={(v) => setLicense(v as LicenseId)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER.map((id) => (
                  <SelectItem key={id} value={id}>{LICENSES[id].name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Year">
            <Input value={year} onChange={(e) => setYear(e.target.value)} className="w-24 font-mono" inputMode="numeric" />
          </Field>
          <Field label="End year (range)">
            <Input value={endYear} onChange={(e) => setEndYear(e.target.value)} className="w-24 font-mono" inputMode="numeric" placeholder="optional" />
          </Field>
          <Field label="Copyright holder" className="min-w-[200px] flex-1">
            <Input value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Your Name or Company" />
          </Field>
          <Field label="Project name" className="min-w-[160px]">
            <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="optional" />
          </Field>
          <Field label="SPDX header">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={spdxHeader} onCheckedChange={setSpdxHeader} id="spdx" />
              <Label htmlFor="spdx" className="text-xs text-muted-foreground">Prefix identifier</Label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <div className="grid grid-cols-1 gap-2 border-b bg-muted/30 p-3 text-xs sm:grid-cols-3">
          <div><span className="font-semibold text-muted-foreground">Permissions: </span>{info.permissions}</div>
          <div><span className="font-semibold text-muted-foreground">Conditions: </span>{info.conditions}</div>
          <div><span className="font-semibold text-muted-foreground">Limitations: </span>{info.limitations}</div>
        </div>
        <PanelHeader title="LICENSE">
          <CopyButton value={() => output.text} label="Copy" />
          <DownloadButton data={() => output.text} filename="LICENSE" />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed">
          {output.text}
        </pre>
        <StatBar
          items={[
            info.name,
            output.full ? 'complete license text' : 'standard notice — append full text',
          ]}
        />
      </Panel>
    </div>
  );
}
