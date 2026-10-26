// Settings of the challenge that are not game rules.

// Giuseppe's record, shown on the start screen and in the results (null hides it).
// Set by hand after a real game: the browser keeps each player's best score only on
// their own device, so a score made at home must be written here to appear online.
export const RECORD = { score: 26274, lines: 45, level: 5, date: '2026-10-26' };

// A game of Giuseppe's as a challenge link (from "Challenge a friend" in its results):
// "Race my record game" then plays against it, on the same pieces. Empty hides the button.
// When it is set, RECORD must hold the same score.
export const RECORD_LINK = 'https://giuseppemuschetta.com/challenge/#c=zHZPva1pnHMU538fKxig42A9wECMo5F7BgtcHDGgeuIGpTMEoeEF8EaHtmEImzMDwRZ1NZtPZpFmCjc1iJWaQpRRGoWtLN0rKGpL5ZswtXbMs6YjkF6xkaQpuNBvD_gOHc87nHAC_z2jvQX7F-8HgR2fS6TNT-iuQ3NIOlFMNeFwNKEsIKQ4leo1-0wnZ1inUUeYTMpdF8hh-S5Ge4jz6HMoI1qkBpcvkkLqUETTxJ754dZu0LSxTmDu5NXFW9H_DyuCuTYhO82B8FTVSDuk2uNMs-wMlSsSUTJlMwdDPMPxNQ-x7XersPozLL3UlexNjMI_BL_uTm_TmCEr6bzHOlDUs0CaE2kINb9cQeab7jyK_QDhFpokVXCVDA31T1IJ2C9INUrq_ojzNI1gH7xTRPZJ6H7AqXYfikAIF4r2JJQSXaQu3wU-FL5B-g41BhDxqlTZoTX8fuzA0Mc367CvwWge13CRuYRf2Mnm6pA6v4R-qIFUgYZ9EXJwrMG_m1xO5XJY7bU6bLPr3wG_i9BwZp0m8JexPUUFKS3PZJgtLEzdRBr8Bm6uF-L8w_sVmWegFDFuM95iX4Hvd3FsHD2zTDqQuxVIHV5tYxBEsO_DMoEqDQe0-JC10CH2eYkqH0qHYZ9k80pEahFpgUocnmqdlSgWnWBNalss2ZxvpOvmOYLxLEVeB5iDbzkOawQJ9phOuFSjdwS1cZ2OkvPNum8M67VKeLkFxm9JcrSHSG0xH4kKtg8u8UwT2YJO5U7iaiF0lQ5HGSUTHyJSrgffG-VkRXUNIckgxT6bYRt5_iR2TZHVvwP4jHrFdWBrwdEgOj_0iwvswvmCJASnLXT9R-AiW6svskkPq8qgH5HsCS4H8Mrcm0ieHYV6BKfAlcac5Oc6UIuWyXPbLIrNAB3QMczCV5udK1LOPQJ2UZAvXaIi13a7CPqeLC5l3cnsTedK0AckhdSe0LeQp9CkZyqS84TXukek7ylP8CSxDrEoJ7SFKtNMexAG5D2G8yzyZbRqGuV2DekxS5jmtwtJCWLj-INGdiN-BuoZUnPe38InuAhkmmDmmuF-bwCybpvfXoPsaFeTC5sFFmH38or5tZRg8mKoguw_XPXaygmEIJ5_AFJtEqg5Rh1CrdHoUDXiiRVpp79iaeIgqPcZzEpYSDUgd3uTnJ7Rn8KtTrIUyIj3cNY_QHTIOsYEfsAi_67Lu40NYihT7MKREC0xym2qwyf4CcfUR8Qp8RzAUKJIV8Yj1MUrtS97DKNN6LuMKvMn_AQ';

// Where "See my projects" leads.
export const PROJECTS_URL = 'https://giuseppemuschetta.com/#work';

// Where a player who beat the record sends the game. The address is put together here,
// as on the website, so it never sits whole in a page.
export const EMAIL = ['giuseppe', 'muschetta'].join('.') + String.fromCharCode(64) + ['pm', 'me'].join('.');
export const LINKEDIN_URL = 'https://www.linkedin.com/in/giuseppemuschetta/';
