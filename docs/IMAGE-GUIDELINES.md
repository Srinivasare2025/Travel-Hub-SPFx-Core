# Image & Video Guidelines

A reference for whoever supplies pictures/video for TravelHub (marketing,
content authors) — the exact dimensions each section displays at, so a
request to the marketing team for "quality pictures" can point at a concrete
size instead of "something big."

Every image is shown with CSS `object-fit: cover` inside a fixed-aspect-ratio
box (see `ImageWithFallback`): the picture is scaled to fill the box and
**cropped** to it, never stretched. That means:

- Supply the image at (or very close to) the aspect ratio listed below. A
  wildly different aspect ratio gets cropped hard to fit — e.g. a tall
  portrait photo dropped into a 16 / 9 box loses most of its left/right (or,
  depending on the source, top/bottom) content.
- Keep the subject **centred** or at least away from the edges. `cover` crops
  edges first; anything critical (a face, a logo, text baked into the image)
  belongs in the middle third of the frame.
- Export at least the "minimum" pixel size below so the image isn't upscaled
  and blurry on a large/retina display. Bigger is fine — the browser scales
  down for free; it cannot scale up without quality loss.
- JPEG (photos) or WEBP, optimised/compressed for web. Keep individual files
  under ~500 KB where possible — these load on a hub page, not a gallery.

## Image dimensions by section

| Section | Component | Aspect ratio | Recommended minimum | Notes |
| --- | --- | --- | --- | --- |
| Hero banner (desktop) | `TH_HeroBanners.ImageUrl` | 21 / 9 (ultra-wide) | 2400 × 1029 px | The widest box on the page — a normal 16:9 photo crops heavily top/bottom. Keep the subject in the centre third; the left edge sits under a dark gradient scrim that holds the title/text. |
| Hero banner (mobile) | `TH_HeroBanners.MobileImageUrl` | 21 / 9 (same box as desktop) | 1200 × 514 px | Optional — falls back to the desktop image if omitted. Shown below 640px width; a distinct crop lets you re-frame the subject for a narrow screen, but it's still the same 21:9 box, not a taller portrait crop. |
| Hero banner (video) | `TH_HeroBanners.VideoUrl` | Any — shown with `object-fit: contain` (full frame visible, letterboxed) | 1920 × 1080 px (16:9) recommended | Unlike images, video is **not** cropped — the whole frame is always visible, so any aspect ratio works, but one close to 16:9 or 21:9 minimises the letterbox bars. MP4/H.264, ideally under ~15 MB; keep it reasonably short since it plays in full before the carousel advances. |
| Travel Care poster (hero quick link, `type: image`) | `hero.quickLink.*.url` | Any — shown uncropped in the in-app image viewer | 1000 × 1400 px | Not cropped to a box (it's a document viewer for QR-code posters), so portrait or landscape is fine. Make sure any QR code has a clean quiet zone/margin around it. |
| Our Services card | `TH_TravelServices.ImageUrl` | 16 / 10 | 960 × 600 px | |
| Travel News — featured article | `TH_TravelNews.ImageUrl` (first/featured item) | 16 / 9 | 1200 × 675 px | |
| Travel News — list thumbnail | `TH_TravelNews.ImageUrl` (subsequent items) | 1 / 1 (square) | 400 × 400 px | Same source image as the featured slot above — crop to square happens automatically, just keep the subject centred. |
| Upcoming Events thumbnail | `TH_TravelEvents.ImageUrl` | 1 / 1 (square) | 320 × 320 px | |

Travel Tips & Insights uses an icon, not an image — no dimensions needed there.

## Future sections (not yet built)

TravelerEngagement, TravelInsights, TravelTeam, and Footer haven't shipped yet
(ARCHITECTURE.md phases 7–10). The `footer.qrCodeUrl` config field already
exists, and once the Footer component is built it will most likely render it
uncropped at its native shape (not inside an `object-fit` box, since a QR code
must stay a true square) — target roughly 400 × 400 px with a clean quiet zone
around the code. Confirm against the actual component once it lands, and add
each new section's image dimensions to this table the same way: check the
component's `aspectRatio` prop on its `ImageWithFallback` usage, and record it
here.
