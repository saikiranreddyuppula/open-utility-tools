import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-keyboard-event-inspector-v1',
  name: 'Keyboard Event Inspector (Keycode Info)',
  slug: 'keyboard-event-inspector',
  description:
    'Press any key to see event.key, event.code, keyCode, location and modifiers, then copy a ready-made shortcut condition, hotkey string and event log.',
  category: 'web',
  tags: ['keyboard', 'keycode', 'event.key', 'event.code', 'hotkey', 'shortcut'],
  keywords: [
    'keycode',
    'key code',
    'event.code',
    'event.key',
    'keydown',
    'keyup',
    'keypress',
    'which',
    'charcode',
    'keyboard shortcut',
    'hotkey generator',
    'keyboard tester',
    'ime composition',
    'beforeinput',
    'keyboard layout map',
  ],
  icon: 'Keyboard',
  relatedTools: [],
};

export default meta;
