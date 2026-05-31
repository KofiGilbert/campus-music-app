const ALBUM_ART_BY_GENRE: Record<string, string[]> = {
  "Hip Hop": [
    "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/0f/fe/be/0ffebed5-1c9f-8e5e-4bdb-7eafd5c4ac3b/26UMGIM50942.rgb.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b5/59/46/b559466b-ef0f-883b-e859-0b488ec28dd4/8718521206925.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/de/74/c6/de74c63a-8c80-bdfc-8a3a-328cad87249f/823375157359_Cover.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/00/a4/05/00a40527-ed66-52d4-ecc7-65f50049ae44/ticket.kqkeugub.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/1d/1b/c2/1d1bc279-394e-376a-4efc-137138a678c3/artwork.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/68/c0/25/68c025f1-94a5-e90e-ab23-443610bd451e/656465213204_cover.jpg/600x600bb.jpg",
  ],
  "Lo-Fi": [
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ce/fe/88/cefe88f7-f098-a1d0-1488-aaf5a635a39d/artwork.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/61/68/3e/61683e4e-7dbc-514a-1a0c-7e72fd911dcf/4550754421416_cover.png/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/73/9e/19/739e195d-a476-7ac9-2d39-e8920f778105/5060781123171.png/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/e1/a2/0c/e1a20cff-b202-c296-1f9e-b99915437ecc/5056760595763.png/600x600bb.jpg",
  ],
  "R&B": [
    "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/62/64/21/62642112-ca15-83ac-ad76-70bf01378f33/196874221129.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/57/df/da/57dfdaf4-de23-c0c7-64d2-ef4b4cc93ce2/656465172365_cover.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/7f/10/e0/7f10e0c8-4fe5-300f-a48c-aef36d725d29/823375104049_Cover.jpg/600x600bb.jpg",
  ],
  "Indie": [
    "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/92/9f/69/929f69f1-9977-3a44-d674-11f70c852d1b/24UMGIM36186.rgb.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/c2/85/fd/c285fda5-edf4-2e3b-bd3c-10deeabf2aaa/018736184406.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/ec/f5/45/ecf545c0-24bd-90de-7639-3069e648c51d/075679804938.jpg/600x600bb.jpg",
  ],
  "Jazz": [
    "https://is1-ssl.mzstatic.com/image/thumb/Music111/v4/47/0d/fd/470dfd00-b86d-9f11-3c0a-3eb4fca1e94c/8176930229902.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/00/c9/7d/00c97d52-07bf-1020-1c4b-732219453851/cover.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music5/v4/03/80/b6/0380b666-a818-2133-28e2-5a8a15cae361/chill_music_for_dinner.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/73/6d/7c/736d7cfb-c79d-c9a9-4170-5e71d008dea1/886449666430.jpg/600x600bb.jpg",
  ],
  "Electronic": [
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ce/fe/88/cefe88f7-f098-a1d0-1488-aaf5a635a39d/artwork.jpg/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/68/c0/25/68c025f1-94a5-e90e-ab23-443610bd451e/656465213204_cover.jpg/600x600bb.jpg",
  ],
  "Ambient": [
    "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/73/9e/19/739e195d-a476-7ac9-2d39-e8920f778105/5060781123171.png/600x600bb.jpg",
    "https://is1-ssl.mzstatic.com/image/thumb/Music5/v4/03/80/b6/0380b666-a818-2133-28e2-5a8a15cae361/chill_music_for_dinner.jpg/600x600bb.jpg",
  ],
};

const ALL_URLS: string[] = Object.values(ALBUM_ART_BY_GENRE).flat();

export function getAlbumArtUrl(genre: string | undefined, index: number): string {
  if (genre) {
    const key = Object.keys(ALBUM_ART_BY_GENRE).find(
      (k) =>
        genre.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(genre.toLowerCase())
    );
    if (key) {
      const pool = ALBUM_ART_BY_GENRE[key];
      return pool[index % pool.length];
    }
  }
  return ALL_URLS[index % ALL_URLS.length];
}
