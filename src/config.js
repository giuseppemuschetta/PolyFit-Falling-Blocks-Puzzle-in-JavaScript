// Settings of the challenge that are not game rules.

// Giuseppe's record, shown on the start screen and in the results (null hides it).
// Set by hand after a real game: the browser keeps each player's best score only on
// their own device, so a score made at home must be written here to appear online.
export const RECORD = { score: 27638, lines: 46, level: 5, date: '2026-10-26' };

// A game of Giuseppe's as a challenge link (from "Challenge a friend" in its results):
// "Race my record game" then plays against it, on the same pieces. Empty hides the button.
// When it is set, RECORD must hold the same score.
export const RECORD_LINK = 'https://giuseppemuschetta.com/challenge/#c=zJZJfSFt3HMU536vdnyLYh2xgwSwQ4d5cSCC_-4MrePODKzReiDAtRLApKKQZW8BdmAGXB0NsLIq2E__NFaou7ZZNhS2k-rDM2nZ069hQkK4s6NaCoC1U1urQsdlupHs7D4dz-BwOgI1_Dz6E59Xgu4kPztn2uZVjUaOL-R09xiiegoWzcDXxxmvE_5YukOUR5iMI73WciW-DhR7B2sINGN6LUh-cfnayrT3YncMRLF_8JnjoTxLhMSyAa0JP0w201MXjzT0mPnstQ8xcpgWoGg-X0IeW6JnWr6jnfc8-Oual-CpmKI805TAsXSKjrmcHvfNS5Dmqlyna4jdk5t1C1wGOf09Z-hHuNcS4xjXLLGGPfoN78ZUhmoLwWPohEl1Bc4aSvIQyixo-L0V44P_e2_TOdIXQznYs0wgJPUvMnUceDyqKlXlcIxHawiz-Qc2iZKsBXpdoVQO8-wsq0BQ5pspUAR5Qd-gy8S5nDiWkGtfQ2TYHRTZCR-CaambJ4Tdqgx1XsEHjdI8cDWwAq5La5IoaMgvnkHyOmsuk-lqFpobXUETcFgGu_1UhWl2nnH6mF6gP_dSxhRyG4ZRZXfwOeov4VDoC13ekmEtTA8JXQox3l2Dvo3pFauWaagvvBA0iPglmjhD3WOaK1CQ0_pbQh2gbSu8SHeD4IbbKhZrwltDVIhsyM9N0iFSEx4S7iFkES_iBJig1B8WvyCy0DlZr5DEgfUc1TyqYuUfGEN2DpfETiSTXREzoGVKSLlmRFfk83AvEZGMJwszgE3RGrkKfoUTE8nC9hDkoeoHGMIZEWx-ewZ3HMJQGRTb0IcqCt_2KEXq5u82b1OZJMFvou3gs5RB7udrpDOqqUp32T9D3IHxJq3cNNg-VyjEyq2XeKWL6HIyT2wi-zmRmblbyImK3EC7Q2-wj6Q_KQrhnqGyJr0PRl6l8uW_pLowcZtFP7qcwGpwNjgGkKTWGORjeNeyhqjOxBN79kLg7Te2GrJRRHpI4kVQ1rvFvMEGtv8Dcrdwgm8fe_J2MUfTBGMQ4XZCC9ZPop-oCXUFqCq73Jo7tIspkJjP3BNlCs8zpigd4gl3MwnHK2WNUl5Xh3cU0FZHHEnhADVjX4axP0zCYnzWmokrj1_hYindu4hlqXpBanyHFl8ihQPclZ-M2lNAYIkKz9FWJZ-C6Ko3hPlnemzjblqZBpEbxgoT7S0reQvPn-JnGqeq2xDbBzC34-8k7QZcgIsI_j3UoNXdwF4Y5iCweo3oXCxAe_gb3XpSysMJzMHz-fnLnYKu-eGQfNUO0hgGJa1ZzBqfrEwNYlNr_Aw';

// Where "See my projects" leads.
export const PROJECTS_URL = 'https://giuseppemuschetta.com/#work';

// Where a player who beat the record sends the game. The address is put together here,
// as on the website, so it never sits whole in a page.
export const EMAIL = ['giuseppe', 'muschetta'].join('.') + String.fromCharCode(64) + ['pm', 'me'].join('.');
export const LINKEDIN_URL = 'https://www.linkedin.com/in/giuseppemuschetta/';
