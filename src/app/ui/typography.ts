import { FillGradient, TextStyle } from "pixi.js";
import "./typography.css";

export const GAME_FONT_FAMILY = "Noto Serif";

const VIETNAMESE_FONT_SAMPLE =
  "Tam Quá»‘c SÃ¡t Chá»§ CÃ´ng VÃµ TÆ°á»›ng Thá»ƒ Lá»±c PhÃ¡n XÃ©t Háº¥p Há»‘i Ná»™i Gian";

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

const gradient = new FillGradient({
  type: "linear",
  start: { x: 0, y: 0 },
  end: { x: 0, y: 100 },
  colorStops: [
    { offset: 0, color: 0xd4af37 },
    { offset: 1, color: 0xaa801a },
  ],
});

export const TitleTextStyle = new TextStyle({
  fontFamily: GAME_FONT_FAMILY,
  fontWeight: "bold",
  fill: gradient,
  stroke: { color: 0x1a1a1a, width: 3 },
  dropShadow: { alpha: 0.5, blur: 2, color: 0x000000, distance: 2 },
});
