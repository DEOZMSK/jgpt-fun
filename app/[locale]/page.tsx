import {notFound,redirect} from "next/navigation";
export default async function Home({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(locale!=="ru"&&locale!=="en")notFound();redirect(`/${locale}/astrology/home`);}
