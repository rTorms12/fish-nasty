/* Fish Nasty — DNR species codes (from LakeFinder) and species profiles */
window.FN = window.FN || {};

// code -> [common name, game fish (1/0), family]
FN.SPECIES = {"ABL":["American brook lamprey",0,"Petromyzontidae"],"ALG":["alligator gar",0,"Lepisosteidae"],"ALW":["alewife",0,"Clupeidae"],"AME":["American eel",0,"Anguillidae"],"ARC":["Arctic char",0,"Salmonidae"],"ARG":["Arctic grayling",0,"Salmonidae"],"ASV":["Atlantic silverside",0,"Atherinidae"],"ATS":["Atlantic salmon",0,"Salmonidae"],"BCF":["blue catfish",0,"Ictaluridae"],"BCS":["blackchin shiner",0,"Cyprinidae"],"BDD":["banded darter",0,"Percidae"],"BDS":["banded sculpin",0,"Cottidae"],"BFC":["blackfin cisco",0,"Salmonidae"],"BHC":["bighead carp",0,"Cyprinidae"],"BHM":["bullhead minnow",0,"Cyprinidae"],"BIB":["bigmouth buffalo",0,"Catostomidae"],"BKB":["black buffalo",0,"Catostomidae"],"BKF":["banded killifish",0,"Fundulidae"],"BKS":["brook silverside",0,"Atherinidae"],"BKT":["brook trout",1,"Salmonidae"],"BLB":["black bullhead",0,"Ictaluridae"],"BLC":["black crappie",1,"Centrarchidae"],"BLD":["bluntnose darter",0,"Percidae"],"BLG":["bluegill",1,"Centrarchidae"],"BLH":["bullheads",0,"Ictaluridae"],"BLS":["blue sucker",0,"Catostomidae"],"BLT":["bloater",0,"Salmonidae"],"BMS":["bigmouth shiner",0,"Cyprinidae"],"BND":["western blacknose dace",0,"Cyprinidae"],"BNM":["bluntnose minnow",0,"Cyprinidae"],"BNS":["blacknose shiner",0,"Cyprinidae"],"BNT":["brown trout",1,"Salmonidae"],"BOF":["bowfin (dogfish)",0,"Amiidae"],"BRB":["brown bullhead",0,"Ictaluridae"],"BRH":["black redhorse",0,"Catostomidae"],"BRM":["brassy minnow",0,"Cyprinidae"],"BSD":["blackside darter",0,"Percidae"],"BSF":["banded sunfish",0,"Centrarchidae"],"BSS":["bluespotted sunfish",0,"Centrarchidae"],"BST":["brook stickleback",0,"Gasterosteidae"],"BUB":["burbot",0,"Gadidae"],"CAP":["common carp",0,"Cyprinidae"],"CCF":["channel catfish",1,"Ictaluridae"],"CHL":["chestnut lamprey",0,"Petromyzontidae"],"CHS":["Chinook salmon",1,"Salmonidae"],"CIS":["cisco species",0,"Salmonidae"],"CMS":["carmine shiner",0,"Cyprinidae"],"CNM":["central mudminnow",0,"Umbridae"],"COS":["coho salmon",1,"Salmonidae"],"CPS":["carpsucker",0,"Catostomidae"],"CRC":["creek chub",0,"Cyprinidae"],"CRD":["crystal darter",0,"Percidae"],"CRP":["crappie",1,"Centrarchidae"],"CSH":["common shiner",0,"Cyprinidae"],"CSR":["central stoneroller",0,"Cyprinidae"],"DAR":["darters",0,"Percidae"],"DSF":["dollar sunfish",0,"Centrarchidae"],"DWS":["deepwater sculpin",0,"Cottidae"],"EMS":["emerald shiner",0,"Cyprinidae"],"FCF":["flathead catfish",1,"Ictaluridae"],"FHM":["fathead minnow",0,"Cyprinidae"],"FLC":["flathead chub",0,"Cyprinidae"],"FLG":["Florida gar",0,"Lepisosteidae"],"FND":["finescale dace",0,"Cyprinidae"],"FRD":["freshwater drum",0,"Sciaenidae"],"FST":["fourspine stickleback",0,"Gasterosteidae"],"FTD":["fantail darter",0,"Percidae"],"GAP":["grass carp",0,"Cyprinidae"],"GHS":["ghost shiner",0,"Cyprinidae"],"GIS":["gizzard shad",0,"Clupeidae"],"GLD":["gilt darter",0,"Percidae"],"GLR":["golden redhorse",0,"Catostomidae"],"GOE":["goldeye",0,"Hiodontidae"],"GOF":["goldfish",0,"Cyprinidae"],"GOS":["golden shiner",0,"Cyprinidae"],"GRC":["gravel chub",0,"Cyprinidae"],"GRR":["greater redhorse",0,"Catostomidae"],"GSF":["green sunfish",1,"Centrarchidae"],"HCR":["hybrid crappie",1,"Centrarchidae"],"HFS":["highfin carpsucker",0,"Catostomidae"],"HHC":["hornyhead chub",0,"Cyprinidae"],"HSF":["hybrid sunfish",1,"Centrarchidae"],"ILA":["lamprey ammocoete",0,"Petromyzontidae"],"IOD":["Iowa darter",0,"Percidae"],"JND":["Johnny darter",0,"Percidae"],"KIC":["kiyi",0,"Salmonidae"],"KOK":["kokanee",1,"Salmonidae"],"LAT":["lake trout",1,"Salmonidae"],"LCP":["leather carp",0,"Cyprinidae"],"LED":["least darter",0,"Percidae"],"LES":["northern sunfish",1,"Centrarchidae"],"LGP":["logperch",0,"Percidae"],"LKC":["lake chub",0,"Cyprinidae"],"LKS":["lake sturgeon",1,"Acipenseridae"],"LKW":["lake whitefish",0,"Salmonidae"],"LMB":["largemouth bass",1,"Centrarchidae"],"LND":["longnose dace",0,"Cyprinidae"],"LNG":["longnose gar",0,"Lepisosteidae"],"LNS":["longnose sucker",0,"Catostomidae"],"LSR":["largescale stoneroller",0,"Cyprinidae"],"MCP":["mirror carp",0,"Cyprinidae"],"MDD":["mud darter",0,"Percidae"],"MMS":["mimic shiner",0,"Cyprinidae"],"MOE":["mooneye",0,"Hiodontidae"],"MTS":["mottled sculpin",0,"Cottidae"],"MUE":["muskellunge",1,"Esocidae"],"NBL":["northern brook lamprey",0,"Petromyzontidae"],"NHS":["northern hog sucker",0,"Catostomidae"],"NOP":["northern pike",1,"Esocidae"],"NPC":["Nipigon cisco",0,"Salmonidae"],"NPS":["No particular species",0,"Unknown sp."],"NRD":["northern redbelly dace",0,"Cyprinidae"],"NST":["ninespine stickleback",0,"Gasterosteidae"],"OSS":["orangespotted sunfish",1,"Centrarchidae"],"OTM":["minnows",0,"Cyprinidae"],"OTS":["suckers",0,"Catostomidae"],"OZM":["Ozark minnow",0,"Cyprinidae"],"PAH":["paddlefish",1,"Polyodontidae"],"PGM":["pugnose minnow",0,"Cyprinidae"],"PGS":["pugnose shiner",0,"Cyprinidae"],"PGW":["pygmy whitefish",0,"Salmonidae"],"PIR":["red breasted pirahna",0,"Characidae"],"PKS":["pink salmon",1,"Salmonidae"],"PLS":["pallid shiner",0,"Cyprinidae"],"PMK":["pumpkinseed",1,"Centrarchidae"],"PRD":["northern pearl dace",0,"Cyprinidae"],"PRP":["pirate perch",0,"Aphredoderidae"],"PTM":["plains topminnow",0,"Fundulidae"],"QBS":["quillback",0,"Catostomidae"],"RBD":["rainbow darter",0,"Percidae"],"RBS":["rainbow smelt",0,"Osmeridae"],"RBT":["rainbow trout",1,"Salmonidae"],"RCS":["river carpsucker",0,"Catostomidae"],"RDS":["red shiner",0,"Cyprinidae"],"RDW":["round whitefish",0,"Salmonidae"],"RES":["redfin shiner",0,"Cyprinidae"],"RFS":["rosyface shiner",0,"Cyprinidae"],"RGB":["round goby",0,"Gobiidae"],"RHS":["redhorse",0,"Catostomidae"],"RIR":["river ruffe",0,"Percidae"],"RKB":["rock bass",1,"Centrarchidae"],"RRH":["river redhorse",0,"Catostomidae"],"RSD":["redside dace",0,"Cyprinidae"],"RVD":["river darter",0,"Percidae"],"RVS":["river shiner",0,"Cyprinidae"],"SAB":["smallmouth buffalo",0,"Catostomidae"],"SAR":["sauger",1,"Percidae"],"SBL":["southern brook lamprey",0,"Petromyzontidae"],"SCT":["siscowet",0,"Salmonidae"],"SCU":["sculpin",0,"Cottidae"],"SDM":["slender madtom",0,"Ictaluridae"],"SDS":["sand shiner",0,"Cyprinidae"],"SEL":["sea lamprey",0,"Petromyzontidae"],"SFS":["spotfin shiner",0,"Cyprinidae"],"SHC":["shoal chub",0,"Cyprinidae"],"SHD":["slenderhead darter",0,"Percidae"],"SHI":["shiners",0,"Cyprinidae"],"SHR":["shorthead redhorse",0,"Catostomidae"],"SHS":["spoonhead sculpin",0,"Cottidae"],"SIC":["silver carp",0,"Cyprinidae"],"SIL":["silver lamprey",0,"Petromyzontidae"],"SIP":["northern pike (silver phase)",1,"Esocidae"],"SJC":["shortjaw cisco",0,"Salmonidae"],"SKJ":["skipjack herring",0,"Clupeidae"],"SKM":["suckermouth minnow",0,"Cyprinidae"],"SLC":["silver chub",0,"Cyprinidae"],"SLM":["Mississippi silvery minnow",0,"Cyprinidae"],"SLR":["silver redhorse",0,"Catostomidae"],"SLS":["shovelnose sturgeon",1,"Acipenseridae"],"SMB":["smallmouth bass",1,"Centrarchidae"],"SMS":["slimy sculpin",0,"Cottidae"],"SMT":["speckled madtom",0,"Ictaluridae"],"SNC":["shortnose cisco",0,"Salmonidae"],"SNG":["shortnose gar",0,"Lepisosteidae"],"SPC":["speckled chub",0,"Cyprinidae"],"SPG":["spotted gar",0,"Lepisosteidae"],"SPO":["spottail shiner",0,"Cyprinidae"],"SPS":["spotted sucker",0,"Catostomidae"],"SPT":["splake",1,"Salmonidae"],"SRD":["southern redbelly dace",0,"Cyprinidae"],"STB":["striped bass",0,"Moronidae"],"STC":["stonecat",0,"Ictaluridae"],"STM":["starhead topminnow",0,"Fundulidae"],"SUN":["sunfish",1,"Centrarchidae"],"TIL":["blue tilapia",0,"Cichlidae"],"TIT":["tiger trout",1,"Salmonidae"],"TKS":["Topeka shiner",0,"Cyprinidae"],"TLC":["tullibee (cisco)",0,"Salmonidae"],"TME":["tiger muskellunge",1,"Esocidae"],"TNG":["tubenose goby",0,"Gobiidae"],"TPM":["tadpole madtom",0,"Ictaluridae"],"TRP":["trout-perch",1,"Percopsidae"],"TST":["threespine stickleback",0,"Gasterosteidae"],"UK1":["unknown fish one",0,"Unknown sp."],"UK2":["unknown fish two",0,"Unknown sp."],"UK3":["unknown fish three",0,"Unknown sp."],"UK4":["unknown fish four",0,"Unknown sp."],"UK5":["unknown fish five",0,"Unknown sp."],"UK6":["unknown fish six",0,"Unknown sp."],"UK7":["unknown fish seven",0,"Unknown sp."],"UK8":["unknown fish eight",0,"Unknown sp."],"UK9":["unknown fish nine",0,"Unknown sp."],"WAE":["walleye",1,"Percidae"],"WAM":["warmouth",1,"Centrarchidae"],"WAS":["walleye/sauger",1,"Percidae"],"WDS":["weed shiner",0,"Cyprinidae"],"WHB":["white bass",1,"Moronidae"],"WHC":["white crappie",1,"Centrarchidae"],"WHP":["white perch",1,"Moronidae"],"WSD":["western sand darter",0,"Percidae"],"WTS":["white sucker",0,"Catostomidae"],"YEB":["yellow bullhead",0,"Ictaluridae"],"YEP":["yellow perch",1,"Percidae"],"YLB":["yellow bass",1,"Moronidae"]};

// Reverse lookup: common name (lowercase) -> code
FN.SPECIES_BY_NAME = (() => {
  const m = {};
  for (const [code, v] of Object.entries(FN.SPECIES)) m[v[0].toLowerCase()] = code;
  // LakeFinder species-list aliases
  m['sunfish'] = 'SUN'; m['crappie'] = 'CRP'; m['bullheads'] = 'BLH';
  m['cisco'] = 'TLC'; m['tullibee'] = 'TLC'; m['dogfish'] = 'BOF';
  m['northern pike'] = 'NOP'; m['walleye'] = 'WAE';
  return m;
})();

FN.speciesName = code => (FN.SPECIES[code] ? FN.SPECIES[code][0] : code);
FN.isGameFish = code => !!(FN.SPECIES[code] && FN.SPECIES[code][1]);
FN.speciesCode = name => FN.SPECIES_BY_NAME[String(name || '').trim().toLowerCase()] || null;

/*
 * Species profiles used by the bite forecast and the "where to look" guidance.
 * weights: multiplier applied to each raw factor contribution (1 = average fish).
 * season: 12 monthly adjustments (Jan..Dec) added to the score.
 * depth: typical depth ranges by season for Minnesota lakes (general guidance).
 */
FN.PROFILES = {
  ALL: {
    name: 'All species', icon: '🎣',
    weights: {},
    season: [0, 0, -2, 2, 6, 6, 1, 0, 4, 5, 2, 0]
  },
  WAE: {
    name: 'Walleye', icon: '🐟',
    weights: { lowLight: 1.5, midday: 1.3, clear: 1.5, overcast: 1.3, wind: 1.4, calm: 1.3, night: 0.4, solunar: 1.1, moon: 1.1, pressureFall: 1.1, postFront: 1.2 },
    season: [2, 2, 0, 0, 8, 6, 0, -1, 3, 6, 3, 2],
    depth: { spring: '4–12 ft (rock/gravel shorelines, river mouths)', summer: '15–30 ft (mid-lake humps, weed edges, mud flats)', fall: '20–40 ft (steep breaks, deep points)', winter: 'Ice: 20–35 ft on deep flats and bar edges; early ice shallower (8–15 ft); best at dawn and dusk' },
    tips: 'Low light is king: dawn, dusk, overcast and a 10–15 mph "walleye chop" out-fish bluebird skies. Jig + minnow in spring, live-bait rigs and crankbaits on breaks in summer, big minnows in fall.'
  },
  NOP: {
    name: 'Northern pike', icon: '🐊',
    weights: { lowLight: 0.8, midday: 0.5, clear: 0.6, overcast: 1.2, wind: 1.2, calm: 0.8, night: 1.4, postFront: 0.8, cold: 0.3, heat: 1.4 },
    season: [3, 3, 0, 3, 6, 4, 0, -1, 3, 5, 3, 2],
    depth: { spring: '2–8 ft (shallow bays, emerging weeds)', summer: '8–20 ft (weedlines, cooler water; big fish deeper)', fall: '8–25 ft (green weed edges, cisco lakes deeper)', winter: 'Ice: 5–15 ft over green weed flats and bay mouths; tip-ups with sucker minnows, midday is fine' },
    tips: 'Pike feed through the day. Fish wind-blown weedlines with spoons, spinnerbaits, and big soft plastics; sucker minnows under a float in fall and through the ice.'
  },
  MUE: {
    name: 'Muskellunge', icon: '🦈',
    weights: { solunar: 1.7, moon: 1.8, lowLight: 1.2, postFront: 1.3, wind: 1.2, calm: 1.1, night: 0.6, pressureFall: 1.3, heat: 1.2 },
    season: [0, 0, 0, 0, 0, 3, 4, 5, 8, 9, 6, 0],
    depth: { spring: '3–10 ft (bays, weed flats as water warms)', summer: '8–20 ft (weed edges, rock bars; suspended over deep water)', fall: '10–30 ft (deep weed edges, sharp breaks; big baits)', winter: 'Season closed (Dec 1 – late May)' },
    tips: 'Muskies move on moon events: fish the major/minor periods and new/full moon days hard. Figure-8 every cast. Bucktails and topwaters in summer, large rubber and gliders in fall.'
  },
  LMB: {
    name: 'Largemouth bass', icon: '🐸',
    weights: { postFront: 1.6, pressureFall: 1.2, lowLight: 1.1, overcast: 1.1, clear: 0.8, calm: 0.6, wind: 0.8, heat: 0.4, cold: 1.6, night: 0.8 },
    season: [-4, -4, -2, 0, 4, 7, 6, 5, 4, 1, -3, -4],
    depth: { spring: '1–8 ft (bays, docks, pencil reeds)', summer: '4–15 ft (weedlines, lily pads, docks; deeper on bright days)', fall: '5–20 ft (green weeds, inside turns)', winter: '10–20 ft (sluggish; weed flats)' },
    tips: 'Stable, warm weather beats cold fronts. Pitch jigs and Texas rigs to cover, frogs over pads, and swim jigs along cabbage edges.'
  },
  SMB: {
    name: 'Smallmouth bass', icon: '🪨',
    weights: { wind: 1.3, calm: 1.2, postFront: 1.3, pressureFall: 1.1, clear: 0.6, overcast: 0.9, lowLight: 0.9, heat: 0.7, cold: 1.3 },
    season: [-4, -4, -2, 0, 5, 7, 5, 5, 6, 3, -2, -4],
    depth: { spring: '3–10 ft (gravel/rock spawning flats)', summer: '10–25 ft (rock humps, points, boulder fields)', fall: '15–35 ft (deep rock, following baitfish)', winter: '20–35 ft (deep, tight to bottom)' },
    tips: 'Wind on rocky points turns smallmouth on. Tubes, Ned rigs, drop-shots and jerkbaits; topwater early and late.'
  },
  BLC: {
    name: 'Black crappie', icon: '🥏',
    weights: { lowLight: 1.4, calm: 0.4, wind: 0.5, overcast: 1.2, clear: 1.1, night: 0.7, postFront: 1.2, solunar: 1.1, cold: 0.6 },
    season: [3, 4, 2, 4, 8, 3, 0, 0, 2, 4, 3, 3],
    depth: { spring: '2–8 ft (warm, dark-bottom bays, pencil reeds)', summer: '10–20 ft (suspended off weedlines and over basins)', fall: '12–25 ft (deep weed edges, basin edges)', winter: 'Ice: 15–35 ft suspended over soft-bottom basins; early ice on deep weed edges; the last hour of light' },
    tips: 'Dusk is prime. Small jigs and minnows under a float in spring; vertical jig suspended fish on electronics in summer and through the ice.'
  },
  BLG: {
    name: 'Bluegill', icon: '🌞',
    weights: { lowLight: 0.7, midday: 0.4, clear: 0.3, overcast: 0.6, calm: 0.2, wind: 0.6, night: 1.3, heat: 0.4, cold: 1.2, postFront: 0.8 },
    season: [3, 3, 1, 2, 6, 8, 5, 4, 3, 2, 1, 2],
    depth: { spring: '1–6 ft (spawning beds on sand/gravel)', summer: '6–15 ft (weedlines; big ones deeper)', fall: '8–18 ft (deep weed edges)', winter: '8–20 ft (green weeds, basin edges)' },
    tips: 'Sunfish bite well on calm sunny days. Tiny jigs, leeches, waxworms and small plastics; fish the weedline for the biggest fish.'
  },
  SUN: { name: 'Sunfish', icon: '🌞', alias: 'BLG' },
  PMK: { name: 'Pumpkinseed', icon: '🌞', alias: 'BLG' },
  HSF: { name: 'Hybrid sunfish', icon: '🌞', alias: 'BLG' },
  YEP: {
    name: 'Yellow perch', icon: '🟡',
    weights: { lowLight: 0.6, midday: 0.3, clear: 0.4, night: 1.6, calm: 0.4, wind: 0.8, cold: 0.3, heat: 0.8 },
    season: [6, 6, 4, 2, 3, 3, 2, 3, 4, 3, 3, 5],
    depth: { spring: '3–10 ft (weed flats, sand)', summer: '10–25 ft (sand/mud flats, deep weeds)', fall: '15–30 ft (deep flats)', winter: '15–35 ft (mud flats, basins; jumbo perch deeper)' },
    tips: 'A daytime, schooling fish. Minnow heads and small spoons; keep moving until you find the school.'
  },
  LAT: {
    name: 'Lake trout', icon: '❄️',
    weights: { cold: 0.1, heat: 1.6, lowLight: 1.2, wind: 0.8, calm: 0.5, overcast: 1.2, clear: 1.1, night: 0.9 },
    season: [8, 8, 6, 3, 4, 0, -4, -5, -2, 2, 4, 6],
    depth: { spring: '5–30 ft (ice-out, shallow and shoreline oriented)', summer: '40–100+ ft (thermocline and below)', fall: '10–40 ft (spawning reefs in Oct)', winter: '20–80 ft (ice season; tube jigs and spoons)' },
    tips: 'Cold water fish. After ice-out and through the ice, lakers roam shallow; in summer troll spoons deep or jig over structure.'
  },
  CCF: {
    name: 'Channel catfish', icon: '🐱',
    weights: { night: -0.8, heat: 0.2, rain: -0.5, lowLight: 1.2, midday: 1.2, clear: 0.8, pressureFall: 1.2 },
    season: [-3, -3, -1, 1, 4, 7, 7, 6, 4, 1, -2, -3],
    depth: { spring: '3–12 ft (warm inflows, river mouths)', summer: '5–20 ft (holes, flats at night)', fall: '8–25 ft (deeper holes)', winter: '15–30 ft (deep wintering holes)' },
    tips: 'Night and warm, rising water after rain are best. Cut bait, stink bait and nightcrawlers on the bottom.'
  },
  FCF: { name: 'Flathead catfish', icon: '🐱', alias: 'CCF' },
  RBT: {
    name: 'Rainbow trout', icon: '🌈',
    weights: { overcast: 1.3, clear: 1.3, heat: 1.6, cold: 0.3, rain: -0.3, lowLight: 1.2, wind: 0.9 },
    season: [3, 3, 4, 6, 7, 3, -2, -3, 2, 6, 5, 3],
    depth: { spring: '3–15 ft (shoreline cruising after ice-out)', summer: '15–40 ft (cool water below the thermocline)', fall: '5–20 ft (shallower as water cools)', winter: '5–25 ft (through the ice on small jigs)' },
    tips: 'Stocked trout lakes fish best in cool water. Small spoons, spinners, flies and PowerBait near inlets and drop-offs.'
  },
  BNT: { name: 'Brown trout', icon: '🌈', alias: 'RBT' },
  BKT: { name: 'Brook trout', icon: '🌈', alias: 'RBT' },
  SPT: { name: 'Splake', icon: '🌈', alias: 'RBT' },
  WHB: {
    name: 'White bass', icon: '⚪',
    weights: { wind: 1.1, lowLight: 1.1, midday: 0.8, overcast: 1.0, clear: 0.8 },
    season: [0, 0, 1, 4, 7, 5, 4, 4, 5, 3, 0, 0],
    depth: { spring: '2–10 ft (river inflows, spawning runs)', summer: '5–20 ft (chasing bait on wind-blown points, surfacing)', fall: '8–20 ft (schools on flats)', winter: '15–30 ft (deep holes)' },
    tips: 'Find surfacing schools chasing shiners; small jigs, spoons and blade baits.'
  },
  TLC: { name: 'Tullibee (cisco)', icon: '🐠', weights: { cold: 0.3, heat: 1.4 }, season: [5, 5, 3, 2, 2, 0, -3, -3, 0, 2, 5, 5],
    depth: { spring: '10–30 ft', summer: '30–70 ft (cold, oxygenated water)', fall: '5–20 ft (Nov spawn on shallow gravel)', winter: '20–60 ft (suspended; tiny spoons)' }, tips: 'A cold-water forage species and an ice-fishing target in deep, clear lakes.' },
  BUB: { name: 'Burbot (eelpout)', icon: '🐍', weights: { night: -1.0, cold: 0.0, heat: 1.5, lowLight: 1.2 }, season: [8, 9, 5, 0, -2, -4, -4, -4, -2, 0, 3, 7],
    depth: { spring: '15–40 ft', summer: '40–80 ft (deep, cold)', fall: '20–50 ft', winter: '10–40 ft (after dark on rock/gravel; Feb spawn)' }, tips: 'A winter night bite. Glow jigs tipped with minnows on hard bottom after sunset.' },
  SAR: { name: 'Sauger', icon: '🐟', alias: 'WAE' },
  WAS: { name: 'Walleye/sauger hybrid', icon: '🐟', alias: 'WAE' },
  CRP: { name: 'Crappie', icon: '🥏', alias: 'BLC' },
  WHC: { name: 'White crappie', icon: '🥏', alias: 'BLC' },
  RKB: { name: 'Rock bass', icon: '🪨', alias: 'SMB' },
  TME: { name: 'Tiger muskellunge', icon: '🦈', alias: 'MUE' }
};

FN.profileFor = code => {
  let p = FN.PROFILES[code];
  if (!p) return null;
  if (p.alias) p = Object.assign({}, FN.PROFILES[p.alias], { name: p.name, icon: p.icon, code });
  return p;
};
// Order in which species chips are shown (most popular first)
FN.PROFILE_ORDER = ['WAE', 'NOP', 'MUE', 'LMB', 'SMB', 'BLC', 'BLG', 'YEP', 'LAT', 'RBT', 'BNT', 'BKT', 'SPT', 'CCF', 'FCF', 'WHB', 'TLC', 'BUB', 'SAR', 'WAS', 'CRP', 'WHC', 'SUN', 'PMK', 'HSF', 'RKB', 'TME'];

// Minnesota seasons: ice (Dec–Mar), spring open water (Apr–May), summer (Jun–Aug), fall (Sep–Nov)
FN.seasonOf = date => {
  const m = date.getMonth();
  if (m >= 3 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
};
