const COOKIE_NAME = 'tb_logged_in'
const COOKIE_DOMAIN = '.usetimebud.app'

export function setLoggedInCookie() {
  document.cookie = `${COOKIE_NAME}=1; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${60 * 60 * 24 * 365}; Secure; SameSite=Lax`
}

export function clearLoggedInCookie() {
  document.cookie = `${COOKIE_NAME}=; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0; Secure; SameSite=Lax`
}
