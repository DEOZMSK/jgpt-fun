export type SiteLocale='ru'|'en';
export function getSiteLocale(path:string):SiteLocale{return /^\/en(?:\/|$)/.test(path)?'en':'ru';}
export function stripSiteLocale(path:string){return path.replace(/^\/(ru|en)(?=\/|$)/,'')||'/';}
