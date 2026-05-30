'use client';

import { useMemo, useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

// A self-contained, Diceware-style word pool. The canonical EFF large list has
// exactly 7776 entries (one per 5-dice combination). We bundle a base of common,
// memorable English words and deterministically expand to exactly 7776 unique
// entries so every 5-roll index maps to a word — fully offline, no network.
const BASE: string[] = [
  'able','about','above','absent','accept','across','action','active','actor','adapt',
  'add','adept','admit','adopt','adult','advice','affair','afford','afraid','after',
  'again','agent','agile','agree','ahead','aid','aim','air','aisle','alarm',
  'album','alert','alibi','alien','alike','alive','allow','almond','almost','aloft',
  'alone','along','aloud','alpha','also','alter','amaze','amber','amend','among',
  'amount','ample','amuse','anchor','angel','anger','angle','animal','ankle','annex',
  'annoy','answer','antenna','antic','anvil','anyone','apart','apex','apple','apply',
  'april','apron','arcade','arch','arena','argue','arise','armor','army','aroma',
  'around','arrange','arrest','arrive','arrow','art','artist','ascend','aside','asked',
  'aspect','assist','asset','assume','asthma','astute','atlas','atom','attach','attack',
  'attend','attic','auburn','audit','august','aunt','author','auto','autumn','avenue',
  'avoid','await','awake','award','aware','awful','axis','azure','bacon','badge',
  'bagel','baker','balance','balcony','ballad','ballot','bamboo','banana','bandit','banjo',
  'banker','banner','barbecue','barber','barge','barley','barn','barrel','basic','basil',
  'basin','basket','batch','baton','batter','beacon','beagle','beam','bean','beast',
  'beaver','become','bedrock','beech','beetle','before','beggar','begin','behalf','behave',
  'behind','being','believe','belong','bench','bend','benefit','berry','beside','best',
  'bet','better','beware','beyond','bicycle','bigger','bike','binary','biology','birch',
  'birth','biscuit','bishop','bison','bitter','blade','blame','blank','blanket','blast',
  'blaze','bleach','blend','bless','blind','blink','bliss','blizzard','block','blond',
  'blood','bloom','blossom','blouse','blow','blue','bluff','blunt','blur','blush',
  'board','boast','bobcat','body','boil','bold','bolt','bonsai','bonus','book',
  'boost','boot','border','borrow','bottle','bottom','bought','boulder','bounce','bound',
  'bouquet','bow','bowl','boxer','brace','braid','brain','brake','branch','brand',
  'brass','brave','bravo','bread','break','breath','breeze','brew','brick','bridge',
  'brief','bright','bring','brink','brisk','broad','broil','broken','bronze','brooch',
  'brook','broom','brother','brought','brown','browse','bruise','brunch','brush','bubble',
  'bucket','buckle','budget','buffalo','buffet','bugle','build','bulb','bulk','bull',
  'bumper','bunch','bundle','bunny','burden','bureau','burger','burlap','burn','burrow',
  'burst','bush','busy','butter','button','buyer','buzzer','cabin','cable','cackle',
  'cactus','cadet','cage','cake','calcium','calendar','calf','call','calm','camel',
  'camera','camp','campus','canal','canary','cancel','candle','candy','cane','cannon',
  'canoe','canopy','canvas','canyon','capital','captain','capture','carbon','cardinal','care',
  'cargo','carol','carpet','carrot','carry','cart','carve','cascade','case','cashew',
  'casino','cast','castle','casual','catch','cater','cattle','caught','cause','cavalry',
  'cave','cease','cedar','ceiling','celery','cement','census','center','ceramic','cereal',
  'chain','chair','chalk','chamber','champ','chance','change','channel','chaos','chapel',
  'charge','charm','chart','chase','cheap','check','cheddar','cheek','cheer','cheese',
  'cherry','chess','chest','chew','chic','chick','chief','child','chili','chill',
  'chime','chimney','chin','chip','chisel','chocolate','choice','choir','choose','chop',
  'chord','chorus','chosen','chrome','chunk','church','cider','cigar','cinema','circle',
  'circus','citrus','city','civic','civil','claim','clamp','clan','clap','clarify',
  'clash','clasp','class','classic','clause','claw','clay','clean','clear','clerk',
  'clever','click','client','cliff','climate','climb','clinic','clip','cloak','clock',
  'clone','close','closet','cloth','cloud','clover','clown','club','clue','clump',
  'clumsy','cluster','clutch','coach','coal','coast','coat','cobra','cocoa','cod',
  'code','coffee','coil','coin','cola','cold','collar','collect','college','colony',
  'color','column','comb','combat','combine','come','comedy','comet','comfort','comic',
  'command','comment','commit','common','compact','company','compass','compel','complex','comply',
  'compose','compute','concept','concert','concrete','conduct','cone','confess','confide','confine',
  'confirm','conflict','congress','connect','consent','console','consult','consume','contact','contain',
  'content','contest','context','control','convey','convince','cook','cool','copper','copy',
  'coral','cord','corgi','corn','corner','corral','cost','cottage','cotton','couch',
  'cough','council','count','county','couple','coupon','courage','course','court','cousin',
  'cover','coward','cowboy','coyote','cozy','crab','crack','cradle','craft','crane',
  'crash','crate','crater','crawl','crayon','crazy','cream','create','credit','creek',
  'creep','crepe','crest','crew','cricket','crime','crimson','crisp','critic','croak',
  'crochet','crop','cross','crouch','crow','crowd','crown','crucial','crude','cruise',
  'crumb','crunch','crush','crust','crutch','crypt','crystal','cube','cubic','cuckoo',
  'cucumber','cuddle','cuff','culture','cunning','cup','cupcake','curb','cure','curfew',
  'curious','curl','currency','current','curry','curse','cursor','curtain','curve','cushion',
  'custom','cycle','cyclone','cymbal','cypress','dabble','daffodil','dagger','dahlia','daily',
  'dairy','daisy','damage','damp','dance','dandelion','danger','dapper','daring','dark',
  'dart','dash','data','date','dawn','daydream','dazzle','deacon','dealer','dean',
  'debate','debit','debris','debt','debug','decade','decay','deceive','decent','decide',
  'deck','declare','decline','decode','decor','decrease','decree','deduct','deed','deep',
  'deer','defeat','defend','define','deflate','defrost','defy','degree','delay','delegate',
  'delete','deli','delight','deliver','delta','deluge','deluxe','demand','demo','denial',
  'denim','dense','dental','dentist','deny','depart','depend','depict','deploy','deport',
  'deposit','depth','deputy','derail','derby','descend','desert','design','desire','desk',
  'despite','dessert','destiny','destroy','detail','detect','detour','develop','device','devote',
  'dial','diamond','diary','dice','diesel','diet','differ','digest','digital','dignity',
  'dilemma','dill','dilute','dim','dimple','diner','dinner','dinosaur','diploma','direct',
  'dirt','disable','disagree','disarm','disco','discord','discount','discover','discuss','disease',
  'disguise','dish','dismay','dismiss','disorder','dispatch','display','dispose','dispute','distance',
  'distant','distort','disturb','ditch','divan','dive','divert','divide','divine','dizzy',
  'dock','doctor','dodge','doily','dolphin','domain','dome','dominant','donate','donkey',
  'donor','doodle','doorway','dose','double','dough','dove','downhill','download','downtown',
  'dozen','draft','drag','dragon','drama','drape','drastic','draw','dread','dream',
  'dredge','drench','dress','dribble','drift','drill','drink','drip','drive','drizzle',
  'drone','droop','drop','drought','drove','drown','drowsy','drum','dry','dual',
  'duck','duct','dude','duel','duet','dugout','duke','dull','duly','dune',
  'dungeon','dunk','duo','duplex','during','dusk','dust','duty','dwarf','dwell',
  'dynamic','dynasty','eager','eagle','early','earn','earth','easel','east','easy',
  'eat','echo','eclipse','ecology','economy','eddy','edge','edible','edit','editor',
  'educate','eel','effect','effort','egg','eggplant','eight','either','elaborate','elastic',
  'elbow','elder','elect','element','elephant','elevate','elf','elite','elope','else',
  'elude','elusive','email','embark','emblem','embody','embrace','emerald','emerge','emit',
  'emotion','empire','employ','empty','enable','enact','encode','endless','endorse','endure',
  'enemy','energy','engage','engine','engrave','enhance','enjoy','enlist','enough','enrich',
  'enroll','ensure','enter','entire','entry','envelope','envoy','envy','enzyme','epic',
  'episode','equal','equate','equip','era','erase','erode','errand','error','erupt',
  'escape','escort','espresso','essay','essence','estate','esteem','eternal','ethic','ethnic',
  'evade','evening','event','everyone','evict','evidence','evoke','evolve','exact','exam',
  'example','exceed','excel','except','excess','exchange','excite','exclude','excuse','execute',
  'exempt','exert','exhale','exhaust','exhibit','exile','exist','exit','exotic','expand',
  'expect','expel','expert','expire','explain','explore','export','expose','express','extend',
  'extra','extreme','eyebrow','eyelid','fable','fabric','facade','face','facet','factor',
  'factory','faculty','fade','fairy','faith','falcon','fall','false','fame','family',
  'famous','fan','fancy','fang','fantasy','fare','farm','fashion','fatal','father',
  'fatigue','faucet','fault','favor','fawn','feast','feather','feature','fedora','fee',
  'feeble','feed','feel','feline','fellow','female','fence','fender','fennel','fern',
  'ferry','fertile','fervor','festival','fetch','feud','fever','fiber','fiction','fiddle',
  'field','fiend','fierce','fiesta','fifteen','fifth','fifty','fig','fight','figure',
  'filament','file','fillet','filly','film','filter','final','finance','finch','find',
  'finder','fine','finger','finish','fir','fire','firm','first','fiscal','fish',
  'fist','fit','five','fixate','fixed','fizz','flag','flair','flame','flank',
  'flannel','flap','flare','flash','flask','flat','flatter','flavor','flaw','fled',
  'flee','fleece','fleet','flesh','flex','flick','flier','flight','flimsy','fling',
  'flint','flip','flirt','float','flock','flood','floor','flora','floss','flour',
  'flow','flower','fluent','fluff','fluid','fluke','flung','flush','flute','flux',
  'fly','foam','focus','fog','foil','fold','folk','follow','fond','font',
  'food','fool','foot','footprint','forage','forbid','force','ford','forearm','forecast',
  'forehead','foreign','forest','forever','forge','forget','forgive','fork','form','formal',
  'format','former','formula','fort','fortune','forty','forum','forward','fossil','foster',
  'foul','found','founder','fountain','fourth','fowl','fox','foyer','fraction','fracture',
  'fragile','fragment','fragrant','frame','franc','frantic','fraud','fray','freckle','free',
  'freedom','freeze','freight','french','frenzy','fresh','friction','friday','fridge','friend',
  'fright','fringe','frisbee','frock','frog','frolic','front','frost','froth','frown',
  'frozen','frugal','fruit','fudge','fuel','fugitive','fulcrum','full','fumble','fume',
  'fun','function','fund','fungus','funnel','funny','furnace','furnish','furrow','further',
  'fury','fuse','fusion','futile','future','fuzz','gable','gadget','gala','galaxy',
  'gallery','gallop','galore','gamble','game','gamma','gander','garage','garden','gargle',
  'garlic','garment','garnet','garnish','gas','gate','gather','gauge','gauze','gaze',
  'gazelle','gear','geese','gem','gender','gene','general','genesis','genie','genius',
  'genre','gentle','genuine','geology','germ','gesture','geyser','ghost','giant','gift',
  'gigantic','giggle','ginger','giraffe','girder','girl','give','glacier','glad','glamour',
  'glance','gland','glare','glass','glaze','gleam','glee','glide','glimmer','glimpse',
  'glisten','glitch','glitter','globe','gloom','glory','gloss','glove','glow','glucose',
  'glue','goal','goat','goblet','goblin','goggle','gold','golden','golf','gondola',
  'gong','good','goose','gopher','gorge','gorilla','gospel','gossip','gourd','govern',
  'gown','grab','grace','grade','gradual','graft','grain','grand','granite','grant',
  'grape','graph','grasp','grass','grate','gratitude','grave','gravel','gravity','gravy',
  'gray','graze','grease','great','greedy','green','greet','grenade','grid','grief',
  'grill','grim','grin','grind','grip','grit','grizzly','groan','grocery','groom',
  'groove','grotto','ground','group','grouse','grove','grow','growl','grown','grub',
  'grudge','gruff','grumble','grunt','guarantee','guard','guava','guess','guest','guidance',
  'guide','guild','guilt','guitar','gulf','gull','gully','gulp','gum','gumbo',
  'gummy','gun','gunner','gurgle','guru','gush','gust','gutter','guzzle','gym',
  'gymnast','gypsy','habit','hacksaw','haddock','hail','hair','half','halibut','hall',
  'halo','halt','hamlet','hammer','hammock','hamper','hamster','hand','handle','handy',
  'hangar','hanger','happen','happy','harbor','hard','hardy','hare','harm','harmony',
  'harp','harsh','harvest','hash','hassle','haste','hasty','hatch','hate','haul',
  'haunt','haven','havoc','hawk','hay','hazard','haze','hazel','head','headline',
  'heal','health','heap','hear','heart','hearty','heat','heater','heave','heaven',
  'heavy','hectic','hedge','heel','height','heir','helix','helm','helmet','help',
  'helper','hemlock','hen','herald','herbal','herd','here','hermit','hero','heron',
  'hesitate','hexagon','heyday','hickory','hidden','hide','high','highway','hijack','hike',
  'hill','hilt','hint','hippo','hire','history','hitch','hive','hoard','hobby',
  'hockey','hoist','hold','hole','holiday','hollow','holster','holy','homemade','homework',
  'honest','honey','honor','hood','hoof','hook','hoop','hope','horizon','hormone',
  'horn','hornet','horse','hose','hospital','host','hostel','hostile','hotdog','hotel',
  'hound','hour','house','hover','howl','hub','huddle','huge','hula','hum',
  'human','humble','humid','humor','hump','hunch','hundred','hunger','hunt','hunter',
  'hurdle','hurl','hurricane','hurry','hurt','husband','hush','husky','hustle','hut',
  'hutch','hybrid','hydrant','hydrogen','hyena','hymn','hype','iceberg','icicle','icing',
  'icon','idea','ideal','idiom','idle','idol','igloo','ignite','ignore','iguana',
  'image','imagine','imitate','immense','immune','impact','impair','impeach','impel','imply',
  'import','impose','impress','imprint','improve','impulse','inbox','incense','inch','incident',
  'income','indeed','index','indicate','indigo','indoor','induce','indulge','infant','infect',
  'inflate','inform','infuse','inhale','inherit','inject','injury','ink','inland','inmate',
  'inner','innocent','input','inquire','insane','insect','insert','inside','insight','insist',
  'inspect','inspire','install','instant','instead','insult','insure','intact','intake','intend',
  'intense','intent','invent','invest','invite','invoke','inward','iodine','ion','iris',
  'iron','irony','island','isolate','issue','italic','itch','item','ivory','ivy',
  'jackal','jacket','jackpot','jade','jaguar','jail','jalapeno','jam','janitor','january',
  'jargon','jasmine','javelin','jaw','jazz','jealous','jeans','jelly','jersey','jest',
  'jet','jewel','jigsaw','jingle','jinx','jockey','jog','join','joint','joke',
  'jolly','jolt','journal','journey','jovial','joy','joyful','judge','judo','juggle',
  'juice','juicy','jukebox','july','jumbo','jump','jumper','junction','june','jungle',
  'junior','junk','jury','justice','jute','kale','kangaroo','karate','kayak','keen',
  'keep','keeper','kennel','kept','kernel','ketchup','kettle','key','keyboard','khaki',
  'kick','kid','kidney','kill','kilo','kilt','kind','king','kingdom','kiosk',
  'kiss','kit','kitchen','kite','kitten','kiwi','knack','knapsack','knead','knee',
  'kneel','knew','knife','knight','knit','knob','knock','knot','know','koala',
  'lab','label','labor','lace','lack','lacquer','ladder','ladle','lady','ladybug',
  'lagoon','lair','lake','lamb','lamp','lance','land','landmark','lane','language',
  'lantern','lapel','lapse','laptop','larch','large','lark','larva','laser','lasso',
  'last','latch','late','lateral','latex','lather','latitude','latte','lattice','laugh',
  'launch','laundry','laurel','lava','lavender','lawful','lawn','lawyer','layer','layout',
  'lazy','leader','leaf','league','leak','lean','leap','learn','lease','leash',
  'least','leather','leave','lecture','ledge','ledger','leech','leek','left','leftover',
  'legacy','legal','legend','legion','legume','lemon','lemur','lend','length','lens',
  'lentil','leopard','lesson','letter','lettuce','level','lever','liable','liar','liberty',
  'library','license','lichen','lid','life','lift','light','like','lilac','lily',
  'limb','lime','limit','limp','line','linen','linger','lining','link','lint',
  'lion','lip','liquid','lisp','list','listen','liter','little','lively','liver',
  'lizard','llama','load','loaf','loan','lobby','lobster','local','locate','lock',
  'locker','locket','locust','lodge','loft','log','logic','login','logo','loiter',
  'lollipop','lone','lonely','long','longhorn','loom','loop','loose','loot','lord',
  'lose','lotion','lottery','lotus','loud','lounge','lousy','love','lovely','lower',
  'loyal','luck','lucky','luggage','lukewarm','lull','lumber','lump','lunar','lunch',
  'lung','lunge','lurch','lure','lurk','lush','lute','luxury','lychee','lynx',
  'lyric','macaroni','macaw','machine','macro','madam','madness','magic','magma','magnet',
  'magnify','magpie','maid','mail','mailbox','main','maize','major','make','maker',
  'mako','mallard','mallet','malt','mammal','mammoth','manage','manatee','mandate','mandolin',
  'mane','mango','mangrove','manhole','manor','mansion','mantle','manual','manure','maple',
  'marble','march','mare','margin','marigold','marina','marine','mark','market','marlin',
  'maroon','marrow','marry','marsh','martial','marvel','mascot','mash','mask','mason',
  'mast','master','match','mate','material','math','matrix','matter','mattress','mature',
  'maximum','maybe','mayhem','mayor','maze','meadow','meal','mean','meander','meaning',
  'measure','meat','medal','meddle','media','medic','medium','meek','meet','mellow',
  'melody','melon','melt','member','memo','memory','menace','mend','mental','mention',
  'mentor','menu','merchant','mercury','mercy','merge','merit','mermaid','merry','mesa',
  'mesh','message','metal','meteor','meter','method','metric','metro','mice','micro',
  'midday','middle','midnight','midway','might','mighty','migrate','mild','mile','milk',
  'mill','mimic','mince','mind','mine','mineral','mingle','miniature','minimum','mink',
  'minnow','minor','mint','minus','minute','miracle','mirage','mirror','mirth','misfit',
  'mishap','mislead','mission','mist','mistake','misty','mitten','mix','mixer','moat',
  'mobile','moccasin','mock','model','modem','modern','modest','modify','module','moist',
  'molar','mold','mole','molecule','molten','moment','monarch','monday','money','monitor',
  'monk','monkey','monsoon','monster','month','monument','mood','moody','moon','moose',
  'moral','morale','morning','morsel','mortar','mosaic','mosquito','moss','most','motel',
  'moth','mother','motion','motive','motor','motto','mound','mount','mountain','mourn',
  'mouse','mousse','mouth','move','movie','mover','much','muck','mud','muddy',
  'muffin','muffle','mug','mulberry','mulch','mule','mull','multiply','mumble','mummy',
  'munch','mural','murmur','muscle','museum','mushroom','music','musket','muskox','mussel',
  'mustang','mustard','muster','mutate','mute','mutter','mutual','muzzle','myrrh','myself',
  'mystery','mystic','myth','nacho','nail','name','nanny','napkin','narrate','narrow',
  'nasal','nation','native','natural','nature','naughty','nautical','naval','navel','navy',
  'near','neat','nebula','neck','necklace','nectar','need','needle','negate','neglect',
  'neon','nephew','neptune','nerve','nervous','nest','nestle','nettle','network','neutral',
  'never','newborn','newcomer','newer','newly','newt','next','nibble','nice','niche',
  'nickel','niece','night','nimble','nine','ninja','nitrogen','noble','nobody','nod',
  'noise','noisy','nomad','none','noodle','noon','normal','north','nose','nosy',
  'notable','notch','note','nothing','notice','notify','notion','nougat','noun','novel',
  'novice','nozzle','nuance','nuclear','nudge','nugget','nuisance','number','numeral','numb',
  'nun','nurse','nursery','nurture','nut','nutmeg','nutrient','nuzzle','nylon','oak',
  'oasis','oat','oatmeal','obey','object','oblige','oblong','oboe','obscure','observe',
  'obsess','obstacle','obtain','obvious','occupy','occur','ocean','octagon','octave','october',
  'octopus','odd','odor','offend','offer','office','offset','offshore','offspring','often',
  'oil','okay','okra','older','olive','omega','omelet','omen','omit','once',
  'onion','online','onset','onward','onyx','opal','open','opera','operate','opinion',
  'opossum','oppose','optic','option','oracle','orange','orbit','orchard','orchid','ordeal',
  'order','organ','orient','origin','ornament','orphan','osprey','ostrich','other','otter',
  'ought','ounce','outback','outburst','outcast','outcome','outcry','outdoor','outer','outfit',
  'outgoing','outing','outlaw','outlet','outline','outlook','output','outrage','outside','outward',
  'oval','oven','overall','overcoat','overcome','overdue','overflow','overhang','overhead','overhear',
  'overlap','overlook','overnight','overpass','overrun','oversee','overt','overtake','overture','owl',
  'own','owner','oxen','oxide','oxygen','oyster','ozone','pace','pacific','pack',
  'packet','pact','paddle','padlock','pagan','page','pager','pail','pain','paint',
  'pair','palace','palate','pale','palette','palm','pamper','pancake','panda','pane',
  'panel','panic','panther','pantry','pants','papaya','paper','papyrus','parade','paradox',
  'paragraph','parakeet','parallel','parcel','parch','pardon','parent','parish','park','parka',
  'parlor','parole','parrot','parsley','parsnip','part','partial','partner','party','passage',
  'passion','passive','pasta','paste','pastel','pastry','pasture','patch','path','patient',
  'patio','patriot','patrol','pattern','pause','pave','pavement','paw','pawn','payday',
  'payment','payout','peace','peach','peacock','peak','peanut','pear','pearl','pebble',
  'pecan','peck','pedal','peddle','pelican','pellet','pelt','pen','penalty','pencil',
  'pendant','penguin','peninsula','penny','pension','people','pepper','perceive','perch','perfect',
  'perform','perfume','peril','period','perish','perk','permit','perplex','persist','person',
  'persuade','pest','pesto','petal','petite','petrol','petty','pewter','phantom','phase',
  'pheasant','phoenix','phone','photo','phrase','physical','piano','picket','pickle','picnic',
  'picture','piece','pier','pierce','pigeon','piglet','pigment','pike','pile','pilgrim',
  'pillar','pillow','pilot','pimento','pinball','pinch','pine','pineapple','pinion','pink',
  'pinky','pinpoint','pint','pioneer','pipe','pipeline','pirate','pistol','piston','pitch',
  'pitcher','pity','pivot','pixel','pizza','placard','place','placid','plague','plaid',
  'plain','plan','plane','planet','plank','plant','plasma','plaster','plastic','plate',
  'plateau','platform','platinum','platter','play','player','playful','plaza','plea','plead',
  'pleasant','please','pleat','pledge','plenty','pliers','plot','plow','pluck','plug',
  'plum','plumber','plume','plump','plunder','plunge','plural','plus','plush','plywood',
  'poach','pocket','poem','poet','poetry','pogo','point','poise','poison','poke',
  'polar','pole','police','policy','polish','polite','polka','pollen','polo','pomp',
  'poncho','pond','ponder','pony','poodle','pool','popcorn','poppy','popular','porcelain',
  'porch','porcupine','pore','pork','port','portal','portion','portrait','pose','position',
  'positive','possess','possible','post','postage','poster','postpone','pot','potato','potent',
  'pottery','pouch','poultry','pounce','pound','pour','pout','powder','power','practice',
  'prairie','praise','prance','prank','prawn','pray','preach','precise','predict','prefer',
  'prefix','pregnant','premise','premium','prepare','present','preserve','preset','press','pressure',
  'pretend','pretty','pretzel','prevail','prevent','preview','prey','price','prickle','pride',
  'priest','primal','primary','prime','primer','prince','print','prior','prism','prison',
  'pristine','private','prize','probe','problem','proceed','process','proclaim','prod','produce',
  'product','profess','profile','profit','program','progress','project','prolong','promise','promote',
  'prompt','prone','prong','proof','propel','proper','prophet','propose','prose','prosper',
  'protect','protein','protest','proton','proud','prove','provide','prowl','proxy','prune',
  'public','pucker','pudding','puddle','puffin','pull','pulley','pulp','pulse','puma',
  'pump','pumpkin','punch','puncture','pundit','pungent','punish','punk','pup','pupil',
  'puppet','puppy','purchase','pure','puree','purge','purity','purple','purpose','purr',
  'purse','pursue','push','putt','putty','puzzle','pyramid','python','quack','quadrant',
  'quail','quaint','quake','quality','quantum','quarry','quart','quarter','quartz','quaver',
  'queasy','queen','quench','query','quest','question','queue','quick','quiet','quill',
  'quilt','quirk','quit','quiver','quiz','quota','quote','rabbit','raccoon','race',
  'racer','rack','racket','radar','radial','radio','radish','radius','raffle','raft',
  'rafter','rage','ragged','raid','rail','railway','rain','rainbow','raincoat','raise',
  'raisin','rake','rally','ramble','ramp','ranch','random','range','ranger','rank',
  'ransom','rapid','rare','rascal','rash','raspberry','rate','rather','rating','ratio',
  'ration','rattle','raven','ravine','raw','ray','razor','reach','react','reactor',
  'read','reader','ready','realm','reap','rear','reason','rebel','reborn','rebound',
  'rebuild','recall','recap','receipt','receive','recent','recipe','recite','reckon','reclaim',
  'recline','record','recover','recruit','rectangle','recycle','red','redeem','reduce','reed',
  'reef','reel','referee','refill','refine','reflect','reform','refrain','refresh','refuel',
  'refuge','refund','refuse','regal','regard','regime','region','register','regret','regular',
  'rehab','reign','reindeer','reject','rejoice','relapse','relate','relax','relay','release',
  'relevant','reliable','relic','relief','relieve','relish','reload','reluctant','rely','remain',
  'remark','remedy','remind','remit','remix','remote','remove','rename','render','renew',
  'rent','rental','repair','repay','repeat','repel','replace','replay','reply','report',
  'reptile','republic','request','require','rescue','research','resemble','reserve','reset','reside',
  'residue','resin','resist','resolve','resort','resource','respect','respond','rest','restore',
  'result','resume','retail','retain','retire','retort','retreat','retrieve','return','reunion',
  'reuse','reveal','revenue','revere','reverse','review','revise','revive','revolt','revolve',
  'reward','rhino','rhubarb','rhyme','rhythm','rib','ribbon','rice','rich','rider',
  'ridge','rifle','rift','rigid','rigor','rim','ring','rinse','riot','ripe',
  'ripen','ripple','rise','risk','risky','ritual','rival','river','road','roam',
  'roar','roast','robe','robin','robot','robust','rock','rocket','rod','rodent',
  'rodeo','rogue','role','roll','romance','romp','roof','rook','rookie','room',
  'rooster','root','rope','rose','roster','rotary','rotate','rotor','rotten','rough',
  'round','route','router','routine','rover','row','royal','rubber','rubble','ruby',
  'rudder','rude','ruffle','rug','rugby','rugged','ruin','rule','ruler','rumble',
  'rummage','rumor','rump','run','runner','runway','rural','rush','russet','rust',
  'rustic','rustle','sable','sack','sacred','saddle','safari','safe','saffron','sage',
  'sail','sailor','saint','salad','salami','salary','salmon','saloon','salsa','salt',
  'salute','salvage','same','sample','sand','sandal','sandbar','sandbox','sane','sapling',
  'sapphire','sardine','sash','satchel','satin','satire','satisfy','sauce','saucer','sauna',
  'sausage','savage','save','savor','sawdust','saxophone','scale','scallop','scalp','scamper',
  'scan','scant','scar','scarce','scare','scarf','scatter','scene','scenic','scent',
  'scheme','scholar','school','science','scissors','scoff','scold','scone','scoop','scooter',
  'scope','scorch','score','scorn','scout','scowl','scramble','scrap','scrape','scratch',
  'scrawl','scream','screech','screen','screw','scribble','scribe','script','scroll','scrub',
  'scuba','scuff','sculpt','scurry','sea','seafood','seagull','seal','seam','search',
  'season','seat','seaweed','second','secret','section','sector','secure','sedan','seed',
  'seedling','seek','seem','seesaw','segment','seize','seldom','select','self','sell',
  'seller','semester','senate','send','senior','sense','sensor','sentry','sequel','sequin',
  'serene','sergeant','serial','series','sermon','serpent','serum','servant','serve','server',
  'session','settle','setup','seven','sever','severe','sewage','shabby','shack','shade',
  'shadow','shady','shaft','shaggy','shake','shaky','shallow','shame','shampoo','shape',
  'shard','share','shark','sharp','shatter','shave','shawl','shear','sheath','shed',
  'sheen','sheep','sheer','sheet','shelf','shell','shelter','shepherd','sherbet','sheriff',
  'shield','shift','shimmer','shin','shine','shingle','shiny','ship','shipment','shirt',
  'shiver','shoal','shock','shoe','shoot','shop','shore','short','shortcut','shotgun',
  'shoulder','shout','shove','shovel','show','shower','shred','shrewd','shriek','shrill',
  'shrimp','shrine','shrink','shroud','shrub','shrug','shuffle','shun','shutter','shuttle',
  'shy','sibling','sick','side','sidewalk','siege','sieve','sift','sigh','sight',
  'signal','signature','silence','silent','silk','silly','silo','silver','similar','simmer',
  'simple','since','sincere','sinew','sing','singe','singer','single','sink','sinus',
  'sip','siren','sister','sitcom','site','sitter','situate','six','sixteen','sixty',
  'sizable','size','sizzle','skate','sketch','skewer','ski','skid','skill','skim',
  'skin','skip','skirt','skull','skunk','sky','slab','slack','slam','slang',
  'slant','slap','slash','slate','slave','sled','sleek','sleep','sleet','sleeve',
  'sleigh','slender','slice','slick','slide','slight','slim','slime','sling','slip',
  'slipper','slither','sliver','slogan','slope','slosh','sloth','slouch','slow','sludge',
  'slug','sluice','slum','slumber','slump','slung','slur','slush','smack','small',
  'smart','smash','smear','smell','smile','smirk','smith','smock','smog','smoke',
  'smolder','smooth','smother','smudge','smug','snack','snag','snail','snake','snap',
  'snare','snarl','snatch','sneak','sneaker','sneer','sneeze','sniff','snip','sniper',
  'snippet','snitch','snoop','snore','snorkel','snort','snout','snow','snowfall','snub',
  'snuff','snug','snuggle','soak','soap','soar','sob','sober','soccer','social',
  'sock','socket','soda','sofa','soft','soften','software','soggy','soil','solar',
  'solder','soldier','sole','solemn','solid','solo','solstice','solution','solve','somber',
  'sombrero','someday','somehow','someone','sonar','song','songbird','sonic','soot','soothe',
  'sorbet','sorcerer','sore','sorrow','sorry','sort','soul','sound','soup','sour',
  'source','souvenir','sovereign','sow','soybean','space','spade','spaghetti','span','spaniel',
  'spank','spare','spark','sparkle','sparrow','spasm','spatula','spawn','speak','speaker',
  'spear','special','species','speck','spectrum','speech','speed','spell','spend','spent',
  'sphere','sphinx','spice','spicy','spider','spike','spill','spin','spinach','spine',
  'spiral','spirit','spit','spite','splash','spleen','splendid','splice','splint','split',
  'splurge','spoil','spoke','sponge','sponsor','spoof','spook','spool','spoon','sport',
  'spot','spotlight','spouse','spout','sprain','sprawl','spray','spread','spree','sprig',
  'spring','sprinkle','sprint','sprout','spruce','spry','spud','spun','spur','spurt',
  'spy','squad','square','squash','squat','squawk','squeak','squeal','squeeze','squid',
  'squint','squire','squirm','squirrel','squish','stab','stable','stack','stadium','staff',
  'stag','stage','stagger','stain','stair','stake','stale','stalk','stall','stamina',
  'stamp','stance','stand','standard','stanza','staple','star','starch','stare','starfish',
  'stark','starling','start','startle','startup','starve','stash','state','static','station',
  'statue','status','stay','steady','steak','steal','steam','steed','steel','steep',
  'steer','stem','stencil','step','stereo','stern','stew','stick','sticker','stiff',
  'stifle','stigma','still','stilt','sting','stingray','stink','stint','stipend','stir',
  'stitch','stock','stocking','stoic','stoke','stomach','stomp','stone','stool','stoop',
  'stop','storage','store','stork','storm','story','stout','stove','stowaway','straggle',
  'straight','strain','strait','strand','strange','strap','straw','stray','streak','stream',
  'street','strength','stress','stretch','strict','stride','strike','string','strip','stripe',
  'strive','stroke','stroll','strong','struck','strum','strut','stub','stubble','stubborn',
  'stucco','stud','student','studio','study','stuff','stumble','stump','stun','stunt',
  'sturdy','stutter','style','stylus','suave','subdue','subject','sublet','submarine','submit',
  'subset','subside','subsoil','subtle','suburb','subway','succeed','success','such','suck',
  'suction','sudden','suds','sue','suede','suffer','suffix','sugar','suggest','suit',
  'suitcase','suite','sulfur','sulk','sultan','sultry','sum','summary','summer','summit',
  'summon','sun','sunbeam','sunburn','sundae','sunday','sundial','sundown','sunfish','sunflower',
  'sunken','sunlight','sunny','sunrise','sunroof','sunscreen','sunset','sunshine','sunspot','super',
  'superb','supper','supple','supply','support','suppose','supreme','sure','surf','surface',
  'surge','surgeon','surgery','surly','surname','surpass','surplus','surprise','surreal','surround',
  'survey','survive','sushi','suspect','suspend','sustain','swab','swagger','swallow','swamp',
  'swan','swap','swarm','swat','sway','swear','sweat','sweater','sweep','sweet',
  'swell','swelter','swerve','swift','swim','swine','swing','swipe','swirl','switch',
  'swivel','swollen','swoop','sword','swordfish','sworn','sycamore','syllable','symbol','symmetry',
  'sympathy','symphony','symptom','syndrome','synergy','syntax','syringe','syrup','system','table',
  'tablet','taboo','tacit','tack','tackle','taco','tactful','tactic','tadpole','tag',
  'tail','tailor','taint','take','takeoff','takeout','talcum','tale','talent','talk',
  'tall','tally','talon','tame','tamper','tan','tang','tangerine','tangle','tango',
  'tank','tankard','tanker','tantrum','tap','tape','tapestry','tapir','taproot','tar',
  'tarantula','tardy','target','tariff','tarp','tarragon','tart','task','tassel','taste',
  'tasty','tattle','tattoo','taught','taunt','taut','tavern','tax','taxi','taxpayer',
  'tea','teach','teacher','teakettle','teal','team','teamwork','teapot','tear','tease',
  'teaspoon','tech','tedious','teem','teen','teenager','teeter','telecom','telegram','telescope',
  'tell','teller','temper','tempest','temple','tempo','tempt','ten','tenant','tend',
  'tender','tendon','tenet','tennis','tenor','tense','tension','tent','tenth','tepid',
  'term','terminal','termite','terrace','terrain','terrible','terrier','terrify','terror','test',
  'testify','tether','textbook','textile','texture','thank','thatch','thaw','theater','theft',
  'theme','theory','therapy','thermal','these','thesis','thicket','thief','thigh','thimble',
  'thin','thing','think','thinker','third','thirst','thirteen','thirty','thistle','thorn',
  'thorough','thought','thread','threat','three','thresh','thrift','thrill','thrive','throat',
  'throb','throne','throng','throttle','through','throw','thrush','thrust','thud','thumb',
  'thunder','thursday','thwart','thyme','tiara','tick','ticket','tickle','tidal','tide',
  'tidy','tiger','tight','tile','till','tilt','timber','time','timeline','timer',
  'timid','tin','tinker','tinsel','tint','tiny','tip','tiptoe','tirade','tire',
  'tissue','title','toad','toadstool','toast','toaster','tobacco','today','toddler','toe',
  'toffee','tofu','toga','toggle','toil','toilet','token','tolerate','toll','tomato',
  'tomb','tomboy','tomorrow','ton','tone','tongs','tongue','tonic','tonight','tool',
  'toolbox','tooth','toothpick','top','topaz','topic','topple','torch','torment','tornado',
  'torpedo','torrent','torso','tortilla','tortoise','torture','toss','total','totem','toucan',
  'touch','tough','tour','tourist','tournament','tow','toward','towel','tower','town',
  'toxic','toxin','toy','trace','track','tract','tractor','trade','tradition','traffic',
  'tragic','trail','trailer','train','trainer','trait','traitor','tram','trample','trance',
  'trap','trapeze','trash','travel','traverse','tray','tread','treadmill','treason','treasure',
  'treat','treaty','treble','tree','trek','trellis','tremble','tremor','trench','trend',
  'trespass','trial','triangle','tribe','tribute','trick','trickle','tricky','tricycle','trident',
  'trifle','trigger','trill','trillion','trim','trinket','trio','trip','triple','tripod',
  'triumph','trivia','trolley','trombone','troop','trophy','tropic','trot','trouble','trough',
  'troupe','trousers','trout','trowel','truant','truce','truck','trudge','true','truffle',
  'trumpet','trunk','trust','truth','tsunami','tub','tuba','tube','tuck','tuesday',
  'tuft','tug','tugboat','tulip','tumble','tuna','tundra','tune','tunic','tunnel',
  'turban','turbine','turf','turkey','turmoil','turn','turnip','turnout','turnover','turnpike',
  'turntable','turquoise','turret','turtle','tusk','tutor','tuxedo','tweak','tweed','tweet',
  'tweezers','twelve','twenty','twice','twig','twilight','twin','twine','twinkle','twirl',
  'twist','twister','two','tycoon','type','typhoon','typical','udder','ugly','ukulele',
  'ultra','umbrella','umpire','unable','unaware','unbend','unbiased','unbolt','unbox','unbroken',
  'uncle','unclog','uncoil','uncover','uncut','undergo','underline','undo','undress','uneasy',
  'uneven','unfair','unfit','unfold','unicorn','uniform','union','unique','unison','unit',
  'unite','unity','universe','unjust','unkind','unknown','unlace','unlatch','unleash','unless',
  'unlike','unlimited','unload','unlock','unlucky','unmask','unpack','unpaid','unplug','unravel',
  'unread','unreal','unroll','unruly','unscrew','unseal','unseen','unsigned','untangle','untidy',
  'untie','until','unusual','unveil','unwind','unwrap','unzip','upbeat','upend','upgrade',
  'upheld','uphill','uphold','upkeep','upland','uplift','upload','upmost','upon','upper',
  'upright','uproar','uproot','upscale','upset','upside','upstairs','upstart','upstream','uptake',
  'uptight','uptown','upturn','upward','urban','urchin','urge','urgent','usable','usage',
  'used','useful','usher','usual','utensil','utility','utmost','utopia','utter','vacant',
  'vacate','vaccine','vacuum','vagabond','vague','vain','valance','valet','valiant','valid',
  'valley','valor','value','valve','vampire','van','vandal','vane','vanilla','vanish',
  'vanity','vapor','variable','varnish','vary','vase','vast','vat','vault','veal',
  'veer','veggie','veil','vein','velcro','velocity','velvet','vendor','veneer','venom',
  'vent','venture','venue','verb','verbal','verdict','verge','verify','verse','version',
  'versus','vertex','vertical','very','vessel','vest','veteran','veto','vex','via',
  'vial','vibrant','vibrate','vicar','vice','victim','victor','victory','video','view',
  'vigil','vigor','viking','village','villain','vine','vinegar','vintage','vinyl','viola',
  'violet','violin','viper','viral','virtue','virus','visa','viscount','visible','vision',
  'visit','visitor','visor','vista','visual','vital','vitamin','vivid','vixen','vocab',
  'vocal','vodka','vogue','voice','void','volcano','volley','volt','volume','volunteer',
  'voodoo','vote','voter','vouch','voucher','vow','vowel','voyage','vulture','wacky',
  'waddle','wade','wafer','waffle','wag','wage','wager','wagon','waist','wait',
  'waiter','waive','wake','walk','walker','wall','wallaby','wallet','wallop','wallow',
  'walnut','walrus','wand','wander','wane','want','war','warble','warden','wardrobe',
  'warehouse','warfare','warhead','warm','warmth','warn','warp','warrant','warrior','warship',
  'wart','wary','wash','washer','wasp','waste','watch','water','watercolor','waterfall',
  'watermelon','watt','wave','waver','wavy','wax','waxwing','waxy','way','wayside',
  'weak','wealth','weapon','wear','weary','weasel','weather','weave','web','website',
  'wedding','wedge','weed','week','weekday','weekend','weep','weevil','weigh','weight',
  'weird','welcome','weld','welfare','well','welt','went','wept','were','west',
  'western','wet','wetland','whack','whale','wharf','wheat','wheel','wheeze','whelp',
  'when','whether','whey','which','whiff','while','whim','whimper','whine','whinny',
  'whip','whirl','whisk','whisker','whisper','whistle','white','whittle','whiz','whole',
  'whoop','whopper','wick','wicked','wicker','wide','widen','widow','width','wield',
  'wig','wigwam','wild','wildcat','wildfire','wildlife','will','willow','wilt','wily',
  'wimpy','wince','winch','wind','windmill','window','windpipe','windshield','wine','wing',
  'wink','winner','winter','wipe','wiper','wire','wiry','wisdom','wise','wish',
  'wisp','wit','witch','with','wither','witness','witty','wizard','wobble','woe',
  'wok','wolf','wolverine','woman','wombat','wonder','wonderful','wood','woodland','woodpecker',
  'woodwork','woof','wool','woolly','word','wording','work','worker','workout','workshop',
  'world','worm','worn','worry','worse','worship','worst','worth','worthy','would',
  'wound','woven','wow','wrangle','wrap','wrapper','wrath','wreath','wreck','wren',
  'wrench','wrestle','wriggle','wring','wrinkle','wrist','writ','write','writer','writhe',
  'wrong','wrote','wrought','xylophone','yacht','yak','yam','yank','yard','yardstick',
  'yarn','yawn','year','yearbook','yearling','yearn','yeast','yell','yellow','yelp',
  'yes','yesterday','yeti','yield','yodel','yoga','yogurt','yoke','yolk','yonder',
  'young','youth','yo-yo','yucca','yummy','zealous','zebra','zenith','zephyr','zero',
  'zest','zesty','zigzag','zinc','zing','zip','zipper','zodiac','zombie','zone',
  'zoning','zoo','zoologist','zoom','zucchini',
];

// Deterministic suffixes used to extend the base pool to exactly 7776 entries.
const SUFFIXES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function buildList(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of BASE) {
    if (!seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  // Pad deterministically (base word + numeric suffix) until we reach 7776.
  let i = 0;
  let s = 0;
  while (out.length < 7776) {
    const base = BASE[i % BASE.length] ?? 'word';
    const suffix = SUFFIXES[s % SUFFIXES.length] ?? '1';
    const candidate = `${base}${suffix}`;
    if (!seen.has(candidate)) {
      seen.add(candidate);
      out.push(candidate);
    }
    i++;
    if (i % BASE.length === 0) s++;
  }
  return out.slice(0, 7776);
}

const WORDS = buildList();

// Roll 5 dice (1-6 each) using rejection sampling for an unbiased index 0..7775.
function rollWord(): { word: string; dice: string } {
  let idx = 0;
  const rolls: number[] = [];
  for (let d = 0; d < 5; d++) {
    const buf = new Uint8Array(1);
    let r = 6;
    // Reject 252..255 so 0..251 maps uniformly to 0..5 (six faces).
    do {
      wc.getRandomValues(buf);
      r = buf[0] ?? 0;
    } while (r >= 252);
    const face = (r % 6) + 1; // 1..6
    rolls.push(face);
    idx = idx * 6 + (face - 1);
  }
  return { word: WORDS[idx] ?? 'word', dice: rolls.join('') };
}

const SEPARATORS: Record<string, string> = {
  space: ' ',
  dash: '-',
  dot: '.',
  none: '',
};

type SepKey = keyof typeof SEPARATORS;
type Caps = 'none' | 'first' | 'all';

const SYMBOLS = '!@#$%^&*?';

function cap(word: string, mode: Caps): string {
  if (mode === 'none' || word.length === 0) return word;
  const first = word.charAt(0).toUpperCase();
  const rest = word.slice(1);
  if (mode === 'all') return first + rest.toUpperCase();
  return first + rest;
}

export default function DicewarePassphraseGenerator() {
  const [words, setWords] = useState(6);
  const [sep, setSep] = useState<SepKey>('dash');
  const [caps, setCaps] = useState<Caps>('first');
  const [appendExtra, setAppendExtra] = useState(true);

  const entropy = useMemo(() => {
    const base = words * Math.log2(7776);
    // A trailing digit (~3.32 bits) plus a symbol from a 9-char set (~3.17 bits).
    const extra = appendExtra ? Math.log2(10) + Math.log2(SYMBOLS.length) : 0;
    return Math.round((base + extra) * 10) / 10;
  }, [words, appendExtra]);

  const generate = () => {
    const separator = SEPARATORS[sep] ?? '-';
    const picked: string[] = [];
    let diceTrace = '';
    for (let i = 0; i < words; i++) {
      const { word, dice } = rollWord();
      picked.push(cap(word, caps));
      diceTrace += (i === 0 ? '' : ' ') + dice;
    }
    let phrase = picked.join(separator);
    if (appendExtra) {
      const buf = new Uint8Array(2);
      wc.getRandomValues(buf);
      const digit = (buf[0] ?? 0) % 10;
      const sym = SYMBOLS.charAt((buf[1] ?? 0) % SYMBOLS.length) || '!';
      phrase = `${phrase}${separator}${digit}${sym}`;
    }
    // Append the dice mapping inline so the canonical Diceware roll is visible.
    return `${phrase}    [${diceTrace}]`;
  };

  return (
    <GeneratorList
      generate={generate}
      deps={[words, sep, caps, appendExtra]}
      defaultCount={5}
      maxCount={200}
      downloadName="diceware-passphrases.txt"
      label={`Passphrases · ~${entropy} bits each`}
      options={
        <>
          <Field label={`Words · ${words}`} className="min-w-44">
            <Slider
              value={[words]}
              min={3}
              max={12}
              step={1}
              onValueChange={(v) => setWords(v[0] ?? 6)}
              className="mt-2.5"
            />
          </Field>
          <Field label="Separator">
            <Select value={sep} onValueChange={(v) => setSep(v as SepKey)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="space">Space</SelectItem>
                <SelectItem value="dash">Dash (-)</SelectItem>
                <SelectItem value="dot">Dot (.)</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Capitalize">
            <Select value={caps} onValueChange={(v) => setCaps(v as Caps)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">none</SelectItem>
                <SelectItem value="first">First letter</SelectItem>
                <SelectItem value="all">ALL CAPS</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Add digit + symbol">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={appendExtra} onCheckedChange={setAppendExtra} />
              <Label className="text-xs text-muted-foreground">9$ style</Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
