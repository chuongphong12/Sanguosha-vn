import { CARD_DEFINITIONS } from "../../game/catalog/cards";
import type { EquipmentSlot, PhysicalCard } from "../../game/model";

export interface EquipmentSlotView {
  slot: EquipmentSlot;
  label: string;
  cardID: string | null;
  cardName: string;
  cardLabel: string;
}

const SUIT_SYMBOLS = {
  heart: "♥",
  diamond: "♦",
  club: "♣",
  spade: "♠",
};

const EQUIPMENT_SLOTS: Array<{
  slot: EquipmentSlot;
  label: string;
}> = [
  { slot: "weapon", label: "Vũ Khí" },
  { slot: "armor", label: "Phòng Cụ" },
  { slot: "offensive-mount", label: "Tọa Kỵ -1" },
  { slot: "defensive-mount", label: "Tọa Kỵ +1" },
];

export function getEquipmentSlotViews(
  cards: Record<string, PhysicalCard>,
  equipment: Partial<Record<EquipmentSlot, string>>,
): EquipmentSlotView[] {
  return EQUIPMENT_SLOTS.map(({ slot, label }) => {
    const cardID = equipment[slot] ?? null;
    const card = cardID ? cards[cardID] : undefined;
    return {
      slot,
      label,
      cardID,
      cardName: card ? CARD_DEFINITIONS[card.definitionID].name : "Trống",
      cardLabel: card
        ? `【${CARD_DEFINITIONS[card.definitionID].name}】 ${SUIT_SYMBOLS[card.suit]} ${card.rank}`
        : "Trống",
    };
  });
}
