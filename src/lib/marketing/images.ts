/**
 * Curated Unsplash photography used across the SecureTrack ERP marketing
 * site. All URLs are stable Unsplash photo IDs with on-the-fly resizing
 * (w, q, auto=format, fit=crop) served through the official CDN.
 */
export function unsplash(id: string, w = 1600, q = 80): string {
  return `https://images.unsplash.com/${id}?w=${w}&q=${q}&auto=format&fit=crop`;
}

export const IMAGES = {
  office: unsplash("photo-1497366216548-37526070297c"),
  engineer: unsplash("photo-1581091226825-a6a2a5aee158"),
  healthcare: unsplash("photo-1576091160399-112ba8d25d1d"),
  education: unsplash("photo-1524178232363-1fb2b075b655"),
  government: unsplash("photo-1568605117036-5fe5e7bab0b7"),
  construction: unsplash("photo-1503387762-592deb58ef4e"),
  retail: unsplash("photo-1441986300917-64674bd600d8"),
  warehouse: unsplash("photo-1553413077-190dd305871c"),
  logistics: unsplash("photo-1601584115197-04ecc0da31d7"),
  agriculture: unsplash("photo-1500937386664-56d1dfef3854"),
  banking: unsplash("photo-1554224155-6726b3ff858f"),
  volunteers: unsplash("photo-1559027615-cd4628902d4a"),
  energy: unsplash("photo-1466611653911-95081537e5b7"),
  team: unsplash("photo-1519389950473-47ba0277781c"),
  hotel: unsplash("photo-1566073771259-6a8506099945"),
  handshake: unsplash("photo-1521791136064-7986c2920216"),
  realEstate: unsplash("photo-1560518883-ce09059eeffa"),
  analytics: unsplash("photo-1551288049-bebda4e38f71"),
  serverRoom: unsplash("photo-1558494949-ef010cbdcc31"),
  collaboration: unsplash("photo-1522071820081-009f0129c71c"),
} as const;

/** Industry pack slug -> hero image for the industries directory. */
export const INDUSTRY_IMAGES: Record<string, string> = {
  manufacturing: IMAGES.engineer,
  healthcare: IMAGES.healthcare,
  education: IMAGES.education,
  government: IMAGES.government,
  construction: IMAGES.construction,
  retail: IMAGES.retail,
  wholesale: IMAGES.warehouse,
  logistics: IMAGES.logistics,
  hospitality: IMAGES.hotel,
  agriculture: IMAGES.agriculture,
  banking: IMAGES.banking,
  insurance: IMAGES.handshake,
  ngos: IMAGES.volunteers,
  mining: IMAGES.construction,
  utilities: IMAGES.energy,
  telecommunications: IMAGES.team,
  "professional-services": IMAGES.collaboration,
  "real-estate": IMAGES.realEstate,
  energy: IMAGES.energy,
};