/**
 * Strict Content Filter for Student-Teacher Safety & Politeness
 * Covers:
 * - English profanities, slurs, sexual harassment keywords
 * - Tamil slurs & abusive words (both Unicode script and Romanized/Tanglish)
 * - Sinhala slurs & abusive words
 * - Romantic/sexual/hug/kiss emojis (strictly blocked)
 * - Pre-enrollment inquiry validation (only class/subject/grade/time/type inquiries permitted)
 */

// Disallowed Emojis: kisses, hugs, hearts, romantic expressions
export const BLOCKED_EMOJIS = [
  '🤗', '🤭', '😘', '😍', '❤️', '💓', '💕', '💖', '💗', '💘',
  '💙', '💚', '💛', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💞',
  '💟', '🥰', '😻', '😽', '💋', '💌', '💏', '💑', '👩‍❤️‍👨', '👨‍❤️‍👨',
  '👩‍❤️‍👩', '👩‍❤️‍💋‍👨', '👨‍❤️‍💋‍👨', '👩‍❤️‍💋‍👩', '🫂', '🫦', '🏩', '🌹'
];

// Regex matching any blocked emojis
const BLOCKED_EMOJI_REGEX = new RegExp(
  BLOCKED_EMOJIS.map(e => e.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'),
  'gu'
);

// Comprehensive list of abusive/vulgar words
// English, Tamil (Tanglish & Tamil script), Sinhala
export const ABUSIVE_WORDS: string[] = [
  // English Profanities & Vulgarities
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy',
  'cock', 'motherfucker', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'blowjob',
  'boobs', 'tits', 'vagina', 'penis', 'porn', 'sex', 'sexy', 'nude', 'nudes', 'naked', 'dildo',
  'masturbat', 'horny', 'slutty', 'rapist', 'rape', 'ass', 'idiot', 'stupid', 'dumbass',

  // Tamil Abusive Words (Romanized / Tanglish)
  'punda', 'pundai', 'punndai', 'poondai', 'thevidiya', 'thevidya', 'thevadiya', 'thevudya',
  'koothi', 'kuthi', 'koothie', 'poolu', 'pool', 'sunni', 'chunni', 'ommale', 'ommala',
  'otha', 'othan', 'kenapunda', 'kenapundai', 'lavada', 'lavade', 'kalla', 'baadu', 'badu',
  'naaye', 'naai', 'paradesi', 'porukki', 'veshi', 'kallaolzhunganam', 'oombu', 'oomba',
  'soothu', 'sothu', 'moodhevi', 'savu', 'karumandiram', 'eruma', 'echakala', 'lavada ke baal',
  'pombala', 'aambala', 'thevadiya paiya', 'poolu sappu', 'sunni sappu',

  // Tamil Abusive Words (Tamil Script)
  'புண்ட', 'புண்டை', 'தேவிடியா', 'தேவடியா', 'கூதி', 'பூலு', 'சுன்னி', 'ஓத்தா',
  'கெணப்புண்டை', 'பொறுக்கி', 'ஊம்பு', 'சூத்து', 'மூதேவி', 'நாயே', 'வேசி',

  // Sinhala Abusive Words (Romanized & Sinhala Script)
  'huththa', 'hukapan', 'pakaya', 'ponnaya', 'kariya', 'balla', 'walaththaya', 'vesi',
  'හුත්ත', 'හුකපන්', 'පකයා', 'පොන්නයා', 'කැරියා', 'බල්ලා'
];

/**
 * Normalizes text for filter check: converts leetspeak, collapses repeated chars, strips punctuation
 */
export function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  // Leetspeak substitutions
  normalized = normalized
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[5]/g, 's')
    .replace(/[+]/g, 't');

  // Collapse repeated characters (e.g. "puuundaaa" -> "punda")
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

  return normalized;
}

export interface ContentFilterResult {
  isClean: boolean;
  blockedEmojisFound: string[];
  abusiveWordsFound: string[];
  sanitizedText: string;
}

/**
 * Detects abusive wording and disallowed romantic/hug/kiss emojis
 */
export function filterContent(text: string): ContentFilterResult {
  const blockedEmojisFound: string[] = [];
  const abusiveWordsFound: string[] = [];

  // Check blocked emojis
  const emojiMatches = text.match(BLOCKED_EMOJI_REGEX);
  if (emojiMatches) {
    blockedEmojisFound.push(...Array.from(new Set(emojiMatches)));
  }

  // Check abusive words in normalized and original text
  const normalized = normalizeText(text);
  const wordsInText = normalized.split(/[\s\-_,.:;!?'"()\[\]{}<>\/\\]+/);

  for (const badWord of ABUSIVE_WORDS) {
    const lowerBadWord = badWord.toLowerCase();

    // Check exact word token match
    if (wordsInText.includes(lowerBadWord)) {
      abusiveWordsFound.push(badWord);
      continue;
    }

    // Check substring match for length >= 4 (avoid accidental short matches)
    if (lowerBadWord.length >= 4 && normalized.includes(lowerBadWord)) {
      abusiveWordsFound.push(badWord);
    }
  }

  // Create sanitized text replacing blocked emojis and abusive words with asterisks
  let sanitized = text.replace(BLOCKED_EMOJI_REGEX, '⚠️[Emoji blocked]');
  for (const badWord of abusiveWordsFound) {
    const reg = new RegExp(badWord, 'gi');
    sanitized = sanitized.replace(reg, '****');
  }

  return {
    isClean: blockedEmojisFound.length === 0 && abusiveWordsFound.length === 0,
    blockedEmojisFound: Array.from(new Set(blockedEmojisFound)),
    abusiveWordsFound: Array.from(new Set(abusiveWordsFound)),
    sanitizedText: sanitized
  };
}

/**
 * Allowed topic keywords for Pre-Enrollment inquiries:
 * Students who have not joined the class yet are ONLY allowed to inquire about:
 * - Subjects / Courses
 * - Grade / Class level
 * - Class type (Online / Onsite / Physical)
 * - Class times / Schedule / Fees
 */
const PRE_ENROLLMENT_KEYWORDS: string[] = [
  'subject', 'course', 'module', 'syllabus', 'grade', 'class', 'standard', 'level',
  'online', 'onsite', 'physical', 'zoom', 'time', 'timing', 'schedule', 'day', 'days',
  'fee', 'fees', 'cost', 'admission', 'join', 'enroll', 'start', 'when', 'where',
  // Tamil keywords
  'பாடம்', 'பாடங்கள்', 'தரம்', 'வகுப்பு', 'நேரம்', 'கட்டணம்', 'ஆன்லைன்', 'நேரடி'
];

/**
 * Validates whether a pre-enrollment message is strictly about class inquiries
 */
export function isPreEnrollmentTopicAllowed(text: string): { isAllowed: boolean; reason?: string } {
  const lower = text.toLowerCase();

  // If text is very short and polite greeting like "hello teacher" or "vanakkam", allow
  const politeGreetings = ['hello', 'hi', 'good morning', 'good evening', 'good afternoon', 'vanakkam', 'ayubowan', 'sir', 'teacher', 'madam'];
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && words.every(w => politeGreetings.some(g => g.includes(w)))) {
    return { isAllowed: true };
  }

  // Check if at least one class inquiry keyword is present
  const hasInquiryKeyword = PRE_ENROLLMENT_KEYWORDS.some(k => lower.includes(k));

  if (!hasInquiryKeyword) {
    return {
      isAllowed: false,
      reason: 'Before joining the class, messages must be strictly about course details, subjects, grades, class times, or online/onsite options.'
    };
  }

  return { isAllowed: true };
}

/**
 * Pre-defined inquiry templates that can be used directly or suggested to students
 */
export const PRE_ENROLLMENT_TEMPLATES = [
  { id: 'subject_inquiry', label: 'Ask about subjects & syllabus', text: 'Hello Teacher, which subjects and syllabus do you cover in your classes?' },
  { id: 'grade_inquiry', label: 'Ask about grade / levels', text: 'Hello Teacher, which grades and class levels is this course suitable for?' },
  { id: 'schedule_inquiry', label: 'Ask about class times & days', text: 'Hello Teacher, what are the days and timings for your upcoming classes?' },
  { id: 'format_inquiry', label: 'Ask if online or onsite', text: 'Hello Teacher, are your classes conducted online, onsite, or hybrid?' },
  { id: 'fee_inquiry', label: 'Ask about course fees & enrollment', text: 'Hello Teacher, what is the fee structure and how do I enroll in your class?' }
];
