export type SportGroup =
  | "Ball sports"
  | "Track & field"
  | "Combat"
  | "Water"
  | "Racquet"
  | "Precision & mind"
  | "Wheels & horse"
  | "Strength"
  | "Inclusive & institutional"
  | "Other";

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

/** The Ministry's sports and organisations directory (sports_structure.docx), then earlier entries awaiting review. */
export const SPORTS: Sport[] = [
  s("athletics", "Athletics", "Track & field", "Athletics Kenya", "running spike"),
  s("football", "Football", "Ball sports", "Football Kenya Federation", "football"),
  s("rugby", "Rugby union and sevens", "Ball sports", "Kenya Rugby Union/Rugby Football Union of Kenya", "rugby ball"),
  s("basketball", "Basketball", "Ball sports", "Kenya Basketball Federation", "basketball"),
  s("volleyball", "Volleyball", "Ball sports", "Kenya Volleyball Federation", "volleyball"),
  s("cricket", "Cricket", "Ball sports", "Cricket Kenya/Kenya Cricket Association", "cricket bat and ball"),
  s("swimming", "Aquatic sports", "Water", "Kenya Aquatics", "butterfly swimmer"),
  s("boxing", "Boxing", "Combat", "Boxing Federation of Kenya/Amateur Boxing Association of Kenya", "boxing glove"),
  s("handball", "Handball", "Ball sports", "Kenya Handball Federation", "match handball"),
  s("hockey", "Hockey", "Ball sports", "Kenya Hockey Union", "field hockey play"),
  s("netball", "Netball", "Ball sports", "Kenya Netball Association", "netball players at the hoop"),
  s("tennis", "Tennis", "Racquet", "Tennis Kenya/Kenya Lawn Tennis Association", "tennis ball"),
  s("badminton", "Badminton", "Racquet", "Badminton Kenya", "racket and shuttlecock"),
  s("table-tennis", "Table tennis", "Racquet", "Kenya Table Tennis Association", "table tennis bat"),
  s("squash", "Squash", "Racquet", "Kenya Squash Rackets Association", "squash racket and ball"),
  s("golf", "Golf", "Precision & mind", "Kenya Golf Union", "irons and golf ball"),
  s("cycling", "Cycling", "Wheels & horse", "National cycling organisation; verify current registered name", "road bicycle"),
  s("baseball", "Baseball", "Ball sports", "National baseball organisation; verify current registered name", "baseball bat and ball"),
  s("softball", "Softball", "Ball sports", "National softball organisation; verify current registered name", "softball and glove"),
  s("chess", "Chess", "Precision & mind", "Chess Kenya/Kenya Chess Association", "chess pieces"),
  s("wrestling", "Wrestling", "Combat", "National wrestling organisation; verify current registered name", "wrestling bout"),
  s("judo", "Judo", "Combat", "Kenya Judo Association", "judogi and black belt"),
  s("karate", "Karate", "Combat", "Karate-do Association of Kenya", "black belt"),
  s("taekwondo", "Taekwondo", "Combat", "Kenya Taekwondo Federation", "taekwondo kick"),
  s("weightlifting", "Weightlifting", "Strength", "National weightlifting organisation; verify current registered name", "barbell"),
  s("powerlifting", "Powerlifting", "Strength", "Verify whether governed separately or jointly with weightlifting", "powerlifting squat"),
  s("bodybuilding", "Bodybuilding and fitness", "Strength", "Kenya Bodybuilding and Fitness Federation", "bodybuilding stage"),
  s("darts", "Darts", "Precision & mind", "Kenya Darts Association", "dartboard"),
  s("pool", "Pool, billiards and snooker", "Precision & mind", "Kenya Pool Association; verify discipline structure", "billiard balls"),
  s("tug-of-war", "Tug of war", "Strength", "Kenya Tug of War Association", "tug of war rope"),
  s("equestrian", "Equestrian", "Wheels & horse", "Horse Association of Kenya/Kenya Equestrian Federation; verify current registered name", "show jumping"),
  s("canoeing", "Rowing and canoeing", "Water", "Kenya Rowing and Canoe Federation", "paddler"),
  s("sailing", "Sailing/yachting", "Water", "Kenya Yachting Federation; verify current registered name", "sailing yacht"),
  s("archery", "Archery", "Precision & mind", "National archery organisation; verify current registered name", "archer at the target"),
  s("gymnastics", "Gymnastics", "Strength", "Gymnastics Federation of Kenya", "gymnast"),
  s("triathlon", "Triathlon", "Track & field", "National triathlon organisation; verify current registered name", "triathlon race"),
  s("motorsport", "Motorsport", "Wheels & horse", "Motorsports Kenya Federation", "racing helmet"),
  s("american-football", "American football", "Ball sports", "Kenya Federation of American Football", "american football"),
  s("esports", "Esports", "Precision & mind", "Electronic Sports Kenya Federation", "esports tournament"),
  s("university-sport", "University sport", "Inclusive & institutional", "Kenya University Sports Federation", "university athletics"),
  s("deaf-sport", "Deaf sport", "Inclusive & institutional", "Kenya Sports Federation of the Deaf", "deaf athletes"),
  s("paralympic", "Paralympic sport", "Inclusive & institutional", "Kenya National Paralympic Committee and its affiliated organisations", "wheelchair athletes"),
  s("special-olympics", "Special Olympics", "Inclusive & institutional", "Special Olympics Kenya", "Special Olympics athletes"),
  s("other", "Other emerging and traditional sports", "Other", "Add through a Registrar-review process", "traditional game"),
  // From the earlier brief; not in the document, so they wait for Registrar review under "Other".
  s("water-polo", "Water polo", "Other", "Kenya Aquatics", "water polo ball"),
  s("fencing", "Fencing", "Other", "Kenya Fencing Federation", "fencing swords and mask"),
  s("surfing", "Surfing", "Other", "Kenya Surfing Federation", "big-wave surfer"),
  s("skateboarding", "Skateboarding", "Other", "Kenya Skateboarding Federation", "skateboard"),
  s("ice-sports", "Ice sports", "Other", "To be confirmed", "figure skates"),
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
  "Inclusive & institutional",
  "Other",
];
