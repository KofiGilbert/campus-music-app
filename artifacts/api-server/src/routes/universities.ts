import { Router, type IRouter } from "express";
import { db, tracks, artists } from "@workspace/db";

const router: IRouter = Router();

const WELL_KNOWN = [
  "MIT", "Stanford University", "Harvard University", "UC Berkeley", "NYU",
  "Columbia University", "UCLA", "University of Michigan", "UT Austin",
  "Northwestern University", "Duke University", "Vanderbilt University",
  "Georgetown University", "BU", "Northeastern University",
];

async function getAllUniversities(): Promise<string[]> {
  const [allTracks, allArtists] = await Promise.all([
    db.select({ university: tracks.university }).from(tracks),
    db.select({ university: artists.university }).from(artists),
  ]);
  const fromData = new Set<string>();
  allTracks.forEach((t) => { if (t.university) fromData.add(t.university); });
  allArtists.forEach((a) => { if (a.university) fromData.add(a.university); });
  return [...new Set([...WELL_KNOWN, ...fromData])].sort();
}

router.get("/universities", async (_req, res): Promise<void> => {
  res.json(await getAllUniversities());
});

router.get("/universities/search", async (req, res): Promise<void> => {
  const name = typeof req.query.name === "string" ? req.query.name.toLowerCase().trim() : "";
  const all = await getAllUniversities();
  const results = name ? all.filter((u) => u.toLowerCase().includes(name)) : all;
  res.json(results);
});

export default router;
