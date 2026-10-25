// Home-page hero slides: photographs from Wikimedia Commons (credited on /credits).
export interface HeroSlide {
  sport: string; // sport id; also the federation page slug
  label: string;
  headline: string;
  line: string;
  image: string;
  position: string; // CSS object-position
  credit: { author: string; license: string; page: string };
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    sport: "football", label: "Football", headline: "Every club. Every pitch. One register.",
    line: "From national stadiums to village grounds, register clubs and players under their federation.",
    image: "/hero/football.jpg", position: "50% 60%",
    credit: { author: "Lebu Ayiga", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Spectator_view_of_CHAN_match_between_Kenya_and_DRC.jpg" },
  },
  {
    sport: "athletics", label: "Athletics", headline: "Home of champions, on the record.",
    line: "Athletes, coaches and clubs across the counties, endorsed by Athletics Kenya and verified by the Registrar.",
    image: "/hero/athletics.jpg", position: "50% 55%",
    credit: { author: "Nick Webb", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:2012_Summer_Olympics_%E2%80%93_Womens_5000_metres_heat_1_-_1.jpg" },
  },
  {
    sport: "rugby", label: "Rugby", headline: "From school fields to the Sevens circuit.",
    line: "Unions, county branches and clubs, all in one verified national directory.",
    image: "/hero/rugby.jpg", position: "50% 55%",
    credit: { author: "Jwahome", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:Top_Fry_Nakuru_RFC.jpg" },
  },
  {
    sport: "cricket", label: "Cricket", headline: "Recognised, registered, ready to play.",
    line: "Kenya's cricket community, linked to its governing body and its county associations.",
    image: "/hero/cricket.jpg", position: "50% 55%",
    credit: { author: "Amuzujoe", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:2023_African_Games_01_cricket_123.jpg" },
  },
  {
    sport: "swimming", label: "Swimming", headline: "Lanes, coaches and talent, verified.",
    line: "Clubs, academies and facilities that keep Kenya's swimmers competing safely.",
    image: "/hero/swimming.jpg", position: "50% 70%",
    credit: { author: "Shifa.valyani", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:The_perfect_dive.jpg" },
  },
  {
    sport: "volleyball", label: "Volleyball", headline: "Courts full of talent, county by county.",
    line: "National federation, county branches and clubs, connected from the Ministry down to the ward.",
    image: "/hero/volleyball.jpg", position: "50% 50%",
    credit: { author: "Owula kpakpo", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:AG_23_Indoor_Volleyball_34.jpg" },
  },
];
