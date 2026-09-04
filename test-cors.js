import { Server } from 'boardgame.io/server';
try {
  const s = Server({ games: [], origins: ['*'] });
  console.log("Success with ['*']");
} catch (e) {
  console.error("Error", e);
}
try {
  const s2 = Server({ games: [], origins: '*' });
  console.log("Success with '*'");
} catch (e) {
  console.error("Error with '*'", e);
}
process.exit(0);
