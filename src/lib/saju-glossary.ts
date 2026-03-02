// 사주(四柱) 전문 용어 한→영 사전
// 번역 시 Claude API에 참조 용어집으로 제공

export interface GlossaryEntry {
  korean: string;
  hanja?: string;
  english: string;
  description?: string;
}

// 천간 (天干) - Heavenly Stems
// Format: Romanized (한글 · 漢字) · Yin/Yang Element
export const heavenlyStems: GlossaryEntry[] = [
  { korean: "갑", hanja: "甲", english: "Gap (갑 · 甲) · Yang Wood" },
  { korean: "을", hanja: "乙", english: "Eul (을 · 乙) · Yin Wood" },
  { korean: "병", hanja: "丙", english: "Byeong (병 · 丙) · Yang Fire" },
  { korean: "정", hanja: "丁", english: "Jeong (정 · 丁) · Yin Fire" },
  { korean: "무", hanja: "戊", english: "Mu (무 · 戊) · Yang Earth" },
  { korean: "기", hanja: "己", english: "Gi (기 · 己) · Yin Earth" },
  { korean: "경", hanja: "庚", english: "Gyeong (경 · 庚) · Yang Metal" },
  { korean: "신", hanja: "辛", english: "Sin (신 · 辛) · Yin Metal" },
  { korean: "임", hanja: "壬", english: "Im (임 · 壬) · Yang Water" },
  { korean: "계", hanja: "癸", english: "Gye (계 · 癸) · Yin Water" },
];

// 지지 (地支) - Earthly Branches
// Format: Romanized (한글 · 漢字) · Animal
export const earthlyBranches: GlossaryEntry[] = [
  { korean: "자", hanja: "子", english: "Ja (자 · 子) · Rat" },
  { korean: "축", hanja: "丑", english: "Chuk (축 · 丑) · Ox" },
  { korean: "인", hanja: "寅", english: "In (인 · 寅) · Tiger" },
  { korean: "묘", hanja: "卯", english: "Myo (묘 · 卯) · Rabbit" },
  { korean: "진", hanja: "辰", english: "Jin (진 · 辰) · Dragon" },
  { korean: "사", hanja: "巳", english: "Sa (사 · 巳) · Snake" },
  { korean: "오", hanja: "午", english: "O (오 · 午) · Horse" },
  { korean: "미", hanja: "未", english: "Mi (미 · 未) · Goat" },
  { korean: "신", hanja: "申", english: "Sin (신 · 申) · Monkey" },
  { korean: "유", hanja: "酉", english: "Yu (유 · 酉) · Rooster" },
  { korean: "술", hanja: "戌", english: "Sul (술 · 戌) · Dog" },
  { korean: "해", hanja: "亥", english: "Hae (해 · 亥) · Pig" },
];

// 오행 (五行) - Five Elements
// Format: Element (漢字) — NO duplicate like "木 Wood Tree"
export const fiveElements: GlossaryEntry[] = [
  { korean: "목", hanja: "木", english: "Wood (木)" },
  { korean: "화", hanja: "火", english: "Fire (火)" },
  { korean: "토", hanja: "土", english: "Earth (土)" },
  { korean: "금", hanja: "金", english: "Metal (金)" },
  { korean: "수", hanja: "水", english: "Water (水)" },
];

// 사주 구조 용어
export const structuralTerms: GlossaryEntry[] = [
  { korean: "사주팔자", hanja: "四柱八字", english: "사주팔자 · Four Pillars of Destiny", description: "brand term — use as-is" },
  { korean: "사주", hanja: "四柱", english: "Saju" },
  { korean: "팔자", hanja: "八字", english: "Palja" },
  { korean: "년주", hanja: "年柱", english: "Year Pillar (년주 · 年柱)" },
  { korean: "월주", hanja: "月柱", english: "Month Pillar (월주 · 月柱)" },
  { korean: "일주", hanja: "日柱", english: "Day Pillar (일주 · 日柱)" },
  { korean: "시주", hanja: "時柱", english: "Hour Pillar (시주 · 時柱)" },
  { korean: "천간", hanja: "天干", english: "Heavenly Stems (천간 · 天干)" },
  { korean: "지지", hanja: "地支", english: "Earthly Branches (지지 · 地支)" },
  { korean: "오행", hanja: "五行", english: "Five Elements (오행 · 五行)" },
  { korean: "음양", hanja: "陰陽", english: "Yin and Yang (음양 · 陰陽)" },
  { korean: "양", hanja: "陽", english: "Yang (양 · 陽)" },
  { korean: "음", hanja: "陰", english: "Yin (음 · 陰)" },
  { korean: "일간", hanja: "日干", english: "Day Master (일간 · 日干)" },
  { korean: "일지", hanja: "日支", english: "Day Branch (일지 · 日支)" },
  { korean: "월간", hanja: "月干", english: "Month Stem (월간 · 月干)" },
  { korean: "월지", hanja: "月支", english: "Month Branch (월지 · 月支)" },
];

// 십신 (十神) - Ten Gods
// Format: English (한글 · 漢字) — NO romanization alone
export const tenGods: GlossaryEntry[] = [
  { korean: "비견", hanja: "比肩", english: "Companion (비견 · 比肩)" },
  { korean: "겁재", hanja: "劫財", english: "Rob Wealth (겁재 · 劫財)" },
  { korean: "식신", hanja: "食神", english: "Eating God (식신 · 食神)" },
  { korean: "상관", hanja: "傷官", english: "Hurting Officer (상관 · 傷官)" },
  { korean: "편재", hanja: "偏財", english: "Indirect Wealth (편재 · 偏財)" },
  { korean: "정재", hanja: "正財", english: "Direct Wealth (정재 · 正財)" },
  { korean: "편관", hanja: "偏官", english: "Indirect Authority (편관 · 偏官)" },
  { korean: "정관", hanja: "正官", english: "Direct Authority (정관 · 正官)" },
  { korean: "편인", hanja: "偏印", english: "Indirect Seal (편인 · 偏印)" },
  { korean: "정인", hanja: "正印", english: "Direct Seal (정인 · 正印)" },
];

// 12운성 (十二運星) - Twelve Life Stages
// Format: English (한글 · 漢字)
export const twelveStagess: GlossaryEntry[] = [
  { korean: "절", hanja: "絶", english: "Conception (절 · 絶)" },
  { korean: "태", hanja: "胎", english: "Nurturing (태 · 胎)" },
  { korean: "양", hanja: "養", english: "Growth (양 · 養)" },
  { korean: "장생", hanja: "長生", english: "Birth (장생 · 長生)" },
  { korean: "목욕", hanja: "沐浴", english: "Bath (목욕 · 沐浴)" },
  { korean: "관대", hanja: "冠帶", english: "Crown (관대 · 冠帶)" },
  { korean: "건록", hanja: "建祿", english: "Prime (건록 · 建祿)" },
  { korean: "제왕", hanja: "帝旺", english: "Prosperity (제왕 · 帝旺)" },
  { korean: "쇠", hanja: "衰", english: "Decline (쇠 · 衰)" },
  { korean: "병", hanja: "病", english: "Sickness (병 · 病)" },
  { korean: "사", hanja: "死", english: "Death (사 · 死)" },
  { korean: "묘", hanja: "墓", english: "Tomb (묘 · 墓)" },
];

// 특수성 (特殊星) - Special Stars
export const specialStars: GlossaryEntry[] = [
  { korean: "월살", hanja: "月殺", english: "Monthly Star (월살 · 月殺)" },
  { korean: "육해살", hanja: "六害殺", english: "Six Harm Star (육해살 · 六害殺)" },
  { korean: "반안살", hanja: "鞍殺", english: "Saddle Star (반안살 · 鞍殺)" },
  { korean: "지살", hanja: "地殺", english: "Journey Star (지살 · 地殺)" },
  { korean: "도화살", hanja: "桃花殺", english: "Peach Blossom Star (도화살 · 桃花殺)" },
  { korean: "역마살", hanja: "驛馬殺", english: "Traveling Horse Star (역마살 · 驛馬殺)" },
  { korean: "화개살", hanja: "華蓋殺", english: "Canopy Star (화개살 · 華蓋殺)" },
  { korean: "귀문관살", hanja: "鬼門關殺", english: "Ghost Gate Star (귀문관살 · 鬼門關殺)" },
];

// 용신 관련 용어
export const favorableElementTerms: GlossaryEntry[] = [
  { korean: "용신", hanja: "用神", english: "Favorable Element (용신 · 用神)" },
  { korean: "희신", hanja: "喜神", english: "Joyful Element (희신 · 喜神)" },
  { korean: "기신", hanja: "忌神", english: "Unfavorable Element (기신 · 忌神)" },
  { korean: "구신", hanja: "仇神", english: "Antagonistic Element (구신 · 仇神)" },
  { korean: "한신", hanja: "閑神", english: "Neutral Element (한신 · 閑神)" },
  { korean: "용신분석", hanja: "用神分析", english: "Favorable Element Analysis (용신분석 · 用神分析)" },
];

// 운세 관련 용어
export const fortuneTerms: GlossaryEntry[] = [
  { korean: "대운", hanja: "大運", english: "Major Luck Cycle (대운 · 大運)" },
  { korean: "세운", hanja: "歲運", english: "Annual Fortune (세운 · 歲運)" },
  { korean: "월운", hanja: "月運", english: "Monthly Fortune (월운 · 月運)" },
  { korean: "격국", hanja: "格局", english: "Chart Pattern (격국 · 格局)" },
  { korean: "합", hanja: "合", english: "Harmony/Combination (합 · 合)" },
  { korean: "충", hanja: "沖", english: "Clash (충 · 沖)" },
  { korean: "형", hanja: "刑", english: "Punishment (형 · 刑)" },
  { korean: "파", hanja: "破", english: "Break (파 · 破)" },
  { korean: "해", hanja: "害", english: "Harm (해 · 害)" },
  { korean: "원진", hanja: "怨嗔", english: "Resentment (원진 · 怨嗔)" },
];

// 생활 영역 용어
export const lifeAreaTerms: GlossaryEntry[] = [
  { korean: "재물운", english: "Financial Fortune (재물운 · 財運)" },
  { korean: "직업운", english: "Career Fortune (직업운 · 職業運)" },
  { korean: "건강운", english: "Health Fortune (건강운 · 健康運)" },
  { korean: "연애운", english: "Romance Fortune (연애운 · 戀愛運)" },
  { korean: "결혼운", english: "Marriage Fortune (결혼운 · 結婚運)" },
  { korean: "학업운", english: "Academic Fortune (학업운 · 學業運)" },
  { korean: "대인관계", english: "Interpersonal Relationships (대인관계 · 對人關係)" },
  { korean: "부부궁합", english: "Marital Compatibility (부부궁합 · 夫婦宮合)" },
];

// 모든 용어를 하나의 문자열로 합쳐 프롬프트에 제공
export function getGlossaryForPrompt(): string {
  const allEntries = [
    ...heavenlyStems,
    ...earthlyBranches,
    ...fiveElements,
    ...structuralTerms,
    ...tenGods,
    ...twelveStagess,
    ...specialStars,
    ...favorableElementTerms,
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
