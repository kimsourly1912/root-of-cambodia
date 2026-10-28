import { betterAuth } from "better-auth";
export function makeAuth(db: D1Database, options: {secret:string;baseURL:string;mode:string}) {
  if(options.mode!=="local") throw new Error("This fixture only supports local proof mode.");
  return betterAuth({
    database: db,
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: [options.baseURL],
    // Cloudflare supplies this header at the ingress; never trust an arbitrary
    // client-supplied forwarded-for chain for the application's abuse controls.
    advanced: {ipAddress:{ipAddressHeaders:["cf-connecting-ip"]}},
    emailAndPassword: {
      enabled:true,
      requireEmailVerification:true,
      autoSignIn:false,
      sendResetPassword:async({user,url})=>{
        await db.prepare("INSERT INTO proof_email(id,recipient,kind,url) VALUES (?,?,?,?)")
          .bind(crypto.randomUUID(),user.email,"reset",url).run();
      }
    },
    emailVerification: {
      sendOnSignUp:true,
      sendOnSignIn:true,
      sendVerificationEmail:async({user,url})=>{
        await db.prepare("INSERT INTO proof_email(id,recipient,kind,url) VALUES (?,?,?,?)")
          .bind(crypto.randomUUID(),user.email,"verify",url).run();
      }
    }
  });
}
export const emailFixtureSQL="CREATE TABLE IF NOT EXISTS proof_email (id TEXT PRIMARY KEY, recipient TEXT NOT NULL, kind TEXT NOT NULL, url TEXT NOT NULL)";
