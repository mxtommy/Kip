/**
 * The four best VMGs the signalk-racer plugin publishes, and how they are named and
 * ordered in the widgets that show them. Kept apart from any drawing so a widget can use
 * the names without pulling in a visualisation.
 */
export const VMG_NAMES = ['toCourseSide', 'toPortEnd', 'toStbEnd', 'fromCourseSide'] as const;
export type TVmgName = typeof VMG_NAMES[number];

/** Where each VMG sits when the four are laid out to match the line drawing. */
export const VMG_ARROW: Record<TVmgName, string> = {
  toCourseSide: '↑',
  toPortEnd: '←',
  toStbEnd: '→',
  fromCourseSide: '↓'
};

export const VMG_TITLE: Record<TVmgName, string> = {
  toCourseSide: 'Best VMG across the line towards the course side',
  toPortEnd: 'Best VMG along the line towards the port end (pin)',
  toStbEnd: 'Best VMG along the line towards the starboard end (committee boat)',
  fromCourseSide: 'Best VMG back across the line from the course side, used when OCS'
};

/** No VMGs known yet, for seeding a record of them. */
export const NO_VMG: Record<TVmgName, number | null> =
  { toCourseSide: null, toPortEnd: null, toStbEnd: null, fromCourseSide: null };
