// Settings of the challenge that are not game rules.

// Giuseppe's record, shown on the start screen and in the results (null hides it).
// Set by hand after a real game: the browser keeps each player's best score only on
// their own device, so a score made at home must be written here to appear online.
export const RECORD = { score: 25147, lines: 44, level: 5, date: '2026-10-24' };

// A game of Giuseppe's as a challenge link (from "Challenge a friend" in its results):
// "Race my record game" then plays against it, on the same pieces. Empty hides the button.
// When it is set, RECORD must hold the same score.
export const RECORD_LINK = 'https://giuseppemuschetta.com/challenge/#c=zHZNvSNR3HMd5f363OepJQSDc4H4XKPy-94UT7vv7wgl-_bI76LxxB-bB_UAUfgenYwZNNoXwgaZe7co4XGE7cuIycU2sdDZZBSVbIzeEMHqwljsaklkkbW6suQzG9ejz4PPg_YfXG8Cj0eX3Yb0T-7D7k7bOzrbVt2c9bZlVmHWsgNbkgPGrsW18_F5j2zblcIWq_iYZXkDKltF1mDdRjVMQFvMp9zjpAPfz3mWK16xhFk89BfD18jNkultI1WTuokcHuM3dAWMHfA4FVAZ47SJ0pj2eXiAWYhazRDBHZt4jfCwxQjnIfcoym01L-ISPDSHLDjCf8on0OM1hGqxdpktIHTAt4b6gr3ADQ_QAE9A2T39HurYA3qD9qfADXKQS4g2pI8fIewZFyID2a3cN31YsQjbtzyxBTGGEbmMJB2uaze55ug-ZRwk62Xf4ElX9DN51h5bAQqIs3_Uj7uIo3aF2bvM8tmkBF6lyDj9VvKByH6pjh5il9imLhVjkT6NT-kcpOE9jmCE1i34qQiczE4i7t4wWHdDuZYon-xZI1LEidKQEvgSVHICyRORG2W7dBfIOGg2jtOeVcQYnUMA1Cq5QZhOHXiLp5MADMiDdZ9Sag4w8N3Ri1hOz2HX005W3HtIMdL1MbGIAbXlskYh2OydwFsynarKxXSpxD8pXdv2F8cHvnn89vF7aqSJ07zmS0ayyYunrno-SB17BO09l9Rnw0xihdr0OEXoCbz9tovsqzALkadyqmKdOmR6irLDUEeX9hlahnH8Mbks_D-iOHaSaWoeN3XudsxCW8Kn0ZZIB6eezuI_4ElR1xnkT3axtFCHhY-4iWk-hTIeaQg6yXiYnwBtVYpJ0dBGpzEl6TE3S5n7tjpPTLnsfUiar0t-_AVK6myiB5zFE3Vch6lit43xZpnIKyyRrWz6l8Aaxs1DhJ8Y0VGKZtM1tnV6hHmnLwP7MSZo0TL8OaL_0645BowTpDhuqulGFWGKL3t19lE4bMvE1NYxScIQOmyFmvcmVxypUbdMPFMxRLGuG2C9YJn0TKo9zlIo-pKeeMZRIWCKPR5RaISeTHMNVXKCqW0b2GHmLpCLHSddzW4YnSW-gfGRimF4j-Iy00_Ia3mFqje6gsmIG0r1nFChWM0_t18g7AFEnQrHIoNHMJpAawCXyrkM16eo15KAD8fQMHdwV69TlFv1_oWodIuo4fXdxCswS6R3w6AOUwarXiT-gbqNIyhLPsQCZo_PYe5J6tM2n8BLj5RVId54e0yFnC9zmXefoM9qzAd2okhuQHeeNQ8nuIsVqDv-G4H36HL62qn6aButaoSWI8H-I_Q8';

// Where "See my projects" leads.
export const PROJECTS_URL = 'https://giuseppemuschetta.com/#work';

// Where a player who beat the record sends the game. The address is put together here,
// as on the website, so it never sits whole in a page.
export const EMAIL = ['giuseppe', 'muschetta'].join('.') + String.fromCharCode(64) + ['pm', 'me'].join('.');
export const LINKEDIN_URL = 'https://www.linkedin.com/in/giuseppemuschetta/';
