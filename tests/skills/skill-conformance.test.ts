import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  endCardPlayPhase,
  startCardTurn,
} from "../../src/game/cardEngine";
import { GENERALS_BY_ID, SKILLS } from "../../src/game/catalog/generals";
import type { PlayerID, TqsGameState } from "../../src/game/model";
import { createPlayerView } from "../../src/game/player-view";
import {
  answerNullificationChain,
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
  stackDeck,
} from "../helpers/game";

function assignGeneral(
  G: TqsGameState,
  playerID: PlayerID,
  generalID: string,
): void {
  G.players[playerID].generalID = generalID;
  G.players[playerID].activeSkillIDs = GENERALS_BY_ID[
    generalID
  ].skillIDs.filter((skillID) => !SKILLS[skillID].lordSkill);
}

describe("Standard 2013 skill conformance", () => {
  it("Guan Xing is optional and leaves the deck unchanged when declined", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "zhuge-liang");
    const originalDeck = [...G.deck];

    startCardTurn(G, playerID, identityShuffle);
    expect(G.prompt).toMatchObject({
      kind: "option",
      reason: "guan-xing",
      choices: ["activate", "decline"],
    });
    expect(G.processing).toHaveLength(0);
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "decline" },
      identityShuffle,
    );

    expect(G.players[playerID].hand).toEqual(originalDeck.slice(0, 2));
    expect(G.deck).toEqual(originalDeck.slice(2));
  });

  it("Guan Xing uses living-player count and orders both top and bottom", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "zhuge-liang");
    G.players[G.seatOrder[3]].alive = false;

    startCardTurn(G, playerID, identityShuffle);
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.processing).toHaveLength(3);
    const [first, second, third] = G.processing;
    const hiddenView = createPlayerView(G, G.seatOrder[1]);
    expect(hiddenView.processing).toEqual(["hidden", "hidden", "hidden"]);

    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [{ zone: "processing", cardID: second }],
      },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      kind: "select-cards",
      reason: "guan-xing",
    });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [
          { zone: "processing", cardID: third },
          { zone: "processing", cardID: first },
        ],
      },
      identityShuffle,
    );

    expect(G.players[playerID].hand[0]).toBe(second);
    expect(G.deck.slice(-2)).toEqual([third, first]);
  });

  it("Luo Shen can be declined initially and after each black judgement", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "zhen-ji");
    const blackID = G.deck.find((id) =>
      ["spade", "club"].includes(G.cards[id].suit),
    )!;
    const redID = G.deck.find((id) =>
      ["heart", "diamond"].includes(G.cards[id].suit),
    )!;
    stackDeck(G, [blackID, redID]);

    startCardTurn(G, playerID, identityShuffle);
    expect(G.prompt).toMatchObject({ reason: "luo-shen" });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[playerID].hand).toContain(blackID);
    expect(G.prompt).toMatchObject({ reason: "luo-shen" });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "decline" },
      identityShuffle,
    );
    expect(G.players[playerID].hand).toContain(redID);
  });

  it("Bi Yue asks before drawing at the start of the end phase", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "diao-chan");

    endCardPlayPhase(G, playerID, identityShuffle);
    expect(G.prompt).toMatchObject({
      kind: "option",
      reason: "bi-yue",
      responderID: playerID,
    });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[playerID].hand).toHaveLength(1);
  });

  it("Ke Ji can be declined instead of automatically skipping discard", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "lu-meng");
    for (let index = 0; index < G.players[playerID].hp + 1; index += 1)
      giveCard(G, playerID, "dodge");

    endCardPlayPhase(G, playerID, identityShuffle);
    expect(G.prompt).toMatchObject({ reason: "ke-ji" });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "decline" },
      identityShuffle,
    );
    expect(G.turn.activePlayerID).toBe(playerID);
    expect(G.turn.step).toBe("discard");
  });

  it("Ji Zhi asks before drawing for each non-delayed trick", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "huang-yueying");
    const trickID = giveCard(G, playerID, "ex-nihilo");

    declareCardUse(
      G,
      playerID,
      { cardID: trickID, targetIDs: [] },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({ reason: "ji-zhi" });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    answerNullificationChain(G, {});
    expect(G.players[playerID].hand).toHaveLength(3);
  });

  it("Yi Ji resolves once per damage point and can split cards between players", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const guoJiaID = G.seatOrder[1];
    const firstRecipientID = G.seatOrder[2];
    const secondRecipientID = G.seatOrder[3];
    assignGeneral(G, sourceID, "xu-chu");
    assignGeneral(G, guoJiaID, "guo-jia");
    G.turn.luoYiBuff = true;
    const slashID = giveCard(G, sourceID, "slash");

    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [guoJiaID] },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      guoJiaID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      kind: "option",
      reason: "yi-ji",
      choices: ["activate", "decline"],
    });
    answerCardPrompt(
      G,
      guoJiaID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    const [firstCardID, secondCardID] = G.players[guoJiaID].hand;

    answerCardPrompt(
      G,
      guoJiaID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [{ zone: "hand", ownerID: guoJiaID, handIndex: 0 }],
      },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      guoJiaID,
      G.prompt!.id,
      { kind: "players", playerIDs: [firstRecipientID] },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      guoJiaID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [{ zone: "hand", ownerID: guoJiaID, handIndex: 0 }],
      },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      guoJiaID,
      G.prompt!.id,
      { kind: "players", playerIDs: [secondRecipientID] },
      identityShuffle,
    );

    expect(G.players[firstRecipientID].hand).toContain(firstCardID);
    expect(G.players[secondRecipientID].hand).toContain(secondCardID);
    expect(G.prompt).toMatchObject({ reason: "yi-ji", kind: "option" });
    answerCardPrompt(
      G,
      guoJiaID,
      G.prompt!.id,
      { kind: "option", choice: "decline" },
      identityShuffle,
    );
  });

  it("Jian Xiong obtains every physical subcard of a virtual damage card", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const caoCaoID = G.seatOrder[1];
    assignGeneral(G, sourceID, "zhang-fei");
    assignGeneral(G, caoCaoID, "cao-cao");
    const spearID = giveCard(G, sourceID, "serpent-spear");
    G.players[sourceID].hand.splice(
      G.players[sourceID].hand.indexOf(spearID),
      1,
    );
    G.players[sourceID].equipment.weapon = spearID;
    const firstMaterialID = giveCard(G, sourceID, "dodge");
    const secondMaterialID = giveCard(G, sourceID, "peach");

    declareCardUse(
      G,
      sourceID,
      {
        kind: "serpent-spear",
        cardIDs: [firstMaterialID, secondMaterialID],
        targetIDs: [caoCaoID],
      },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      caoCaoID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      caoCaoID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );

    expect(G.players[caoCaoID].hand).toEqual(
      expect.arrayContaining([firstMaterialID, secondMaterialID]),
    );
    expect(G.discard).not.toContain(firstMaterialID);
    expect(G.discard).not.toContain(secondMaterialID);
  });

  it("Yao Wu ignores a colorless Serpent Spear Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const huaXiongID = G.seatOrder[1];
    assignGeneral(G, sourceID, "zhang-fei");
    assignGeneral(G, huaXiongID, "hua-xiong");
    const spearID = giveCard(G, sourceID, "serpent-spear");
    G.players[sourceID].hand.splice(
      G.players[sourceID].hand.indexOf(spearID),
      1,
    );
    G.players[sourceID].equipment.weapon = spearID;
    const redID = G.deck.find((id) =>
      ["heart", "diamond"].includes(G.cards[id].suit),
    )!;
    const blackID = G.deck.find((id) =>
      ["spade", "club"].includes(G.cards[id].suit),
    )!;
    G.deck.splice(G.deck.indexOf(redID), 1);
    G.deck.splice(G.deck.indexOf(blackID), 1);
    G.players[sourceID].hand.push(redID, blackID);

    declareCardUse(
      G,
      sourceID,
      {
        kind: "serpent-spear",
        cardIDs: [redID, blackID],
        targetIDs: [huaXiongID],
      },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      huaXiongID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );

    expect(G.prompt).toBeNull();
    expect(G.discard).toEqual(expect.arrayContaining([redID, blackID]));
  });

  it("Ji Jiang answers each Wu Shuang Duel Slash request separately", () => {
    const G = createStartedGame();
    resetHands(G);
    const luBuID = G.turn.activePlayerID;
    const lordID = G.seatOrder[1];
    const allyID = G.seatOrder[2];
    assignGeneral(G, luBuID, "lu-bu");
    G.players[lordID].generalID = "liu-bei";
    G.players[lordID].activeSkillIDs = ["ren-de", "ji-jiang"];
    assignGeneral(G, allyID, "guan-yu");
    const duelID = giveCard(G, luBuID, "duel");
    const firstSlashID = giveCard(G, allyID, "slash");
    const secondSlashID = giveCard(G, allyID, "slash");

    declareCardUse(
      G,
      luBuID,
      { cardID: duelID, targetIDs: [lordID] },
      identityShuffle,
    );
    answerNullificationChain(G, {});
    for (const slashID of [firstSlashID, secondSlashID]) {
      expect(G.prompt).toMatchObject({
        responderID: lordID,
        response: "slash",
        summonFaction: "shu",
      });
      answerCardPrompt(
        G,
        lordID,
        G.prompt!.id,
        { kind: "summon" },
        identityShuffle,
      );
      answerCardPrompt(
        G,
        allyID,
        G.prompt!.id,
        { kind: "card", cardID: slashID },
        identityShuffle,
      );
    }

    expect(G.prompt).toMatchObject({ responderID: luBuID, response: "slash" });
  });
});
