import { getCloudflareContext } from "@opennextjs/cloudflare";
import { makeAuth } from "./auth";
export async function runtime() {
  const {env}=await getCloudflareContext({async:true});
  if(env.PROOF_MODE!=="local") throw new Error("Local proof fixture only.");
  return {env,auth:makeAuth(env.DB,{secret:env.BETTER_AUTH_SECRET,baseURL:env.AUTH_URL,mode:env.PROOF_MODE})};
}
