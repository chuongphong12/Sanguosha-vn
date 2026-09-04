import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CARD_ART_ALIAS,
  EQUIP_ART_ALIAS,
  EQUIP_ICON_ALIAS,
  FACTION_ICON_ALIAS,
  GENERAL_PORTRAIT_ALIAS,
  GENERALS_WITHOUT_PORTRAIT,
} from "../../src/app/ui/assetAliases";
import { CARD_DEFINITIONS } from "../../src/game/catalog/cards";
import { GENERALS } from "../../src/game/catalog/generals";

function expectTrackedAsset(alias: string): void {
  const sourcePath = fileURLToPath(
    new URL(
      `../../raw-assets/${alias.replace("main/", "main{m}/")}`,
      import.meta.url,
    ),
  );
  expect(existsSync(sourcePath), alias).toBe(true);
}

describe("visual asset aliases", () => {
  it("maps every catalog card to an asset in the manifest", () => {
    const aliases = { ...CARD_ART_ALIAS, ...EQUIP_ART_ALIAS };

    expect(Object.keys(aliases).sort()).toEqual(
      Object.keys(CARD_DEFINITIONS).sort(),
    );
    for (const alias of Object.values(aliases)) expectTrackedAsset(alias);
  });

  it("maps every equipment card to a public slot icon", () => {
    const equipmentIDs = Object.values(CARD_DEFINITIONS)
      .filter((definition) => definition.kind === "equipment")
      .map((definition) => definition.id)
      .sort();
    expect(Object.keys(EQUIP_ART_ALIAS).sort()).toEqual(equipmentIDs);
    expect(Object.keys(EQUIP_ICON_ALIAS).sort()).toEqual(equipmentIDs);
    for (const alias of Object.values(EQUIP_ICON_ALIAS))
      expectTrackedAsset(alias);
  });

  it("maps every available general portrait and documents missing art", () => {
    const mappedIDs = Object.keys(GENERAL_PORTRAIT_ALIAS);
    const coveredIDs = [...mappedIDs, ...GENERALS_WITHOUT_PORTRAIT].sort();

    expect(coveredIDs).toEqual(GENERALS.map((general) => general.id).sort());
    for (const alias of Object.values(GENERAL_PORTRAIT_ALIAS))
      expectTrackedAsset(alias);
  });

  it("maps every faction icon to an asset in the manifest", () => {
    expect(Object.keys(FACTION_ICON_ALIAS).sort()).toEqual(
      ["qun", "shu", "wei", "wu"].sort(),
    );
    for (const alias of Object.values(FACTION_ICON_ALIAS))
      expectTrackedAsset(alias);
  });
});
