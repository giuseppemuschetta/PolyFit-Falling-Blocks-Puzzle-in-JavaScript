// The Hall of Fame: players who beat Giuseppe's record and sent him their game.
//
// Each entry is the challenge link the player sent. The link holds their name, the day,
// the pieces and every input: the page replays it in the visitor's browser to get the score,
// so no score is written here and none can be made up. A copy of a game already listed
// (same pieces, same inputs) is ignored, whatever name it carries: the first one stays.
//
// To add a player: check the link opens with "Verified", then add a line at the bottom:
//   { link: 'https://giuseppemuschetta.com/challenge/#c=…', added: '2026-10-26' },

export const HALL_OF_FAME = [];
