// Counts visits and games with GoatCounter, the privacy-friendly counter of the website:
// no cookies and no personal data. It runs only on giuseppemuschetta.com, so playing on
// your own computer, or in the tests, is never counted.

const COUNTER = 'https://giuseppemuschetta.goatcounter.com/count';
const live = /(^|\.)giuseppemuschetta\.com$/.test(location.hostname);

/** Loads the counter, which records the visit to this page. */
export function startCounting() {
  if (!live) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.dataset.goatcounter = COUNTER;
  document.head.append(script);
}

/** Counts an event, such as a game started or finished. */
export function track(name) {
  try {
    window.goatcounter?.count?.({ path: `polyfit-${name}`, title: `PolyFit ${name}`, event: true });
  } catch {
    // never let analytics get in the way of the game
  }
}
