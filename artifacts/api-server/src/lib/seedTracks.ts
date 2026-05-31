import { db, tracks } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const PHOTOS = [
  "photo-1493225457124-a3eb161ffa5f",
  "photo-1470225620780-dba8ba36b745",
  "photo-1514320291840-2e0a9bf2a9ae",
  "photo-1510915361894-db8b60106cb1",
  "photo-1516280440614-37939bbacd81",
  "photo-1505740420928-5e560c06d30e",
  "photo-1571330735066-03aaa9429d89",
  "photo-1501386761578-eac5c94b800a",
  "photo-1508700115892-45ecd05ae2ad",
  "photo-1507838153414-b4b713384a76",
  "photo-1458560871784-56d23406c091",
  "photo-1524650359799-842906ca1c06",
  "photo-1526218626217-dc65a29bb444",
  "photo-1519892300165-cb5542fb47c7",
  "photo-1527283232877-b8be30c8bdc5",
  "photo-1483412033650-1015ddeb83d1",
  "photo-1468164016374-6b30d13ea16b",
  "photo-1533174072545-7a4b6ad7a6c3",
  "photo-1459749411175-04bf5292ceea",
  "photo-1499364615650-ec38552f4f34",
];

const COLORS = [
  "#e85d4a","#3b82f6","#8b5cf6","#f59e0b","#10b981",
  "#6366f1","#ec4899","#14b8a6","#f97316","#0ea5e9",
];

const UNIVERSITIES = [
  "DePaul University","Northwestern University","Harvard University",
  "University of Michigan","UNC Chapel Hill","Georgia State University",
  "State University","City College","Music Academy","Arts University",
  "Technical Institute","Liberal Arts College",
];

function photo(i: number) {
  return `https://images.unsplash.com/${PHOTOS[i % PHOTOS.length]}?w=400&h=400&fit=crop&auto=format`;
}

function audio(i: number) {
  return `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 17) + 1}.mp3`;
}

const SEED_TRACKS = [
  // ── Original 10 ────────────────────────────────────────────────────────────
  { id:"t1",  title:"Golden Hour",        artist:"Campus Collective",   artistId:"a1",  genre:"Indie",      duration:"3:42", durationSeconds:222, coverColor:"#e85d4a", audioUrl:audio(0),  coverUrl:photo(0),  playCount:1420, university:"State University" },
  { id:"t2",  title:"Night Drive",        artist:"The Studio Band",     artistId:"a2",  genre:"Electronic", duration:"4:15", durationSeconds:255, coverColor:"#3b82f6", audioUrl:audio(1),  coverUrl:photo(1),  playCount:987,  university:"City College" },
  { id:"t3",  title:"Rooftop Sessions",   artist:"Jazz Ensemble",       artistId:"a3",  genre:"Jazz",       duration:"5:30", durationSeconds:330, coverColor:"#8b5cf6", audioUrl:audio(2),  coverUrl:photo(2),  playCount:2340, university:"Music Academy" },
  { id:"t4",  title:"Sunrise Acoustic",   artist:"Folk Collective",     artistId:"a4",  genre:"Folk",       duration:"3:18", durationSeconds:198, coverColor:"#f59e0b", audioUrl:audio(3),  coverUrl:photo(3),  playCount:765,  university:"Arts University" },
  { id:"t5",  title:"Campus Groove",      artist:"R&B Society",         artistId:"a5",  genre:"R&B",        duration:"3:55", durationSeconds:235, coverColor:"#10b981", audioUrl:audio(4),  coverUrl:photo(4),  playCount:1890, university:"State University" },
  { id:"t6",  title:"Late Night Study",   artist:"Lo-Fi Club",          artistId:"a6",  genre:"Lo-Fi",      duration:"4:02", durationSeconds:242, coverColor:"#6366f1", audioUrl:audio(5),  coverUrl:photo(5),  playCount:3210, university:"Technical Institute" },
  { id:"t7",  title:"Electric Bloom",     artist:"Synth Wave",          artistId:"a7",  genre:"Electronic", duration:"3:30", durationSeconds:210, coverColor:"#ec4899", audioUrl:audio(6),  coverUrl:photo(6),  playCount:654,  university:"City College" },
  { id:"t8",  title:"Open Mic Nights",    artist:"Singer Songwriters",  artistId:"a8",  genre:"Acoustic",   duration:"4:48", durationSeconds:288, coverColor:"#14b8a6", audioUrl:audio(7),  coverUrl:photo(7),  playCount:1102, university:"Liberal Arts College" },
  { id:"t9",  title:"Quad Sessions",      artist:"Hip Hop Collective",  artistId:"a9",  genre:"Hip Hop",    duration:"3:22", durationSeconds:202, coverColor:"#f97316", audioUrl:audio(8),  coverUrl:photo(8),  playCount:2780, university:"State University" },
  { id:"t10", title:"Finals Week",        artist:"Ambient Lab",         artistId:"a10", genre:"Ambient",    duration:"6:10", durationSeconds:370, coverColor:"#0ea5e9", audioUrl:audio(9),  coverUrl:photo(9),  playCount:4500, university:"Technical Institute" },
  // ── 11-20 ──────────────────────────────────────────────────────────────────
  { id:"t11", title:"Midnight Canvas",    artist:"Digital Arts Collective", artistId:"a1", genre:"Electronic", duration:"3:45", durationSeconds:225, coverColor:COLORS[1], audioUrl:audio(10), coverUrl:photo(10), playCount:622, university:UNIVERSITIES[0] },
  { id:"t12", title:"Quad Vibes",         artist:"The Hookups",            artistId:"a2", genre:"R&B",        duration:"3:28", durationSeconds:208, coverColor:COLORS[4], audioUrl:audio(11), coverUrl:photo(11), playCount:608, university:UNIVERSITIES[1] },
  { id:"t13", title:"Study Hall",         artist:"Caffeine Dreams",        artistId:"a3", genre:"Lo-Fi",      duration:"4:15", durationSeconds:255, coverColor:COLORS[5], audioUrl:audio(12), coverUrl:photo(12), playCount:594, university:UNIVERSITIES[2] },
  { id:"t14", title:"Garden Path",        artist:"Acoustic Society",       artistId:"a4", genre:"Acoustic",   duration:"3:52", durationSeconds:232, coverColor:COLORS[3], audioUrl:audio(13), coverUrl:photo(13), playCount:581, university:UNIVERSITIES[3] },
  { id:"t15", title:"Underground Pulse",  artist:"Bass Collective",        artistId:"a5", genre:"Electronic", duration:"2:58", durationSeconds:178, coverColor:COLORS[2], audioUrl:audio(14), coverUrl:photo(14), playCount:568, university:UNIVERSITIES[4] },
  { id:"t16", title:"Dorm Room Blues",    artist:"The Unpluggeds",         artistId:"a6", genre:"Indie",      duration:"4:33", durationSeconds:273, coverColor:COLORS[0], audioUrl:audio(15), coverUrl:photo(15), playCount:555, university:UNIVERSITIES[5] },
  { id:"t17", title:"Café au Lait",       artist:"Jazz Trio",              artistId:"a7", genre:"Jazz",       duration:"5:12", durationSeconds:312, coverColor:COLORS[1], audioUrl:audio(16), coverUrl:photo(16), playCount:542, university:UNIVERSITIES[6] },
  { id:"t18", title:"Street Cypher",      artist:"Mic Check",              artistId:"a8", genre:"Hip Hop",    duration:"3:05", durationSeconds:185, coverColor:COLORS[8], audioUrl:audio(0),  coverUrl:photo(17), playCount:530, university:UNIVERSITIES[7] },
  { id:"t19", title:"Fade Out",           artist:"Ambient Space",          artistId:"a9", genre:"Ambient",    duration:"6:20", durationSeconds:380, coverColor:COLORS[9], audioUrl:audio(1),  coverUrl:photo(18), playCount:517, university:UNIVERSITIES[8] },
  { id:"t20", title:"Mountain Echo",      artist:"Folk Revival",           artistId:"a10",genre:"Folk",       duration:"3:44", durationSeconds:224, coverColor:COLORS[3], audioUrl:audio(2),  coverUrl:photo(19), playCount:505, university:UNIVERSITIES[9] },
  // ── 21-30 ──────────────────────────────────────────────────────────────────
  { id:"t21", title:"Wavelength",         artist:"Electronic Dreams",      artistId:"a1", genre:"Electronic", duration:"4:02", durationSeconds:242, coverColor:COLORS[2], audioUrl:audio(3),  coverUrl:photo(0),  playCount:492, university:UNIVERSITIES[10] },
  { id:"t22", title:"Soul Kitchen",       artist:"R&B Collective",         artistId:"a2", genre:"R&B",        duration:"3:37", durationSeconds:217, coverColor:COLORS[4], audioUrl:audio(4),  coverUrl:photo(1),  playCount:479, university:UNIVERSITIES[11] },
  { id:"t23", title:"4am Thoughts",       artist:"Lofi Bedroom",           artistId:"a3", genre:"Lo-Fi",      duration:"3:55", durationSeconds:235, coverColor:COLORS[5], audioUrl:audio(5),  coverUrl:photo(2),  playCount:467, university:UNIVERSITIES[0] },
  { id:"t24", title:"Campfire Songs",     artist:"The Strummers",          artistId:"a4", genre:"Acoustic",   duration:"4:18", durationSeconds:258, coverColor:COLORS[3], audioUrl:audio(6),  coverUrl:photo(3),  playCount:454, university:UNIVERSITIES[1] },
  { id:"t25", title:"Neon Lights",        artist:"Synth Riders",           artistId:"a5", genre:"Electronic", duration:"3:20", durationSeconds:200, coverColor:COLORS[6], audioUrl:audio(7),  coverUrl:photo(4),  playCount:442, university:UNIVERSITIES[2] },
  { id:"t26", title:"Coffee Shop",        artist:"Indie Kids",             artistId:"a6", genre:"Indie",      duration:"3:48", durationSeconds:228, coverColor:COLORS[0], audioUrl:audio(8),  coverUrl:photo(5),  playCount:430, university:UNIVERSITIES[3] },
  { id:"t27", title:"Blue Note",          artist:"Campus Jazz",            artistId:"a7", genre:"Jazz",       duration:"4:55", durationSeconds:295, coverColor:COLORS[1], audioUrl:audio(9),  coverUrl:photo(6),  playCount:418, university:UNIVERSITIES[4] },
  { id:"t28", title:"Block Party",        artist:"Hip Hop Union",          artistId:"a8", genre:"Hip Hop",    duration:"2:55", durationSeconds:175, coverColor:COLORS[8], audioUrl:audio(10), coverUrl:photo(7),  playCount:406, university:UNIVERSITIES[5] },
  { id:"t29", title:"Rain Study",         artist:"Ambient Lab 2",          artistId:"a9", genre:"Ambient",    duration:"5:45", durationSeconds:345, coverColor:COLORS[9], audioUrl:audio(11), coverUrl:photo(8),  playCount:394, university:UNIVERSITIES[6] },
  { id:"t30", title:"Creek Side",         artist:"Acoustic Folk",          artistId:"a10",genre:"Folk",       duration:"3:12", durationSeconds:192, coverColor:COLORS[3], audioUrl:audio(12), coverUrl:photo(9),  playCount:382, university:UNIVERSITIES[7] },
  // ── 31-40 ──────────────────────────────────────────────────────────────────
  { id:"t31", title:"Pixel Dreams",       artist:"Glitch Artists",         artistId:"a1", genre:"Electronic", duration:"3:33", durationSeconds:213, coverColor:COLORS[2], audioUrl:audio(13), coverUrl:photo(10), playCount:370, university:UNIVERSITIES[8] },
  { id:"t32", title:"Groove Theory",      artist:"R&B House",              artistId:"a2", genre:"R&B",        duration:"4:05", durationSeconds:245, coverColor:COLORS[4], audioUrl:audio(14), coverUrl:photo(11), playCount:358, university:UNIVERSITIES[9] },
  { id:"t33", title:"Mellow Yellow",      artist:"Lo-Fi Lab",              artistId:"a3", genre:"Lo-Fi",      duration:"3:28", durationSeconds:208, coverColor:COLORS[5], audioUrl:audio(15), coverUrl:photo(12), playCount:347, university:UNIVERSITIES[10] },
  { id:"t34", title:"River Song",         artist:"Acoustic Minds",         artistId:"a4", genre:"Acoustic",   duration:"4:40", durationSeconds:280, coverColor:COLORS[3], audioUrl:audio(16), coverUrl:photo(13), playCount:336, university:UNIVERSITIES[11] },
  { id:"t35", title:"Stargate",           artist:"Space Synth",            artistId:"a5", genre:"Electronic", duration:"3:15", durationSeconds:195, coverColor:COLORS[6], audioUrl:audio(0),  coverUrl:photo(14), playCount:325, university:UNIVERSITIES[0] },
  { id:"t36", title:"Bedroom Pop",        artist:"Indie Dreams",           artistId:"a6", genre:"Indie",      duration:"3:50", durationSeconds:230, coverColor:COLORS[0], audioUrl:audio(1),  coverUrl:photo(15), playCount:314, university:UNIVERSITIES[1] },
  { id:"t37", title:"Miles Away",         artist:"Jazz Lab",               artistId:"a7", genre:"Jazz",       duration:"5:20", durationSeconds:320, coverColor:COLORS[1], audioUrl:audio(2),  coverUrl:photo(16), playCount:303, university:UNIVERSITIES[2] },
  { id:"t38", title:"Flow State",         artist:"Cypher Kings",           artistId:"a8", genre:"Hip Hop",    duration:"3:10", durationSeconds:190, coverColor:COLORS[8], audioUrl:audio(3),  coverUrl:photo(17), playCount:293, university:UNIVERSITIES[3] },
  { id:"t39", title:"Deep Space",         artist:"Cosmic Ambient",         artistId:"a9", genre:"Ambient",    duration:"7:00", durationSeconds:420, coverColor:COLORS[9], audioUrl:audio(4),  coverUrl:photo(18), playCount:283, university:UNIVERSITIES[4] },
  { id:"t40", title:"Autumn Leaves",      artist:"Folk Nation",            artistId:"a10",genre:"Folk",       duration:"3:35", durationSeconds:215, coverColor:COLORS[3], audioUrl:audio(5),  coverUrl:photo(19), playCount:273, university:UNIVERSITIES[5] },
  // ── 41-50 ──────────────────────────────────────────────────────────────────
  { id:"t41", title:"Digital Rain",       artist:"Electronic Waves",       artistId:"a1", genre:"Electronic", duration:"3:48", durationSeconds:228, coverColor:COLORS[1], audioUrl:audio(6),  coverUrl:photo(0),  playCount:264, university:UNIVERSITIES[6] },
  { id:"t42", title:"Soulful Morning",    artist:"The R&B Project",        artistId:"a2", genre:"R&B",        duration:"4:12", durationSeconds:252, coverColor:COLORS[4], audioUrl:audio(7),  coverUrl:photo(1),  playCount:255, university:UNIVERSITIES[7] },
  { id:"t43", title:"Night Owl",          artist:"Lo-Fi Life",             artistId:"a3", genre:"Lo-Fi",      duration:"4:22", durationSeconds:262, coverColor:COLORS[5], audioUrl:audio(8),  coverUrl:photo(2),  playCount:246, university:UNIVERSITIES[8] },
  { id:"t44", title:"Strings Attached",   artist:"Acoustic Roots",         artistId:"a4", genre:"Acoustic",   duration:"3:58", durationSeconds:238, coverColor:COLORS[3], audioUrl:audio(9),  coverUrl:photo(3),  playCount:237, university:UNIVERSITIES[9] },
  { id:"t45", title:"Cyber Punk",         artist:"Future Synth",           artistId:"a5", genre:"Electronic", duration:"2:45", durationSeconds:165, coverColor:COLORS[2], audioUrl:audio(10), coverUrl:photo(4),  playCount:228, university:UNIVERSITIES[10] },
  { id:"t46", title:"Coming Home",        artist:"Indie Hearts",           artistId:"a6", genre:"Indie",      duration:"4:05", durationSeconds:245, coverColor:COLORS[0], audioUrl:audio(11), coverUrl:photo(5),  playCount:220, university:UNIVERSITIES[11] },
  { id:"t47", title:"Bebop Revival",      artist:"Jazz Collective II",     artistId:"a7", genre:"Jazz",       duration:"5:40", durationSeconds:340, coverColor:COLORS[1], audioUrl:audio(12), coverUrl:photo(6),  playCount:212, university:UNIVERSITIES[0] },
  { id:"t48", title:"Campus Rap",         artist:"Student Spitters",       artistId:"a8", genre:"Hip Hop",    duration:"3:18", durationSeconds:198, coverColor:COLORS[8], audioUrl:audio(13), coverUrl:photo(7),  playCount:204, university:UNIVERSITIES[1] },
  { id:"t49", title:"Quiet Storm",        artist:"Atmospheric",            artistId:"a9", genre:"Ambient",    duration:"6:15", durationSeconds:375, coverColor:COLORS[9], audioUrl:audio(14), coverUrl:photo(8),  playCount:196, university:UNIVERSITIES[2] },
  { id:"t50", title:"Wanderer",           artist:"Folk Brothers",          artistId:"a10",genre:"Folk",       duration:"3:28", durationSeconds:208, coverColor:COLORS[3], audioUrl:audio(15), coverUrl:photo(9),  playCount:189, university:UNIVERSITIES[3] },
  // ── 51-60 ──────────────────────────────────────────────────────────────────
  { id:"t51", title:"Electro High",       artist:"Club Circuit",           artistId:"a1", genre:"Electronic", duration:"3:55", durationSeconds:235, coverColor:COLORS[6], audioUrl:audio(16), coverUrl:photo(10), playCount:182, university:UNIVERSITIES[4] },
  { id:"t52", title:"Late Night Feels",   artist:"Neo R&B",                artistId:"a2", genre:"R&B",        duration:"4:30", durationSeconds:270, coverColor:COLORS[4], audioUrl:audio(0),  coverUrl:photo(11), playCount:175, university:UNIVERSITIES[5] },
  { id:"t53", title:"Rain Check",         artist:"Mellow Beats",           artistId:"a3", genre:"Lo-Fi",      duration:"3:42", durationSeconds:222, coverColor:COLORS[5], audioUrl:audio(1),  coverUrl:photo(12), playCount:168, university:UNIVERSITIES[6] },
  { id:"t54", title:"Open Road",          artist:"Guitar Heroes",          artistId:"a4", genre:"Acoustic",   duration:"4:15", durationSeconds:255, coverColor:COLORS[3], audioUrl:audio(2),  coverUrl:photo(13), playCount:162, university:UNIVERSITIES[7] },
  { id:"t55", title:"Vapor Trail",        artist:"Synth Nation",           artistId:"a5", genre:"Electronic", duration:"3:05", durationSeconds:185, coverColor:COLORS[2], audioUrl:audio(3),  coverUrl:photo(14), playCount:156, university:UNIVERSITIES[8] },
  { id:"t56", title:"Velvet Underground", artist:"Alt Indie",              artistId:"a6", genre:"Indie",      duration:"4:20", durationSeconds:260, coverColor:COLORS[0], audioUrl:audio(4),  coverUrl:photo(15), playCount:150, university:UNIVERSITIES[9] },
  { id:"t57", title:"Smooth Criminal",    artist:"Jazz Mafia",             artistId:"a7", genre:"Jazz",       duration:"4:55", durationSeconds:295, coverColor:COLORS[1], audioUrl:audio(5),  coverUrl:photo(16), playCount:144, university:UNIVERSITIES[10] },
  { id:"t58", title:"Bars & Beats",       artist:"Hip Hop Lab",            artistId:"a8", genre:"Hip Hop",    duration:"3:25", durationSeconds:205, coverColor:COLORS[8], audioUrl:audio(6),  coverUrl:photo(17), playCount:138, university:UNIVERSITIES[11] },
  { id:"t59", title:"Ocean Waves",        artist:"Zen Ambient",            artistId:"a9", genre:"Ambient",    duration:"5:30", durationSeconds:330, coverColor:COLORS[9], audioUrl:audio(7),  coverUrl:photo(18), playCount:133, university:UNIVERSITIES[0] },
  { id:"t60", title:"Trail Mix",          artist:"Folk Society",           artistId:"a10",genre:"Folk",       duration:"3:10", durationSeconds:190, coverColor:COLORS[3], audioUrl:audio(8),  coverUrl:photo(19), playCount:128, university:UNIVERSITIES[1] },
  // ── 61-70 ──────────────────────────────────────────────────────────────────
  { id:"t61", title:"Bounce Back",        artist:"EDM Class",              artistId:"a1", genre:"Electronic", duration:"3:40", durationSeconds:220, coverColor:COLORS[2], audioUrl:audio(9),  coverUrl:photo(0),  playCount:123, university:UNIVERSITIES[2] },
  { id:"t62", title:"Serenade",           artist:"Smooth R&B",             artistId:"a2", genre:"R&B",        duration:"4:08", durationSeconds:248, coverColor:COLORS[4], audioUrl:audio(10), coverUrl:photo(1),  playCount:118, university:UNIVERSITIES[3] },
  { id:"t63", title:"Slowed Down",        artist:"Chill Zone",             artistId:"a3", genre:"Lo-Fi",      duration:"3:55", durationSeconds:235, coverColor:COLORS[5], audioUrl:audio(11), coverUrl:photo(2),  playCount:114, university:UNIVERSITIES[4] },
  { id:"t64", title:"Porch Music",        artist:"Country Acoustic",       artistId:"a4", genre:"Acoustic",   duration:"3:45", durationSeconds:225, coverColor:COLORS[3], audioUrl:audio(12), coverUrl:photo(3),  playCount:110, university:UNIVERSITIES[5] },
  { id:"t65", title:"Neon Genesis",       artist:"Synthwave Club",         artistId:"a5", genre:"Electronic", duration:"3:15", durationSeconds:195, coverColor:COLORS[6], audioUrl:audio(13), coverUrl:photo(4),  playCount:106, university:UNIVERSITIES[6] },
  { id:"t66", title:"Daydreamer",         artist:"Indie Pop Stars",        artistId:"a6", genre:"Indie",      duration:"4:10", durationSeconds:250, coverColor:COLORS[0], audioUrl:audio(14), coverUrl:photo(5),  playCount:102, university:UNIVERSITIES[7] },
  { id:"t67", title:"After Hours",        artist:"Late Jazz",              artistId:"a7", genre:"Jazz",       duration:"6:00", durationSeconds:360, coverColor:COLORS[1], audioUrl:audio(15), coverUrl:photo(6),  playCount:98,  university:UNIVERSITIES[8] },
  { id:"t68", title:"Hustle Season",      artist:"Campus Rap II",          artistId:"a8", genre:"Hip Hop",    duration:"3:30", durationSeconds:210, coverColor:COLORS[8], audioUrl:audio(16), coverUrl:photo(7),  playCount:94,  university:UNIVERSITIES[9] },
  { id:"t69", title:"Weightless",         artist:"Drone Ambient",          artistId:"a9", genre:"Ambient",    duration:"8:20", durationSeconds:500, coverColor:COLORS[9], audioUrl:audio(0),  coverUrl:photo(8),  playCount:91,  university:UNIVERSITIES[10] },
  { id:"t70", title:"Wildflowers",        artist:"Folk Haven",             artistId:"a10",genre:"Folk",       duration:"3:22", durationSeconds:202, coverColor:COLORS[3], audioUrl:audio(1),  coverUrl:photo(9),  playCount:88,  university:UNIVERSITIES[11] },
  // ── 71-80 ──────────────────────────────────────────────────────────────────
  { id:"t71", title:"Frequency",          artist:"Bass Lab",               artistId:"a1", genre:"Electronic", duration:"3:50", durationSeconds:230, coverColor:COLORS[2], audioUrl:audio(2),  coverUrl:photo(10), playCount:85,  university:UNIVERSITIES[0] },
  { id:"t72", title:"Slow Jam",           artist:"R&B Underground",        artistId:"a2", genre:"R&B",        duration:"4:35", durationSeconds:275, coverColor:COLORS[4], audioUrl:audio(3),  coverUrl:photo(11), playCount:82,  university:UNIVERSITIES[1] },
  { id:"t73", title:"Sunday Morning",     artist:"Lo-Fi Collective",       artistId:"a3", genre:"Lo-Fi",      duration:"4:02", durationSeconds:242, coverColor:COLORS[5], audioUrl:audio(4),  coverUrl:photo(12), playCount:79,  university:UNIVERSITIES[2] },
  { id:"t74", title:"Fingerpicking",      artist:"Solo Acoustic",          artistId:"a4", genre:"Acoustic",   duration:"3:28", durationSeconds:208, coverColor:COLORS[3], audioUrl:audio(5),  coverUrl:photo(13), playCount:77,  university:UNIVERSITIES[3] },
  { id:"t75", title:"Club Zero",          artist:"Techno Underground",     artistId:"a5", genre:"Electronic", duration:"4:15", durationSeconds:255, coverColor:COLORS[1], audioUrl:audio(6),  coverUrl:photo(14), playCount:75,  university:UNIVERSITIES[4] },
  { id:"t76", title:"Flower Power",       artist:"Indie Revival",          artistId:"a6", genre:"Indie",      duration:"3:55", durationSeconds:235, coverColor:COLORS[0], audioUrl:audio(7),  coverUrl:photo(15), playCount:73,  university:UNIVERSITIES[5] },
  { id:"t77", title:"Uptown Jazz",        artist:"New School Jazz",        artistId:"a7", genre:"Jazz",       duration:"5:15", durationSeconds:315, coverColor:COLORS[2], audioUrl:audio(8),  coverUrl:photo(16), playCount:71,  university:UNIVERSITIES[6] },
  { id:"t78", title:"Anthem",             artist:"Hip Hop United",         artistId:"a8", genre:"Hip Hop",    duration:"3:42", durationSeconds:222, coverColor:COLORS[8], audioUrl:audio(9),  coverUrl:photo(17), playCount:69,  university:UNIVERSITIES[7] },
  { id:"t79", title:"Still Life",         artist:"Ambient Garden",         artistId:"a9", genre:"Ambient",    duration:"5:50", durationSeconds:350, coverColor:COLORS[9], audioUrl:audio(10), coverUrl:photo(18), playCount:67,  university:UNIVERSITIES[8] },
  { id:"t80", title:"Appalachian",        artist:"Bluegrass Squad",        artistId:"a10",genre:"Folk",       duration:"2:58", durationSeconds:178, coverColor:COLORS[3], audioUrl:audio(11), coverUrl:photo(19), playCount:65,  university:UNIVERSITIES[9] },
  // ── 81-90 ──────────────────────────────────────────────────────────────────
  { id:"t81", title:"Modular Mind",       artist:"Modular Synth",          artistId:"a1", genre:"Electronic", duration:"4:25", durationSeconds:265, coverColor:COLORS[6], audioUrl:audio(12), coverUrl:photo(0),  playCount:63,  university:UNIVERSITIES[10] },
  { id:"t82", title:"After Rain",         artist:"Neo Soul",               artistId:"a2", genre:"R&B",        duration:"4:18", durationSeconds:258, coverColor:COLORS[4], audioUrl:audio(13), coverUrl:photo(1),  playCount:61,  university:UNIVERSITIES[11] },
  { id:"t83", title:"Tape Hiss",          artist:"Vintage Lo-Fi",          artistId:"a3", genre:"Lo-Fi",      duration:"3:35", durationSeconds:215, coverColor:COLORS[5], audioUrl:audio(14), coverUrl:photo(2),  playCount:59,  university:UNIVERSITIES[0] },
  { id:"t84", title:"Campfire",           artist:"Unplugged Crew",         artistId:"a4", genre:"Acoustic",   duration:"4:50", durationSeconds:290, coverColor:COLORS[3], audioUrl:audio(15), coverUrl:photo(3),  playCount:57,  university:UNIVERSITIES[1] },
  { id:"t85", title:"Megacity",           artist:"Future Electric",        artistId:"a5", genre:"Electronic", duration:"3:08", durationSeconds:188, coverColor:COLORS[2], audioUrl:audio(16), coverUrl:photo(4),  playCount:56,  university:UNIVERSITIES[2] },
  { id:"t86", title:"Evergreen",          artist:"Indie Forest",           artistId:"a6", genre:"Indie",      duration:"4:00", durationSeconds:240, coverColor:COLORS[0], audioUrl:audio(0),  coverUrl:photo(5),  playCount:54,  university:UNIVERSITIES[3] },
  { id:"t87", title:"The Real Jazz",      artist:"Pure Jazz",              artistId:"a7", genre:"Jazz",       duration:"6:30", durationSeconds:390, coverColor:COLORS[1], audioUrl:audio(1),  coverUrl:photo(6),  playCount:52,  university:UNIVERSITIES[4] },
  { id:"t88", title:"Scholars Flow",      artist:"Academic Rap",           artistId:"a8", genre:"Hip Hop",    duration:"3:15", durationSeconds:195, coverColor:COLORS[8], audioUrl:audio(2),  coverUrl:photo(7),  playCount:51,  university:UNIVERSITIES[5] },
  { id:"t89", title:"Suspend",            artist:"Drone Lab",              artistId:"a9", genre:"Ambient",    duration:"9:10", durationSeconds:550, coverColor:COLORS[9], audioUrl:audio(3),  coverUrl:photo(8),  playCount:49,  university:UNIVERSITIES[6] },
  { id:"t90", title:"Old Oak",            artist:"Folk Roots",             artistId:"a10",genre:"Folk",       duration:"3:40", durationSeconds:220, coverColor:COLORS[3], audioUrl:audio(4),  coverUrl:photo(9),  playCount:48,  university:UNIVERSITIES[7] },
  // ── 91-100 ─────────────────────────────────────────────────────────────────
  { id:"t91", title:"Spectrum",           artist:"Spectrum DJs",           artistId:"a1", genre:"Electronic", duration:"3:52", durationSeconds:232, coverColor:COLORS[6], audioUrl:audio(5),  coverUrl:photo(10), playCount:47,  university:UNIVERSITIES[8] },
  { id:"t92", title:"Velvet Night",       artist:"R&B Dreamers",           artistId:"a2", genre:"R&B",        duration:"4:22", durationSeconds:262, coverColor:COLORS[4], audioUrl:audio(6),  coverUrl:photo(11), playCount:46,  university:UNIVERSITIES[9] },
  { id:"t93", title:"Dust & Dreams",      artist:"Retro Lo-Fi",            artistId:"a3", genre:"Lo-Fi",      duration:"3:48", durationSeconds:228, coverColor:COLORS[5], audioUrl:audio(7),  coverUrl:photo(12), playCount:45,  university:UNIVERSITIES[10] },
  { id:"t94", title:"Evening Song",       artist:"Porch Sessions",         artistId:"a4", genre:"Acoustic",   duration:"3:15", durationSeconds:195, coverColor:COLORS[3], audioUrl:audio(8),  coverUrl:photo(13), playCount:44,  university:UNIVERSITIES[11] },
  { id:"t95", title:"Laser Grid",         artist:"Electro Class",          artistId:"a5", genre:"Electronic", duration:"2:55", durationSeconds:175, coverColor:COLORS[2], audioUrl:audio(9),  coverUrl:photo(14), playCount:43,  university:UNIVERSITIES[0] },
  { id:"t96", title:"Wonder Years",       artist:"Coming of Age",          artistId:"a6", genre:"Indie",      duration:"4:45", durationSeconds:285, coverColor:COLORS[0], audioUrl:audio(10), coverUrl:photo(15), playCount:42,  university:UNIVERSITIES[1] },
  { id:"t97", title:"Classic Mode",       artist:"Jazz Standards",         artistId:"a7", genre:"Jazz",       duration:"5:05", durationSeconds:305, coverColor:COLORS[1], audioUrl:audio(11), coverUrl:photo(16), playCount:41,  university:UNIVERSITIES[2] },
  { id:"t98", title:"Verse Chorus",       artist:"Rap Theory",             artistId:"a8", genre:"Hip Hop",    duration:"3:20", durationSeconds:200, coverColor:COLORS[8], audioUrl:audio(12), coverUrl:photo(17), playCount:40,  university:UNIVERSITIES[3] },
  { id:"t99", title:"Endless Sky",        artist:"Space Ambient",          artistId:"a9", genre:"Ambient",    duration:"7:45", durationSeconds:465, coverColor:COLORS[9], audioUrl:audio(13), coverUrl:photo(18), playCount:39,  university:UNIVERSITIES[4] },
  { id:"t100",title:"Last Call",          artist:"Final Act",              artistId:"a10",genre:"Folk",       duration:"3:55", durationSeconds:235, coverColor:COLORS[3], audioUrl:audio(14), coverUrl:photo(19), playCount:38,  university:UNIVERSITIES[5] },
];

export async function seedTracks(): Promise<void> {
  const existing = await db.select({ id: tracks.id }).from(tracks);
  const existingIds = new Set(existing.map((r) => r.id));
  const missing = SEED_TRACKS.filter((t) => !existingIds.has(t.id));

  if (missing.length === 0) {
    logger.info("Tracks already fully seeded, skipping");
    return;
  }

  await db.insert(tracks).values(missing).onConflictDoNothing();
  logger.info({ count: missing.length }, "Seeded missing tracks into database");
}
