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
