'use client';

import { useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field, OptionsBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

type Separator = 'hyphen' | 'space' | 'dot' | 'none';

const SEP_CHAR: Record<Separator, string> = {
  hyphen: '-',
  space: ' ',
  dot: '.',
  none: '',
};

// Compact EFF-style wordlist: short, common, easy-to-type words.
const WORDS: string[] = [
  'able', 'acid', 'acorn', 'actor', 'agent', 'album', 'alert', 'alien', 'alpha', 'amber',
  'angle', 'ankle', 'apple', 'april', 'apron', 'arena', 'armor', 'arrow', 'aside', 'asset',
  'atlas', 'audio', 'aunt', 'award', 'awake', 'badge', 'baker', 'banjo', 'basil', 'basin',
  'batch', 'beach', 'beard', 'beast', 'begin', 'being', 'belt', 'bench', 'berry', 'bird',
  'black', 'blade', 'blank', 'blast', 'blaze', 'blend', 'bless', 'blink', 'block', 'bloom',
  'blue', 'board', 'boast', 'bonus', 'boost', 'booth', 'brain', 'brake', 'branch', 'brave',
  'bread', 'break', 'brick', 'bride', 'brief', 'bring', 'brisk', 'broad', 'brook', 'brown',
  'brush', 'buddy', 'build', 'bunch', 'cabin', 'cable', 'cache', 'camel', 'candy', 'cargo',
  'carol', 'carry', 'carve', 'catch', 'cause', 'cedar', 'chain', 'chair', 'chalk', 'charm',
  'chart', 'chase', 'cheap', 'cheer', 'chess', 'chest', 'chief', 'child', 'chill', 'chime',
  'choir', 'chord', 'chose', 'civic', 'civil', 'claim', 'clamp', 'clash', 'clasp', 'class',
  'clean', 'clear', 'clerk', 'click', 'cliff', 'climb', 'cloak', 'clock', 'close', 'cloth',
  'cloud', 'clove', 'clown', 'coach', 'coast', 'cobra', 'cocoa', 'coral', 'corn', 'couch',
  'cough', 'count', 'cover', 'crack', 'craft', 'crane', 'crash', 'crate', 'crawl', 'crazy',
  'cream', 'creek', 'crew', 'crisp', 'crop', 'cross', 'crowd', 'crown', 'crumb', 'crush',
  'crust', 'cube', 'curve', 'cycle', 'daily', 'dairy', 'dance', 'dandy', 'dawn', 'deal',
  'dealt', 'debug', 'decay', 'decoy', 'delay', 'delta', 'dense', 'depth', 'desk', 'diary',
  'dice', 'diet', 'digit', 'dime', 'diner', 'dingo', 'diver', 'dizzy', 'dock', 'donor',
  'doubt', 'dough', 'dove', 'dozen', 'draft', 'drain', 'drama', 'drank', 'draw', 'dream',
  'dress', 'dried', 'drift', 'drill', 'drink', 'drive', 'drone', 'drove', 'drum', 'dryer',
  'duck', 'dune', 'dusk', 'dwarf', 'eagle', 'early', 'earth', 'easel', 'east', 'eaten',
  'ebony', 'edge', 'eight', 'elbow', 'elder', 'elf', 'elite', 'elk', 'email', 'ember',
  'empty', 'enjoy', 'enter', 'envoy', 'equal', 'erase', 'error', 'essay', 'ether', 'event',
  'every', 'exact', 'exam', 'exit', 'extra', 'fable', 'fade', 'faint', 'fairy', 'faith',
  'false', 'fancy', 'fang', 'fault', 'fawn', 'feast', 'felt', 'fence', 'ferry', 'fetch',
  'fever', 'fewer', 'fiber', 'field', 'fifth', 'fifty', 'fig', 'fight', 'final', 'finch',
  'first', 'fish', 'fist', 'fix', 'flag', 'flame', 'flank', 'flash', 'flask', 'flat',
  'flaw', 'fleet', 'flesh', 'flint', 'float', 'flock', 'flood', 'floor', 'flour', 'flow',
  'fluid', 'flush', 'flute', 'foam', 'focal', 'focus', 'foggy', 'foil', 'folk', 'fond',
  'food', 'foot', 'force', 'forge', 'fork', 'forty', 'found', 'fox', 'frame', 'frank',
  'fresh', 'fried', 'frill', 'frog', 'front', 'frost', 'frown', 'fruit', 'fuel', 'full',
  'fungus', 'funny', 'fury', 'fuse', 'fuzzy', 'gain', 'gala', 'game', 'gamma', 'gap',
  'gas', 'gate', 'gaze', 'gear', 'gecko', 'gem', 'genie', 'genre', 'ghost', 'giant',
  'gift', 'ginger', 'given', 'glad', 'glare', 'glass', 'glaze', 'gleam', 'glide', 'globe',
  'gloom', 'glory', 'glove', 'glow', 'glue', 'goal', 'goat', 'going', 'gold', 'golf',
  'gone', 'goose', 'gore', 'gorge', 'gourd', 'grab', 'grace', 'grade', 'grain', 'grand',
  'grant', 'grape', 'graph', 'grasp', 'grass', 'grave', 'gravy', 'gray', 'great', 'greed',
  'green', 'greet', 'grew', 'grid', 'grief', 'grill', 'grim', 'grime', 'grin', 'grind',
  'grip', 'groan', 'groom', 'grove', 'growl', 'grown', 'gruff', 'guard', 'guess', 'guest',
  'guide', 'guild', 'gulf', 'gull', 'gully', 'gulp', 'gust', 'habit', 'hail', 'hairy',
  'half', 'hall', 'halt', 'hand', 'handy', 'happy', 'harbor', 'hardy', 'harm', 'harsh',
  'haste', 'hatch', 'hawk', 'hazel', 'heap', 'heart', 'heavy', 'hedge', 'hello', 'helm',
  'herb', 'herd', 'hero', 'hill', 'hint', 'hippo', 'hive', 'hobby', 'holly', 'home',
  'honey', 'honor', 'hood', 'hook', 'hope', 'horn', 'horse', 'hotel', 'hound', 'hour',
  'house', 'hover', 'hue', 'huge', 'human', 'humid', 'humor', 'hunt', 'hurry', 'husky',
  'hutch', 'hymn', 'icon', 'ideal', 'idle', 'igloo', 'image', 'index', 'inlet', 'input',
  'iris', 'iron', 'islet', 'item', 'ivory', 'ivy', 'jacket', 'jade', 'jaguar', 'jam',
  'jazz', 'jeans', 'jelly', 'jet', 'jewel', 'jolly', 'judge', 'juice', 'juicy', 'jumbo',
  'jump', 'jungle', 'junior', 'juror', 'kayak', 'keel', 'keen', 'kept', 'kettle', 'kayak',
  'kick', 'kind', 'king', 'kiosk', 'kite', 'kitten', 'kiwi', 'knack', 'knee', 'knew',
  'knife', 'knob', 'knock', 'knoll', 'known', 'koala', 'label', 'labor', 'lace', 'lake',
  'lamb', 'lamp', 'lance', 'land', 'lane', 'lapel', 'large', 'lark', 'laser', 'last',
  'latch', 'later', 'lava', 'lawn', 'layer', 'leaf', 'leap', 'learn', 'lease', 'leash',
  'least', 'ledge', 'lemon', 'lend', 'lens', 'level', 'lever', 'light', 'lilac', 'lily',
  'lime', 'limit', 'line', 'linen', 'liner', 'link', 'lion', 'list', 'liter', 'lively',
  'liver', 'lizard', 'llama', 'load', 'loaf', 'loan', 'lobby', 'local', 'lock', 'lodge',
  'loft', 'logic', 'lone', 'long', 'loop', 'loose', 'lord', 'lotus', 'loud', 'lovely',
  'lower', 'loyal', 'lucky', 'lunar', 'lunch', 'lung', 'lush', 'lute', 'lying', 'lyric',
  'macro', 'madam', 'magic', 'magma', 'maize', 'major', 'maker', 'mango', 'manor', 'maple',
  'march', 'mardi', 'marsh', 'mason', 'match', 'mayor', 'maze', 'meadow', 'meal', 'meant',
  'medal', 'media', 'melon', 'mercy', 'merge', 'merit', 'merry', 'mesa', 'metal', 'meter',
  'metro', 'micro', 'midst', 'might', 'milk', 'mind', 'mine', 'mini', 'mint', 'minus',
  'mist', 'mixer', 'moat', 'mocha', 'model', 'modem', 'mogul', 'mold', 'moment', 'money',
  'monk', 'month', 'mood', 'moon', 'moose', 'moped', 'moral', 'morph', 'moss', 'motel',
  'motor', 'motto', 'mound', 'mount', 'mouse', 'mouth', 'movie', 'mower', 'mud', 'mug',
  'mule', 'mummy', 'mural', 'music', 'musk', 'myth', 'nacho', 'nasal', 'navy', 'near',
  'neat', 'neck', 'nectar', 'need', 'neon', 'nerve', 'nest', 'never', 'newer', 'newt',
  'nice', 'niche', 'night', 'ninja', 'ninth', 'noble', 'node', 'noise', 'noisy', 'nomad',
  'noon', 'north', 'nose', 'notch', 'note', 'novel', 'nudge', 'nurse', 'nut', 'oak',
  'oasis', 'oat', 'ocean', 'octave', 'offer', 'often', 'ogre', 'oil', 'olive', 'omega',
  'onion', 'onset', 'opal', 'open', 'opera', 'orbit', 'orca', 'organ', 'otter', 'ounce',
  'outer', 'oval', 'oven', 'owl', 'owner', 'ozone', 'pace', 'pact', 'paddle', 'pagan',
  'page', 'pail', 'paint', 'pair', 'palm', 'panda', 'panel', 'pansy', 'paper', 'parade',
  'park', 'parka', 'parry', 'party', 'pasta', 'paste', 'patch', 'path', 'patio', 'pause',
  'paw', 'peace', 'peach', 'pearl', 'pecan', 'pedal', 'peer', 'penny', 'peony', 'perch',
  'perk', 'pesto', 'petal', 'phase', 'phone', 'photo', 'piano', 'pick', 'piece', 'pier',
  'piglet', 'pike', 'pill', 'pilot', 'pinch', 'pine', 'pink', 'pint', 'pipe', 'pivot',
  'pixel', 'pixie', 'pizza', 'place', 'plaid', 'plain', 'plane', 'plank', 'plant', 'plate',
  'plaza', 'plead', 'pleat', 'plot', 'plow', 'pluck', 'plug', 'plum', 'plush', 'pod',
  'poem', 'poet', 'point', 'poise', 'poker', 'polar', 'polka', 'pollen', 'pond', 'pony',
  'porch', 'pork', 'port', 'pose', 'posh', 'post', 'pouch', 'pound', 'power', 'prank',
  'press', 'price', 'pride', 'prime', 'print', 'prior', 'prism', 'prize', 'probe', 'prone',
  'proof', 'prop', 'proud', 'prove', 'prowl', 'proxy', 'prune', 'pulp', 'pulse', 'pump',
  'punch', 'pupil', 'puppy', 'purse', 'putty', 'quad', 'quail', 'quake', 'quart', 'queen',
  'query', 'quest', 'queue', 'quick', 'quiet', 'quill', 'quilt', 'quirk', 'quota', 'quote',
  'rabbit', 'race', 'rack', 'radar', 'radio', 'raft', 'rail', 'rainy', 'raise', 'rally',
  'ranch', 'range', 'rank', 'rapid', 'rare', 'raven', 'razor', 'reach', 'react', 'realm',
  'rebel', 'recap', 'reef', 'relax', 'relay', 'relic', 'remix', 'renew', 'reset', 'resin',
  'rhino', 'rhyme', 'rice', 'rider', 'ridge', 'rifle', 'right', 'rigid', 'rinse', 'riot',
  'ripe', 'ripple', 'risen', 'risk', 'rival', 'river', 'roach', 'road', 'roar', 'roast',
  'robe', 'robin', 'robot', 'rock', 'rocky', 'rodeo', 'rogue', 'roman', 'roof', 'rook',
  'room', 'roost', 'root', 'rope', 'rose', 'rotor', 'rouge', 'rough', 'round', 'route',
  'rover', 'royal', 'ruby', 'rug', 'ruler', 'rumor', 'runner', 'rural', 'rust', 'sable',
  'sad', 'safari', 'safe', 'saga', 'sail', 'saint', 'salad', 'salon', 'salsa', 'salt',
  'salty', 'samba', 'sand', 'sandy', 'sash', 'sauce', 'sauna', 'saver', 'savor', 'scale',
  'scalp', 'scan', 'scarf', 'scary', 'scene', 'scent', 'scoop', 'scope', 'score', 'scout',
  'scrap', 'scrub', 'scuba', 'seal', 'seam', 'seat', 'sedan', 'seed', 'seek', 'sense',
  'serum', 'serve', 'seven', 'sewer', 'shack', 'shade', 'shady', 'shaft', 'shake', 'shaky',
  'shale', 'shall', 'shame', 'shape', 'share', 'shark', 'sharp', 'shawl', 'shear', 'sheen',
  'sheep', 'sheet', 'shelf', 'shell', 'shift', 'shine', 'shiny', 'ship', 'shirt', 'shoal',
  'shock', 'shoe', 'shone', 'shoot', 'shore', 'short', 'shout', 'shove', 'shown', 'showy',
  'shrub', 'shrug', 'shy', 'sick', 'side', 'siege', 'sift', 'sigh', 'sight', 'silk',
  'silky', 'silly', 'silo', 'since', 'siren', 'sixth', 'sixty', 'sizer', 'skate', 'sketch',
  'ski', 'skid', 'skiff', 'skill', 'skin', 'skip', 'skirt', 'skull', 'skunk', 'sky',
  'slab', 'slack', 'slam', 'slang', 'slant', 'slate', 'sled', 'sleek', 'sleep', 'sleet',
  'slept', 'slice', 'slick', 'slide', 'slim', 'slime', 'sling', 'slip', 'slope', 'sloth',
  'slug', 'slump', 'small', 'smart', 'smash', 'smell', 'smile', 'smirk', 'smoke', 'smoky',
  'snack', 'snail', 'snake', 'snap', 'snare', 'sneak', 'sniff', 'snore', 'snow', 'snowy',
  'snug', 'soap', 'soapy', 'soar', 'sober', 'sock', 'soda', 'sofa', 'soft', 'soggy',
  'solar', 'solid', 'solo', 'sonar', 'song', 'sonic', 'soot', 'sorry', 'soul', 'sound',
  'soup', 'sour', 'south', 'space', 'spade', 'span', 'spare', 'spark', 'spawn', 'speak',
  'spear', 'speck', 'speed', 'spell', 'spend', 'spent', 'spice', 'spicy', 'spider', 'spike',
  'spill', 'spin', 'spine', 'spiral', 'spit', 'spite', 'splash', 'spoke', 'spool', 'spoon',
  'sport', 'spout', 'spray', 'spree', 'spring', 'sprint', 'sprout', 'spruce', 'spud', 'spur',
  'spy', 'squad', 'squat', 'squid', 'stable', 'stack', 'staff', 'stage', 'stain', 'stair',
  'stake', 'stale', 'stalk', 'stall', 'stamp', 'stand', 'star', 'stark', 'start', 'state',
  'stay', 'steak', 'steal', 'steam', 'steel', 'steep', 'steer', 'stem', 'step', 'stern',
  'stew', 'stick', 'stiff', 'still', 'sting', 'stink', 'stir', 'stock', 'stole', 'stomp',
  'stone', 'stony', 'stood', 'stool', 'stoop', 'stop', 'store', 'stork', 'storm', 'story',
  'stout', 'stove', 'straw', 'stray', 'strip', 'stroll', 'strum', 'strut', 'stub', 'stud',
  'study', 'stuff', 'stump', 'stung', 'stunt', 'sturdy', 'sugar', 'suite', 'sulfur', 'sumac',
  'summit', 'sun', 'sunny', 'super', 'surf', 'surge', 'swab', 'swamp', 'swan', 'swap',
  'swarm', 'sway', 'swear', 'sweat', 'sweep', 'sweet', 'swell', 'swept', 'swift', 'swim',
  'swine', 'swing', 'swirl', 'swish', 'swivel', 'sword', 'syrup', 'table', 'tacit', 'tack',
  'taco', 'tag', 'tail', 'taken', 'tale', 'talk', 'tall', 'tamale', 'tame', 'tango',
  'tank', 'taper', 'taps', 'tardy', 'tarot', 'task', 'taste', 'tasty', 'taut', 'taxi',
  'teach', 'teal', 'team', 'tear', 'tease', 'tempo', 'tenant', 'tend', 'tenor', 'tense',
  'tenth', 'tepid', 'term', 'thank', 'thaw', 'theft', 'theme', 'thick', 'thief', 'thigh',
  'thing', 'think', 'third', 'thong', 'thorn', 'those', 'three', 'threw', 'throb', 'throw',
  'thumb', 'thump', 'tidal', 'tide', 'tidy', 'tiger', 'tight', 'tile', 'tilt', 'timber',
  'time', 'timid', 'tipsy', 'toast', 'today', 'toed', 'token', 'tomb', 'tonic', 'tool',
  'tooth', 'topaz', 'topic', 'torch', 'torso', 'total', 'totem', 'touch', 'tough', 'towel',
  'tower', 'town', 'toxic', 'trace', 'track', 'trade', 'trail', 'train', 'trait', 'tram',
  'trap', 'trash', 'tray', 'tread', 'treat', 'trek', 'trend', 'trial', 'tribe', 'trick',
  'tried', 'trim', 'trio', 'trip', 'troll', 'troop', 'trophy', 'trot', 'trout', 'truce',
  'truck', 'truly', 'trump', 'trunk', 'trust', 'truth', 'try', 'tubby', 'tuck', 'tulip',
  'tummy', 'tuna', 'tundra', 'tune', 'tunic', 'turbo', 'turf', 'turkey', 'turn', 'tusk',
  'tutor', 'tweak', 'tweet', 'twice', 'twig', 'twin', 'twine', 'twirl', 'twist', 'two',
  'tycoon', 'type', 'udder', 'ulcer', 'ultra', 'umbra', 'uncle', 'under', 'unify', 'union',
  'unit', 'unite', 'unlit', 'until', 'unzip', 'upbeat', 'upend', 'upon', 'upper', 'urban',
  'usage', 'used', 'user', 'usher', 'usual', 'utter', 'vague', 'valet', 'valid', 'valor',
  'value', 'valve', 'vapor', 'vase', 'vault', 'veil', 'velvet', 'vendor', 'venom', 'verb',
  'verge', 'verse', 'vest', 'veto', 'vicar', 'video', 'view', 'vigor', 'villa', 'vine',
  'vinyl', 'viola', 'viper', 'viral', 'virus', 'visa', 'visit', 'visor', 'vista', 'vital',
  'vivid', 'vocal', 'vodka', 'vogue', 'voice', 'void', 'volt', 'voter', 'vouch', 'vowel',
  'wad', 'wafer', 'wager', 'wagon', 'waist', 'wait', 'waiter', 'wake', 'walk', 'wall',
  'walnut', 'walrus', 'wand', 'want', 'ward', 'wares', 'warm', 'warn', 'warp', 'wary',
  'wash', 'wasp', 'watch', 'water', 'watt', 'wave', 'wavy', 'wax', 'weak', 'wealth',
  'weave', 'wedge', 'weed', 'week', 'weep', 'weigh', 'weird', 'wells', 'were', 'whale',
  'wharf', 'wheat', 'wheel', 'whelp', 'where', 'which', 'whiff', 'while', 'whim', 'whine',
  'whirl', 'whisk', 'white', 'whole', 'whoop', 'wick', 'wide', 'widen', 'widow', 'width',
  'wield', 'wife', 'wig', 'wild', 'will', 'wilt', 'wince', 'winch', 'wind', 'window',
  'windy', 'wine', 'wing', 'wink', 'winner', 'wipe', 'wire', 'wiry', 'wise', 'wish',
  'witch', 'with', 'witty', 'wizard', 'woke', 'wolf', 'wood', 'woody', 'wool', 'woozy',
  'word', 'work', 'world', 'worm', 'worn', 'worry', 'worse', 'worst', 'worth', 'wound',
  'woven', 'wrap', 'wreath', 'wreck', 'wren', 'wring', 'wrist', 'write', 'wrong', 'wrote',
  'xenon', 'yacht', 'yam', 'yard', 'yarn', 'yawn', 'year', 'yearn', 'yeast', 'yell',
  'yelp', 'yield', 'yodel', 'yoga', 'yogurt', 'yolk', 'young', 'youth', 'yummy', 'zebra',
  'zero', 'zest', 'zesty', 'zigzag', 'zinc', 'zone', 'zoom',
];

/** Draws an unbiased index in [0, max) via rejection sampling. */
function unbiasedIndex(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    webcrypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

function capitalize(word: string): string {
  if (word.length === 0) return word;
  return (word[0] ?? '').toUpperCase() + word.slice(1);
}

export default function PassphraseTool() {
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState<Separator>('hyphen');
  const [capitalizeWords, setCapitalizeWords] = useState(true);
  const [appendNumber, setAppendNumber] = useState(true);

  const gen = (): string => {
    const sep = SEP_CHAR[separator];
    const count = Math.max(1, Math.min(20, wordCount));
    const chosen: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const word = WORDS[unbiasedIndex(WORDS.length)] ?? 'word';
      chosen.push(capitalizeWords ? capitalize(word) : word);
    }
    let phrase = chosen.join(sep);
    if (appendNumber) {
      const digit = unbiasedIndex(100); // 0-99
      phrase += `${sep}${digit.toString().padStart(2, '0')}`;
    }
    return phrase;
  };

  return (
    <GeneratorList
      generate={gen}
      deps={[wordCount, separator, capitalizeWords, appendNumber]}
      downloadName="passphrases.txt"
      label="Passphrases"
      options={
        <OptionsBar>
          <Field label={`Words: ${wordCount}`}>
            <div className="w-48">
              <Slider
                value={[wordCount]}
                min={2}
                max={10}
                step={1}
                onValueChange={(v) => setWordCount(v[0] ?? 4)}
              />
            </div>
          </Field>
          <Field label="Separator">
            <Tabs value={separator} onValueChange={(v) => setSeparator(v as Separator)}>
              <TabsList>
                <TabsTrigger value="hyphen">-</TabsTrigger>
                <TabsTrigger value="space">space</TabsTrigger>
                <TabsTrigger value="dot">.</TabsTrigger>
                <TabsTrigger value="none">none</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Capitalize">
            <Switch checked={capitalizeWords} onCheckedChange={setCapitalizeWords} />
          </Field>
          <Field label="Append number">
            <Switch checked={appendNumber} onCheckedChange={setAppendNumber} />
          </Field>
        </OptionsBar>
      }
    />
  );
}
