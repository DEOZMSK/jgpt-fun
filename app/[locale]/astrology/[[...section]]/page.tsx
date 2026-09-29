import {notFound} from "next/navigation";
import {AstrologyWorkspace} from "../../../en/astrology/AstrologyWorkspace";
const sections=new Set(["","home","charts","new","panchanga","transits","calendar","settings"]);
export async function generateMetadata({params}:{params:Promise<{locale:string;section?:string[]}>}){const {locale,section=[]}=await params;return {alternates:{canonical:`/${locale}/astrology${section.length?'/'+section.join('/'):''}`}};}
export default async function Workshop({params}:{params:Promise<{locale:string;section?:string[]}>}){
 const {locale,section=[]}=await params;if((locale!=="ru"&&locale!=="en")||!sections.has(section.join('/')))notFound();
 return <AstrologyWorkspace locale={locale}/>;
}
