export type SportGroup =
  | "Ball sports"
  | "Track & field"
  | "Combat"
  | "Water"
  | "Racquet"
  | "Precision & mind"
  | "Wheels & horse"
  | "Strength";

export interface Sport {
  id: string;
  name: string;
  group: SportGroup;
  /** Governing body, as listed in the Ministry prototype brief. */
  federation: string;
  /** Photograph of the sport's equipment or play (Wikimedia Commons, see photo-credits.ts). */
  image: string;
  /** What the picture shows, for alt text. */
  item: string;
}

const s = (
  id: string,
  name: string,
  group: SportGroup,
  federation: string,
  item: string,
): Sport => ({ id, name, group, federation, item, image: `/sports/${id}.jpg` });

export const SPORTS: Sport[] = [
  s("football", "Football", "Ball sports", "Football Kenya Federation (FKF)", "football"),
  s("athletics", "Athletics", "Track & field", "Athletics Kenya", "running spike"),
  s("rugby", "Rugby", "Ball sports", "Kenya Rugby Union (KRU)", "rugby ball"),
  s("basketball", "Basketball", "Ball sports", "Kenya Basketball Federation", "basketball"),
  s("volleyball", "Volleyball", "Ball sports", "Kenya Volleyball Federation", "volleyball"),
  s("netball", "Netball", "Ball sports", "Kenya Netball Federation", "netball players at the hoop"),
  s("handball", "Handball", "Ball sports", "Kenya Handball Federation", "match handball"),
  s("hockey", "Hockey", "Ball sports", "Kenya Hockey Union", "field hockey play"),
  s("cricket", "Cricket", "Ball sports", "Cricket Kenya", "cricket bat and ball"),
  s("tennis", "Tennis", "Racquet", "Kenya Tennis Federation", "tennis ball"),
  s("table-tennis", "Table Tennis", "Racquet", "Kenya Table Tennis Association", "table tennis bat"),
  s("badminton", "Badminton", "Racquet", "Badminton Kenya", "racket and shuttlecock"),
  s("boxing", "Boxing", "Combat", "Boxing Federation of Kenya", "boxing glove"),
  s("judo", "Judo", "Combat", "Kenya Judo Federation", "judogi and black belt"),
  s("karate", "Karate", "Combat", "Kenya Karate Federation", "black belt"),
  s("wrestling", "Wrestling", "Combat", "Kenya Wrestling Federation", "wrestling bout"),
  s("fencing", "Fencing", "Combat", "Kenya Fencing Federation", "fencing swords and mask"),
  s("swimming", "Swimming", "Water", "Kenya Aquatics", "butterfly swimmer"),
  s("water-polo", "Water Polo", "Water", "Kenya Aquatics", "water polo ball"),
  s("canoeing", "Canoeing", "Water", "Kenya Canoe Federation", "paddler"),
  s("surfing", "Surfing", "Water", "Kenya Surfing Federation", "big-wave surfer"),
  s("cycling", "Cycling", "Wheels & horse", "Cycling Kenya", "road bicycle"),
  s("motorsport", "Motorsport", "Wheels & horse", "Motorsport Federation of Kenya", "racing helmet"),
  s("equestrian", "Equestrian", "Wheels & horse", "Kenya Equestrian Federation", "show jumping"),
  s("skateboarding", "Skateboarding", "Wheels & horse", "Kenya Skateboarding Federation", "skateboard"),
  s("archery", "Archery", "Precision & mind", "Kenya Archery Association", "archer at the target"),
  s("golf", "Golf", "Precision & mind", "Kenya Golf Union", "irons and golf ball"),
  s("darts", "Darts", "Precision & mind", "Kenya Darts Federation", "dartboard"),
  s("chess", "Chess", "Precision & mind", "Chess Kenya", "chess pieces"),
  s("weightlifting", "Weightlifting", "Strength", "Kenya Weightlifting Federation", "barbell"),
  s("ice-sports", "Ice Sports", "Strength", "To be confirmed", "figure skates"),
];

export const SPORT_BY_ID: Record<string, Sport> = Object.fromEntries(
  SPORTS.map((x) => [x.id, x]),
);

/** The twelve disciplines shown in the strip under the hero, in the Ministry mockup order. */
export const STRIP_SPORT_IDS = [
  "football",
  "athletics",
  "rugby",
  "basketball",
  "volleyball",
  "tennis",
  "boxing",
  "swimming",
  "hockey",
  "cricket",
  "netball",
  "cycling",
];

export const SPORT_GROUPS: SportGroup[] = [
  "Ball sports",
  "Track & field",
  "Racquet",
  "Combat",
  "Water",
  "Wheels & horse",
  "Precision & mind",
  "Strength",
];
