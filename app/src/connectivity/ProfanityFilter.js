/**
 * Simple profanity filter for 3-character student initials.
 * The space of 3-letter combos is small, so a blocklist is practical.
 */

const BLOCKED = new Set([
  'ASS', 'FUK', 'FUC', 'FCK', 'FKU', 'WTF', 'STF', 'SHT',
  'DIK', 'DCK', 'DIC', 'KKK', 'NIG', 'NGR', 'FAG', 'FGT',
  'CUM', 'TIT', 'COK', 'CNT', 'CNT', 'GAY', 'SEX', 'XXX',
  'PUS', 'HOR', 'SLT', 'SUK', 'SUC', 'NUT', 'JIZ', 'WET',
  'HOE', 'BJ\u0000', 'FKD', 'POO', 'PEE', 'TWT', 'VAG',
  'ANU', 'BUM', 'COC', 'DIE', 'DMN', 'FK\u0000', 'GOD',
  'HEL', 'JEW', 'KIL', 'LSD', 'POT', 'RAP', 'RIM',
]);

export class ProfanityFilter {
  /**
   * Check if 3-character initials are blocked.
   * @param {string} initials - exactly 3 characters
   * @returns {boolean} true if blocked
   */
  static isBlocked(initials) {
    if (!initials || initials.length !== 3) return false;
    return BLOCKED.has(initials.toUpperCase().trim());
  }
}
