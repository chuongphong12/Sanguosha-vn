import { TextStyle } from "pixi.js";
import "./typography.css";

export const GAME_FONT_FAMILY = "Noto Serif";

const VIETNAMESE_FONT_SAMPLE =
  "Tam Quốc Sát Chủ Công Võ Tướng Thể Lực Phán Xét Hấp Hối Nội Gian";

export async function loadGameFonts(): Promise<void> {
  await Promise.all([
    document.fonts.load(
      `400 16px "${GAME_FONT_FAMILY}"`,
      VIETNAMESE_FONT_SAMPLE,
    ),
    document.fonts.load(
      `700 16px "${GAME_FONT_FAMILY}"`,
      VIETNAMESE_FONT_SAMPLE,
    ),
  ]);
  await document.fonts.ready;
}

export const TitleTextStyle = new TextStyle({
  fontFamily: GAME_FONT_FAMILY,
  fontWeight: "bold",
  fill: [0xd4af37, 0xaa801a],
  stroke: { color: 0x1a1a1a, width: 3 },
  dropShadow: { alpha: 0.5, blur: 2, color: 0x000000, distance: 2 },
});
