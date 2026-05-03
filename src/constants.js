export const CLASSES = ["WR","MG","WB","WF","EA","EP","MC","PSY"];

export const CLASS_LABELS = {
  WR:"Warrior",MG:"Magician",WB:"Werebeast",WF:"Werefox",
  EA:"Elf Archer",EP:"Elf Principe",MC:"Mercenario",PSY:"Psychic"
};

export const CLASS_COLORS = {
  WR:"#C94C4C",MG:"#9B59B6",WB:"#D4803A",WF:"#4CAF50",
  EA:"#26A69A",EP:"#C9A84C",MC:"#3A6EA5",PSY:"#E87BBF"
};

export const CULTIVOS = [
  "Spiritual Adept","Aware of Principle","Aware of Harmony",
  "Aware of Discord","Aware of Coalescence","Transcendant",
  "Obscure","Astral","Mirage","Nirvana",
  "Celestial Sage","Celestial Demon","Nenhum"
];

export const EVENT_TYPES = ["TW","World Boss","Marcial"];

export const CLASS_MAP = {
  "wr":"WR","warrior":"WR","guerreiro":"WR","guerreira":"WR","blademaster":"WR",
  "mg":"MG","magician":"MG","mago":"MG","maga":"MG","wizard":"MG","feiti":"MG","feiti.":"MG","feiticeiro":"MG","feiticeira":"MG","wiz":"MG",
  "wb":"WB","werebeast":"WB","bárbaro":"WB","barbaro":"WB","barb":"WB","barbarian":"WB",
  "wf":"WF","werefox":"WF","espirit":"WF","espirit.":"WF","espiritualista":"WF","veno":"WF","venomancer":"WF",
  "ea":"EA","elfarcher":"EA","arque":"EA","arque.":"EA","arqueiro":"EA","arqueira":"EA","archer":"EA",
  "ep":"EP","elfprincipe":"EP","clér":"EP","cler":"EP","clér.":"EP","cler.":"EP","clérigo":"EP","clerigo":"EP","cleriga":"EP","cleric":"EP",
  "mc":"MC","mercenario":"MC","mercenário":"MC","merc":"MC","merc.":"MC","assassin":"MC","assassino":"MC","sin":"MC",
  "psy":"PSY","psychic":"PSY","psíq":"PSY","psiq":"PSY","psíquico":"PSY","psiquico":"PSY",
};

export const DEFAULT_DATA = {
  members: [],
  events: [],
  twWeeks: [],
  lentAccounts: [],
  twPTs: {},
};

export function resolveClass(raw) {
  if (!raw) return CLASSES[0];
  const key = raw.trim().toLowerCase().replace(/\.$/, "");
  if (CLASS_MAP[key]) return CLASS_MAP[key];
  const found = Object.entries(CLASS_MAP).find(([k]) => key.startsWith(k) || k.startsWith(key));
  if (found) return found[1];
  const direct = CLASSES.find(c => c.toLowerCase() === key);
  if (direct) return direct;
  return raw.trim();
}
