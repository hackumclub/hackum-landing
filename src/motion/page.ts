// Small timing helpers shared by the text/hero animations.

/** Fonts first, so SplitText measures final line breaks (works for Cyrillic webfonts too). */
export const whenFontsReady = () => (typeof document !== "undefined" && document.fonts ? document.fonts.ready.then(() => undefined) : Promise.resolve());
