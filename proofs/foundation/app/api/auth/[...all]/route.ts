import { runtime } from "../../../../src/runtime";
export const dynamic="force-dynamic";
async function handler(request:Request) {return (await runtime()).auth.handler(request);}
export {handler as GET,handler as POST};
