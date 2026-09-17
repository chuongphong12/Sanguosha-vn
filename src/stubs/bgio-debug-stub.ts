// Stub for boardgame.io Debug UI — excluded from production bundle.
// boardgame.io/client imports { D as Debug } from this file at runtime,
// but Debug is never mounted when Client is created with debug: false.
export const D = null;
