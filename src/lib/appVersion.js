// Single source of truth for the app version (S14).
// Header, SplashScreen, InfoPages (About) and any other place that shows
// the version must import APP_VERSION from here — never hardcode it.
// The version itself lives in package.json; bump that file only.
import pkg from '../../package.json'

export const APP_VERSION = pkg.version
export default APP_VERSION
