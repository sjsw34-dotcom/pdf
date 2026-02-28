// 사주(四柱) 전문 용어 한→영 사전
// 번역 시 Claude API에 참조 용어집으로 제공

export interface GlossaryEntry {
  korean: string;
  hanja?: string;
  english: string;
  description?: string;
}

// 천간 (天干) - Heavenly Stems
export const heavenlyStems: GlossaryEntry[] = [
  { korean: "갑", hanja: "甲", english: "Gap (甲)", description: "Yang Wood" },
  { korean: "을", hanja: "乙", english: "Eul (乙)", description: "Yin Wood" },
  { korean: "병", hanja: "丙", english: "Byeong (丙)", description: "Yang Fire" },
  { korean: "정", hanja: "丁", english: "Jeong (丁)", description: "Yin Fire" },
  { korean: "무", hanja: "戊", english: "Mu (戊)", description: "Yang Earth" },
  { korean: "기", hanja: "己", english: "Gi (己)", description: "Yin Earth" },
  { korean: "경", hanja: "庚", english: "Gyeong (庚)", description: "Yang Metal" },
  { korean: "신", hanja: "辛", english: "Sin (辛)", description: "Yin Metal" },
  { korean: "임", hanja: "壬", english: "Im (壬)", description: "Yang Water" },
  { korean: "계", hanja: "癸", english: "Gye (癸)", description: "Yin Water" },
];

// 지지 (地支) - Earthly Branches
export const earthlyBranches: GlossaryEntry[] = [
  { korean: "자", hanja: "子", english: "Ja (子)", description: "Rat" },
  { korean: "축", hanja: "丑", english: "Chuk (丑)", description: "Ox" },
  { korean: "인", hanja: "寅", english: "In (寅)", description: "Tiger" },
  { korean: "묘", hanja: "卯", english: "Myo (卯)", description: "Rabbit" },
  { korean: "진", hanja: "辰", english: "Jin (辰)", description: "Dragon" },
  { korean: "사", hanja: "巳", english: "Sa (巳)", description: "Snake" },
  { korean: "오", hanja: "午", english: "O (午)", description: "Horse" },
  { korean: "미", hanja: "未", english: "Mi (未)", description: "Goat" },
  { korean: "신", hanja: "申", english: "Sin (申)", description: "Monkey" },
  { korean: "유", hanja: "酉", english: "Yu (酉)", description: "Rooster" },
  { korean: "술", hanja: "戌", english: "Sul (戌)", description: "Dog" },
  { korean: "해", hanja: "亥", english: "Hae (亥)", description: "Pig" },
];

// 오행 (五行) - Five Elements
export const fiveElements: GlossaryEntry[] = [
  { korean: "목", hanja: "木", english: "Wood (木)" },
  { korean: "화", hanja: "火", english: "Fire (火)" },
  { korean: "토", hanja: "土", english: "Earth (土)" },
  { korean: "금", hanja: "金", english: "Metal (金)" },
  { korean: "수", hanja: "水", english: "Water (水)" },
];

// 사주 구조 용어
export const structuralTerms: GlossaryEntry[] = [
  { korean: "사주", hanja: "四柱", english: "Four Pillars (四柱, Saju)" },
  { korean: "팔자", hanja: "八字", english: "Eight Characters (八字)" },
  { korean: "년주", hanja: "年柱", english: "Year Pillar (年柱)" },
  { korean: "월주", hanja: "月柱", english: "Month Pillar (月柱)" },
  { korean: "일주", hanja: "日柱", english: "Day Pillar (日柱)" },
  { korean: "시주", hanja: "時柱", english: "Hour Pillar (時柱)" },
  { korean: "천간", hanja: "天干", english: "Heavenly Stems (天干)" },
  { korean: "지지", hanja: "地支", english: "Earthly Branches (地支)" },
  { korean: "오행", hanja: "五行", english: "Five Elements (五行)" },
  { korean: "음양", hanja: "陰陽", english: "Yin and Yang (陰陽)" },
  { korean: "일간", hanja: "日干", english: "Day Master (日干)" },
  { korean: "일지", hanja: "日支", english: "Day Branch (日支)" },
  { korean: "월간", hanja: "月干", english: "Month Stem (月干)" },
  { korean: "월지", hanja: "月支", english: "Month Branch (月支)" },
];

// 십성 (十星) - Ten Gods/Stars
export const tenGods: GlossaryEntry[] = [
  { korean: "비견", hanja: "比肩", english: "Companion (比肩, Bigyeon)" },
  { korean: "겁재", hanja: "劫財", english: "Rob Wealth (劫財, Geopjae)" },
  { korean: "식신", hanja: "食神", english: "Eating God (食神, Siksin)" },
  { korean: "상관", hanja: "傷官", english: "Hurting Officer (傷官, Sanggwan)" },
  { korean: "편재", hanja: "偏財", english: "Indirect Wealth (偏財, Pyeonjae)" },
  { korean: "정재", hanja: "正財", english: "Direct Wealth (正財, Jeongjae)" },
  { korean: "편관", hanja: "偏官", english: "Indirect Authority (偏官, Pyeongwan)" },
  { korean: "정관", hanja: "正官", english: "Direct Authority (正官, Jeonggwan)" },
  { korean: "편인", hanja: "偏印", english: "Indirect Seal (偏印, Pyeonin)" },
  { korean: "정인", hanja: "正印", english: "Direct Seal (正印, Jeongin)" },
];

// 운세 관련 용어
export const fortuneTerms: GlossaryEntry[] = [
  { korean: "대운", hanja: "大運", english: "Major Luck Cycle (大運, Daeun)" },
  { korean: "세운", hanja: "歲運", english: "Annual Fortune (歲運, Seun)" },
  { korean: "월운", hanja: "月運", english: "Monthly Fortune (月運, Worun)" },
  { korean: "용신", hanja: "用神", english: "Favorable Element (用神, Yongsin)" },
  { korean: "기신", hanja: "忌神", english: "Unfavorable Element (忌神, Gisin)" },
  { korean: "희신", hanja: "喜神", english: "Joyful Element (喜神, Huisin)" },
  { korean: "격국", hanja: "格局", english: "Chart Pattern (格局, Gyeokguk)" },
  { korean: "합", hanja: "合", english: "Harmony/Combination (合)" },
  { korean: "충", hanja: "沖", english: "Clash (沖)" },
  { korean: "형", hanja: "刑", english: "Punishment (刑)" },
  { korean: "파", hanja: "破", english: "Break (破)" },
  { korean: "해", hanja: "害", english: "Harm (害)" },
  { korean: "원진", hanja: "怨嗔", english: "Resentment (怨嗔, Wonjin)" },
  { korean: "귀문관살", hanja: "鬼門關殺", english: "Ghost Gate Star (鬼門關殺)" },
  { korean: "도화살", hanja: "桃花殺", english: "Peach Blossom Star (桃花殺)" },
  { korean: "역마살", hanja: "驛馬殺", english: "Traveling Horse Star (驛馬殺)" },
  { korean: "화개살", hanja: "華蓋殺", english: "Canopy Star (華蓋殺)" },
];

// 생활 영역 용어
export const lifeAreaTerms: GlossaryEntry[] = [
  { korean: "재물운", english: "Financial Fortune (財運)" },
  { korean: "직업운", english: "Career Fortune (職業運)" },
  { korean: "건강운", english: "Health Fortune (健康運)" },
  { korean: "연애운", english: "Romance Fortune (戀愛運)" },
  { korean: "결혼운", english: "Marriage Fortune (結婚運)" },
  { korean: "학업운", english: "Academic Fortune (學業運)" },
  { korean: "대인관계", english: "Interpersonal Relationships (對人關係)" },
  { korean: "부부궁합", english: "Marital Compatibility (夫婦宮合)" },
];

// 모든 용어를 하나의 문자열로 합쳐 프롬프트에 제공
export function getGlossaryForPrompt(): string {
  const allEntries = [
    ...heavenlyStems,
    ...earthlyBranches,
    ...fiveElements,
    ...structuralTerms,
    ...tenGods,
    ...fortuneTerms,
    ...lifeAreaTerms,
  ];

  const lines = allEntries.map((entry) => {
    const parts = [entry.korean];
    if (entry.hanja) parts.push(`(${entry.hanja})`);
    parts.push("→");
    parts.push(entry.english);
    if (entry.description) parts.push(`[${entry.description}]`);
    return parts.join(" ");
  });

  return lines.join("\n");
}
