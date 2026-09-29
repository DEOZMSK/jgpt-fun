// Unknown APIs never fall through to the locale/workshop page route.
const missing = () => Response.json({code:'not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
export const GET=missing;
export const POST=missing;
export const PUT=missing;
export const PATCH=missing;
export const DELETE=missing;
