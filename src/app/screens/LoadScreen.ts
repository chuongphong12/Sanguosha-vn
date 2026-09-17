import { animate } from "motion";
import type { ObjectTarget } from "motion/react";
import { Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";

import { GAME_FONT_FAMILY } from "../ui/typography";

/** Screen shown while loading assets */
export class LoadScreen extends Container {
  /** Assets bundles required by this screen */
  public static assetBundles = ["preload"];
  /** Background image */
  private background: Sprite;
  /** Product logo */
  private logo: Sprite;
  /** Product title */
  private title: Text;
  /** Subtitle under the title */
  private subtitle: Text;
  /** Note about the Vietnamese port */
  private portNote: Text;
  /** Credit line in the bottom-right corner */
  private credit: Text;
  /** Linear loading bar */
  private barWidth = 420;
  private barBack: Graphics;
  private barFill: Graphics;

  constructor() {
    super();

    this.background = new Sprite(Assets.get<Texture>("preload/bg.jpg"));
    this.addChild(this.background);

    const overlay = new Graphics();
    overlay
      .rect(-5000, -5000, 10000, 10000)
      .fill({ color: 0x000000, alpha: 0.35 });
    this.addChild(overlay);

    this.logo = new Sprite(
      Texture.from(
        "data:image/svg+xml;base64," +
          "PHN2ZyB3aWR0aD0iNzM1IiBoZWlnaHQ9IjI4OSIgdmlld0JveD0iMCAwIDczNSAyODkiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxnIGNsaXAtcGF0aD0idXJsKCNjbGlwMF83Xzg0KSI+CjxwYXRoIGQ9Ik0zMDQuMTcgMjg4LjAxVjg5Ljk5SDI0NC45N0MyNDQuNzcgODkuOTkgMjQ0LjU2IDg5Ljk5IDI0NC4zNCA5MEMyMzMuNyA5MC4zNyAyMjUuMTUgOTkuMTIgMjI1LjA1IDEwOS43NkMyMjUuMDUgMTA5LjgyIDIyNS4wNSAxMDkuODggMjI1LjA1IDEwOS45M1YyNjguNEMyMjUuMDUgMjY4LjczIDIyNS4wNyAyNjkuMSAyMjUuMSAyNjkuNTFDMjI2IDI3OS43MSAyMzQuNTQgMjg3LjUzIDI0NC43NyAyODcuOTdDMjQ1LjIgMjg3Ljk5IDI0NS42MSAyODggMjQ1Ljk5IDI4OEgzMDQuMTdWMjg4LjAxWiIgZmlsbD0iI0U3MjI2NCIvPgo8cGF0aCBkPSJNNTQ4LjIxIDI4Ny45MUM1NTkuMjQgMjg3LjA4IDU2Ny45NyAyNzggNTY4LjA1IDI2Ni45M0M1NjguMDUgMjY2Ljg2IDU2OC4wNSAyNjYuNzkgNTY4LjA1IDI2Ni43MlYxMTAuMTZDNTY4LjA1IDExMC4xIDU2OC4wNSAxMTAuMDMgNTY4LjA1IDEwOS45N0M1NjggOTkuMDMgNTU5LjEgOTAuMTEgNTQ4LjE2IDkwQzU0OC4wOCA5MCA1NDggOTAgNTQ3LjkyIDkwSDQ4OC45M1YyODguMDJINTQ1Ljc0QzU0Ni41MSAyODguMDIgNTQ3LjM0IDI4Ny45OCA1NDguMjEgMjg3LjkyVjI4Ny45MVoiIGZpbGw9IiNFNzIyNjQiLz4KPHBhdGggZD0iTTI5My4wNyA5MEgzNTUuMDdDMzYxLjE1IDkwIDM2OS43NSA5NC45MiAzNzQuMjkgMTAxTDUwNS43NiAyNzdDNTEwLjMgMjgzLjA4IDUwOS4wNSAyODggNTAyLjk4IDI4OEg0NDAuOThDNDM0LjkgMjg4IDQyNi4zIDI4My4wOCA0MjEuNzYgMjc3TDI5MC4yOCAxMDFDMjg1Ljc0IDk0LjkzIDI4Ni45OSA5MCAyOTMuMDYgOTBIMjkzLjA3WiIgZmlsbD0iI0U3MjI2NCIvPgo8cGF0aCBkPSJNNDk4LjA3IDkwSDQzNi4wN0M0MjkuOTkgOTAgNDIxLjM5IDk0LjkyIDQxNi44NSAxMDFMMjg1LjM4IDI3N0MyODAuODQgMjgzLjA4IDI4Mi4wOSAyODggMjg4LjE2IDI4OEgzNTAuMTZDMzU2LjI0IDI4OCAzNjQuODQgMjgzLjA4IDM2OS4zOCAyNzdMNTAwLjg1IDEwMUM1MDUuMzkgOTQuOTMgNTA0LjE0IDkwIDQ5OC4wNyA5MFoiIGZpbGw9IiNFNzIyNjQiLz4KPHBhdGggZD0iTTUyOS4wNyAwQzU1MC4wNSAwIDU2Ny4wNyAxNy4wMSA1NjcuMDcgMzhDNTY3LjA3IDU4Ljk5IDU1MC4wNiA3NiA1MjkuMDcgNzZDNTA4LjA4IDc2IDQ5MS4wNyA1OC45OSA0OTEuMDcgMzhDNDkxLjA3IDE3LjAxIDUwOC4wOCAwIDUyOS4wNyAwWiIgZmlsbD0iI0U3MjI2NCIvPgo8cGF0aCBkPSJNMjY1LjA3IDBDMjg2LjA1IDAgMzAzLjA3IDE3LjAxIDMwMy4wNyAzOEMzMDMuMDcgNTguOTkgMjg2LjA2IDc2IDI2NS4wNyA3NkMyNDQuMDggNzYgMjI3LjA3IDU4Ljk5IDIyNy4wNyAzOEMyMjcuMDcgMTcuMDEgMjQ0LjA4IDAgMjY1LjA3IDBaIiBmaWxsPSIjRTcyMjY0Ii8+CjxwYXRoIGQ9Ik02OTUuMDcgMEg2MzUuMDdDNjEzLjUzIDAgNTk2LjA3IDE3LjQ2IDU5Ni4wNyAzOVY5OUM1OTYuMDcgMTIwLjU0IDYxMy41MyAxMzggNjM1LjA3IDEzOEg2OTUuMDdDNzE2LjYxIDEzOCA3MzQuMDcgMTIwLjU0IDczNC4wNyA5OVYzOUM3MzQuMDcgMTcuNDYgNzE2LjYxIDAgNjk1LjA3IDBaTTY1NS40NCAzOS4zNFY3OS44NEM2NTUuNDQgODUuMyA2NTQuMzUgOTAuMDQgNjUyLjE3IDk0LjA1QzY0OS45OSA5OC4wNiA2NDYuODggMTAxLjE3IDY0Mi44NCAxMDMuMzhDNjM4LjggMTA1LjU5IDYzNC4wMSAxMDYuNyA2MjguNDggMTA2LjdDNjIzLjc4IDEwNi43IDYxOS43MiAxMDUuODUgNjE2LjI5IDEwNC4xNkM2MTIuODYgMTAyLjQ3IDYwOS45OCAxMDAuMSA2MDcuNjMgOTcuMDZDNjA3LjYzIDk3LjA2IDYwMS4wOCA4OS45OSA2MDcuMDggODVDNjEzLjIxIDc5LjkgNjE4LjUyIDg2LjU4IDYxOC41MiA4Ni41OEM2MTkuNzYgODguMzEgNjIxLjIzIDg5LjYxIDYyMi45MyA5MC40N0M2MjQuNjIgOTEuMzQgNjI2LjU0IDkxLjc3IDYyOC42OSA5MS43N0M2MzAuNjkgOTEuNzcgNjMyLjQ2IDkxLjM2IDYzMy45OCA5MC41M0M2MzUuNSA4OS43IDYzNi43MSA4OC40NiA2MzcuNjEgODYuOEM2MzguNTEgODUuMTQgNjM4Ljk2IDgzLjEgNjM4Ljk2IDgwLjY4VjM5LjM1QzYzOC45NiAzOS4zNSA2MzguOCAzMS4wMSA2NDcuMDggMzEuMDFDNjU1LjM2IDMxLjAxIDY1NS40NSAzOS4zNSA2NTUuNDUgMzkuMzVMNjU1LjQ0IDM5LjM0Wk03MTQuMzUgOTguMzhDNzA5LjgyIDEwMi44NiA3MDMuMTUgMTA1LjU2IDY5NC4zNSAxMDYuNDhDNjg4LjMgMTA3LjEyIDY4My4wMiAxMDYuNyA2NzguNTIgMTA1LjIzQzY3NC4wMiAxMDMuNzYgNjY5LjgxIDEwMS4yMSA2NjUuODggOTcuNTlDNjY1Ljg4IDk3LjU5IDY1OS44IDkyLjM1IDY2NC43IDg1Ljc3QzY2OC4zOCA4MC44MiA2NzUuMyA4NS45NiA2NzUuMyA4NS45NkM2NzcuOTIgODguNCA2ODAuNzMgOTAuMiA2ODMuNzQgOTEuMzhDNjg2Ljc1IDkyLjU2IDY5MC4xNCA5Mi45NSA2OTMuOTMgOTIuNTVDNjk3LjMgOTIuMiA2OTkuODYgOTEuMjggNzAxLjYyIDg5LjgxQzcwMy4zOCA4OC4zNCA3MDQuMTQgODYuNSA3MDMuOTEgODQuM0M3MDMuNzEgODIuMzggNzAyLjk0IDgwLjg2IDcwMS42MSA3OS43NUM3MDAuMjggNzguNjQgNjk4LjUzIDc3Ljc1IDY5Ni4zNyA3Ny4wN0M2OTQuMjEgNzYuMzkgNjkxLjg5IDc1Ljc5IDY4OS40IDc1LjI1QzY4Ni45MSA3NC43MSA2ODQuMzkgNzQuMDIgNjgxLjgzIDczLjE4QzY3OS4yNyA3Mi4zNCA2NzYuOSA3MS4yMyA2NzQuNyA2OS44NkM2NzIuNSA2OC40OSA2NzAuNjYgNjYuNjQgNjY5LjE2IDY0LjI5QzY2Ny42NiA2MS45NCA2NjYuNzIgNTguOTUgNjY2LjM0IDU1LjMxQzY2NS44NiA1MC43NyA2NjYuNTQgNDYuNzcgNjY4LjM2IDQzLjMxQzY3MC4xOSAzOS44NSA2NzIuOTcgMzcuMDcgNjc2LjcxIDM0Ljk3QzY4MC40NSAzMi44NyA2ODQuOCAzMS41NiA2ODkuNzUgMzEuMDRDNjk0LjkxIDMwLjUgNjk5LjY4IDMwLjkgNzA0LjA2IDMyLjI0QzcwOC40NCAzMy41OSA3MTIuMTcgMzUuNjMgNzE1LjI0IDM4LjM2QzcxNS4yNCAzOC4zNiA3MTkuNTQgNDEuOTcgNzE2LjA1IDQ4LjE4QzcxMy4zNCA1My4wMSA3MDUuNzMgNTAuMTEgNzA1LjczIDUwLjExQzcwMy4yOSA0OC4wNyA3MDAuODkgNDYuNjIgNjk4LjU1IDQ1Ljc2QzY5Ni4yIDQ0LjkgNjkzLjY1IDQ0LjYxIDY5MC45IDQ0LjlDNjg4LjA4IDQ1LjIgNjg1LjkgNDUuOTcgNjg0LjM2IDQ3LjJDNjgyLjgyIDQ4LjQ0IDY4Mi4xNiA1MC4wNiA2ODIuMzcgNTIuMDVDNjgyLjU2IDUzLjg0IDY4My4zMyA1NS4yMyA2ODQuNjkgNTYuMjRDNjg2LjA1IDU3LjI0IDY4Ny43OCA1OC4wNSA2ODkuOSA1OC42NkM2OTIuMDEgNTkuMjcgNjk0LjM0IDU5Ljg2IDY5Ni44NiA2MC40M0M2OTkuMzkgNjEgNzAxLjkzIDYxLjY5IDcwNC40OCA2Mi41QzcwNy4wMyA2My4zMSA3MDkuNCA2NC40NyA3MTEuNTcgNjUuOThDNzEzLjc0IDY3LjQ5IDcxNS42IDY5LjQ1IDcxNy4xNCA3MS44NkM3MTguNjggNzQuMjcgNzE5LjY1IDc3LjQgNzIwLjA2IDgxLjI1QzcyMC43OSA4OC4yIDcxOC44OSA5My45MSA3MTQuMzUgOTguMzhaIiBmaWxsPSIjRTcyMjY0Ii8+CjxwYXRoIGQ9Ik0xMDcuMTcgMC4zNDAwODhDNDcuOTggMC4zNDAwODggMCA0OC4zMjAxIDAgMTA3LjUxQzAgMTA4LjY3IDAuMDIgMTA5LjgyIDAuMDYgMTEwLjk3VjIxMy45NkMwLjA2IDIxMy45NiAwLjA2IDIxMy45NyAwLjA2IDIxMy45OFYyMjQuNDVDMC4wNiAyMjQuNDUgMC4wNiAyMjQuNDUgMC4wNyAyMjQuNDRWMjUwLjMzQzAuMDcgMjUwLjUzIDAuMDYgMjUwLjcyIDAuMDYgMjUwLjkyQzAuMDYgMjUxLjEyIDAuMDcgMjUxLjMyIDAuMDggMjUxLjUyVjI1MkgwLjA5QzAuNjYgMjcxLjg5IDE2Ljk1IDI4Ny44NCAzNi45OCAyODcuODRDNTcuMDEgMjg3Ljg0IDczLjQ3IDI3MS44OSA3NC4wNCAyNTJWMjEzLjk4SDEwNC42NkMxMDUuNDkgMjE0IDEwNi4zMyAyMTQuMDEgMTA3LjE2IDIxNC4wMUMxNjYuMzUgMjE0LjAxIDIxNC4zMyAxNjYuNyAyMTQuMzMgMTA3LjUxQzIxNC4zMyA0OC4zMjAxIDE2Ni4zNiAwLjM0MDA4OCAxMDcuMTcgMC4zNDAwODhaTTEwNy4xNyAxNDAuMDFDMTAwLjYyIDE0MC4wMSA4NC4wMiAxNDAuMDEgNzcuMTMgMTQwLjAxSDc0LjA3VjEwNy41MkM3NC4wNyA4OS4zMTAxIDg4Ljk2IDc0LjU0MDEgMTA3LjE3IDc0LjU0MDFDMTI1LjM4IDc0LjU0MDEgMTQwLjE1IDg5LjMxMDEgMTQwLjE1IDEwNy41MkMxNDAuMTUgMTI1LjczIDEyNS4zOCAxNDAuMDIgMTA3LjE3IDE0MC4wMlYxNDAuMDFaIiBmaWxsPSIjRTcyMjY0Ii8+CjxwYXRoIG9wYWNpdHk9IjAuMTUiIGQ9Ik0zNi4wNSAyMTRINzMuOTlWMjUyLjAxSDczLjgyQzczLjI1IDI3MS45IDU2Ljk2IDI4Ny44NSAzNi45MyAyODcuODVDMTYuOSAyODcuODUgMC42IDI3MS45IDAuMDMgMjUyLjAxSDAuMDJWMjUxLjUzQzAuMDIgMjUxLjMzIDAgMjUxLjEzIDAgMjUwLjkzQzAgMjUwLjczIDAuMDEgMjUwLjU0IDAuMDEgMjUwLjM0VjI0Ny42NkMxLjE1IDIyOS44NyAxNy45NCAyMTQgMzYuMDQgMjE0SDM2LjA1WiIgZmlsbD0iIzFEMUQxQiIvPgo8ZyBvcGFjaXR5PSIwLjA1Ij4KPHBhdGggb3BhY2l0eT0iMC41IiBkPSJNMC4wNTk5OTc2IDE2OC4yOFYyMTMuOThDMC4wNTk5OTc2IDE3My43MiAzMy44OSAxNDAuNTggNzQuMDUgMTQwLjAzVjEyNS40NUM0NC4yIDEyOC41OSAxNy43NyAxNDQuNjYgMC4wNTk5OTc2IDE2OC4yOFoiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0wLjExOTk5NSAyNDguMzdDOC44NCAyNDEuOTcgMTkuNDIgMjM4LjIgMzAuODQgMjM4LjJINzQuMDZWMjEzLjk4SDM3LjAzQzE3LjQ3IDIxMy45OCAxLjQ4IDIyOS4xNSAwLjExOTk5NSAyNDguMzdaIiBmaWxsPSJibGFjayIvPgo8L2c+CjxnIG9wYWNpdHk9IjAuMDUiPgo8cGF0aCBvcGFjaXR5PSIwLjUiIGQ9Ik03NC4wNSAxNDAuMDNWMTI2Ljc5QzQzLjk1IDEyOS43NCAxNy4zOSAxNDYuMTYgMC4wNTk5OTc2IDE3MC4yN1YyMTMuOThDMC4wNTk5OTc2IDE3My43MiAzMy44OSAxNDAuNTggNzQuMDUgMTQwLjAzWiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTM3LjAzIDIxMy45OEMxOCAyMTMuOTggMi4zNDAwMSAyMjguMzUgMC4yNjAwMSAyNDYuODNDOC45NzAwMSAyNDAuMDMgMTkuNzMgMjM2LjAxIDMxLjQgMjM2LjAxSDc0LjA1VjIxMy45OUgzNy4wMkwzNy4wMyAyMTMuOThaIiBmaWxsPSJibGFjayIvPgo8L2c+CjxnIG9wYWNpdHk9IjAuMDUiPgo8cGF0aCBvcGFjaXR5PSIwLjUiIGQ9Ik03NC4wNSAxNDAuMDNWMTI4LjEyQzQzLjY4IDEzMC44NyAxNi45NSAxNDcuNjkgMC4wNTk5OTc2IDE3Mi4zNFYyMTMuOTdDMC4wNTk5OTc2IDE3My43MSAzMy44OSAxNDAuNTcgNzQuMDUgMTQwLjAyVjE0MC4wM1oiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0zNy4wMyAyMTMuOThDMTguNTMgMjEzLjk4IDMuMjIwMDIgMjI3LjU1IDAuNDYwMDIyIDI0NS4yOEM5LjEyMDAyIDIzOC4wOSAyMC4wNiAyMzMuOCAzMS45NiAyMzMuOEg3NC4wNVYyMTMuOThIMzcuMDJIMzcuMDNaIiBmaWxsPSJibGFjayIvPgo8L2c+CjxnIG9wYWNpdHk9IjAuMDUiPgo8cGF0aCBvcGFjaXR5PSIwLjUiIGQ9Ik03NC4wNSAxNDAuMDNWMTI5LjQ2QzQzLjM3IDEzMiAxNi40NiAxNDkuMjggMC4wNTk5OTc2IDE3NC41M1YyMTMuOThDMC4wNTk5OTc2IDE3My43MiAzMy44OSAxNDAuNTggNzQuMDUgMTQwLjAzWiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTM3LjAzIDIxMy45OEMxOS4wNiAyMTMuOTggNC4wODk5OCAyMjYuNzkgMC43Mjk5OCAyNDMuNzdDOS4zMTk5OCAyMzYuMTggMjAuNDEgMjMxLjYgMzIuNTMgMjMxLjZINzQuMDZWMjEzLjk4SDM3LjAzWiIgZmlsbD0iYmxhY2siLz4KPC9nPgo8ZyBvcGFjaXR5PSIwLjA1Ij4KPHBhdGggb3BhY2l0eT0iMC41IiBkPSJNNzQuMDUgMTQwLjAzVjEzMC44MUM0My4wMSAxMzMuMTEgMTUuODkgMTUwLjkzIDAuMDU5OTk3NiAxNzYuODRWMjEzLjk4QzAuMDU5OTk3NiAxNzMuNzIgMzMuODkgMTQwLjU4IDc0LjA1IDE0MC4wM1oiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0zNy4wMyAyMTMuOThDMTkuNiAyMTMuOTggNS4wMDAwMSAyMjYuMDMgMS4wNzAwMSAyNDIuMjRDOS41NDAwMSAyMzQuMjYgMjAuNzcgMjI5LjM5IDMzLjA5IDIyOS4zOUg3NC4wNVYyMTMuOTdIMzcuMDJMMzcuMDMgMjEzLjk4WiIgZmlsbD0iYmxhY2siLz4KPC9nPgo8ZyBvcGFjaXR5PSIwLjA1Ij4KPHBhdGggb3BhY2l0eT0iMC41IiBkPSJNNzQuMDUgMTQwLjAzVjEzMi4xNkM0Mi42IDEzNC4yMiAxNS4yMiAxNTIuNjUgMC4wNTk5OTc2IDE3OS4zMlYyMTMuOThDMC4wNTk5OTc2IDE3My43MiAzMy44OSAxNDAuNTggNzQuMDUgMTQwLjAzWiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTM3LjAzIDIxMy45OEMyMC4xNSAyMTMuOTggNS45Mjk5OCAyMjUuMjggMS40Nzk5OCAyNDAuNzFDOS43OTk5OCAyMzIuMzQgMjEuMTQgMjI3LjE5IDMzLjY2IDIyNy4xOUg3NC4wNlYyMTMuOThIMzcuMDNaIiBmaWxsPSJibGFjayIvPgo8L2c+CjxnIG9wYWNpdHk9IjAuMDUiPgo8cGF0aCBvcGFjaXR5PSIwLjUiIGQ9Ik03NC4wNSAxNDAuMDNWMTMzLjUyQzQyLjEyIDEzNS4zMSAxNC40MyAxNTQuNDggMC4wNTk5OTc2IDE4Mi4wMVYyMTMuOThDMC4wNTk5OTc2IDE3My43MiAzMy44OSAxNDAuNTggNzQuMDUgMTQwLjAzWiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTM3LjAzIDIxMy45OEMyMC43MiAyMTMuOTggNi44ODAwMSAyMjQuNTQgMS45NTAwMSAyMzkuMTlDMTAuMDggMjMwLjQ0IDIxLjUzIDIyNC45OSAzNC4yMSAyMjQuOTlINzQuMDZWMjEzLjk4SDM3LjAySDM3LjAzWiIgZmlsbD0iYmxhY2siLz4KPC9nPgo8ZyBvcGFjaXR5PSIwLjA1Ij4KPHBhdGggb3BhY2l0eT0iMC41IiBkPSJNNzQuMDUgMTQwLjAzVjEzNC44OUM0MS41MyAxMzYuMzkgMTMuNDcgMTU2LjQ2IDAuMDU5OTk3NiAxODVWMjEzLjk4QzAuMDU5OTk3NiAxNzMuNzIgMzMuODkgMTQwLjU4IDc0LjA1IDE0MC4wM1oiIGZpbGw9ImJsYWNrIi8+CjxwYXRoIGQ9Ik0zNy4wMyAyMTMuOThDMjEuMjggMjEzLjk4IDcuODM5OTkgMjIzLjgzIDIuNDg5OTkgMjM3LjdDMTAuNCAyMjguNTYgMjEuOTIgMjIyLjc5IDM0Ljc4IDIyMi43OUg3NC4wNlYyMTMuOThIMzcuMDNaIiBmaWxsPSJibGFjayIvPgo8L2c+CjxnIG9wYWNpdHk9IjAuMDUiPgo8cGF0aCBvcGFjaXR5PSIwLjUiIGQ9Ik03NC4wNSAxNDAuMDNWMTM2LjI5QzQwLjc4IDEzNy40OCAxMi4yNCAxNTguNjggMC4wNTk5OTc2IDE4OC40N1YyMTMuOThDMC4wNTk5OTc2IDE3My43MiAzMy44OSAxNDAuNTggNzQuMDUgMTQwLjAzWiIgZmlsbD0iYmxhY2siLz4KPHBhdGggZD0iTTM3LjAzIDIxMy45OEMyMS44NSAyMTMuOTggOC44MDk5OSAyMjMuMTMgMy4xMDk5OSAyMzYuMjFDMTAuNzQgMjI2LjY4IDIyLjM0IDIyMC41OSAzNS4zNSAyMjAuNTlINzQuMDZWMjEzLjk4SDM3LjAzWiIgZmlsbD0iYmxhY2siLz4KPC9nPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzdfODQiPgo8cmVjdCB3aWR0aD0iNzM0LjA3IiBoZWlnaHQ9IjI4OC4wMSIgZmlsbD0id2hpdGUiLz4KPC9jbGlwUGF0aD4KPC9kZWZzPgo8L3N2Zz4K",
      ),
    );
    this.logo.anchor.set(0.5);
    this.logo.width = 180;
    this.logo.height = 180;
    this.addChild(this.logo);

    this.title = new Text({
      text: "Tam Quốc Sát",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 44,
        fontWeight: "bold",
        fill: 0xf3e5c8,
        align: "center",
        letterSpacing: 3,
      },
    });
    this.title.anchor.set(0.5);
    this.addChild(this.title);

    this.subtitle = new Text({
      text: "Standard 2013",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 20,
        fill: 0xc59a45,
        align: "center",
        letterSpacing: 4,
      },
    });
    this.subtitle.anchor.set(0.5);
    this.addChild(this.subtitle);

    this.portNote = new Text({
      text: "Bản Việt hóa port lại từ dự án QSanguosha",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 13,
        fill: 0x9a836b,
        align: "center",
      },
    });
    this.portNote.anchor.set(0.5);
    this.addChild(this.portNote);

    this.credit = new Text({
      text: "Credit: QSanguosha",
      style: {
        fontFamily: GAME_FONT_FAMILY,
        fontSize: 12,
        fill: 0x9a836b,
        align: "right",
      },
    });
    this.credit.anchor.set(1, 1);
    this.addChild(this.credit);

    this.barBack = new Graphics();
    this.barFill = new Graphics();
    this.addChild(this.barBack);
    this.addChild(this.barFill);
    this.drawBar(0.2);
  }

  public onLoad(progress: number) {
    this.drawBar(Math.min(1, Math.max(0, progress)));
  }

  private drawBar(progress: number): void {
    const height = 10;
    const radius = height / 2;
    this.barBack.clear();
    this.barBack
      .roundRect(-this.barWidth / 2, -height / 2, this.barWidth, height, radius)
      .fill({ color: 0x3d3d3d, alpha: 0.55 });
    this.barFill.clear();
    if (progress > 0) {
      const fillWidth = Math.max(height, this.barWidth * progress);
      this.barFill
        .roundRect(-this.barWidth / 2, -height / 2, fillWidth, height, radius)
        .fill({ color: 0xc59a45 });
    }
  }

  /** Resize the screen, fired whenever window size changes  */
  public resize(width: number, height: number) {
    const scale = Math.max(width / 1024, height / 1024);
    this.background.scale.set(scale);
    this.background.anchor.set(0.5);
    this.background.position.set(width / 2, height / 2);

    this.title.position.set(width * 0.5, 84);
    this.subtitle.position.set(width * 0.5, 124);
    this.portNote.position.set(width * 0.5, 154);
    this.logo.position.set(width * 0.5, height * 0.5 - 30);
    this.barBack.position.set(width * 0.5, height * 0.5 + 130);
    this.barFill.position.copyFrom(this.barBack.position);
    this.credit.position.set(width - 24, height - 18);
  }

  /** Show screen with animations */
  public async show() {
    this.alpha = 1;
  }

  /** Hide screen with animations */
  public async hide() {
    await animate(this, { alpha: 0 } as ObjectTarget<this>, {
      duration: 0.3,
      ease: "linear",
      delay: 1,
    });
  }
}
