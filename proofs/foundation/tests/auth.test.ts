import assert from "node:assert/strict";
import {test} from "node:test";
import {getMigrations} from "better-auth/db/migration";
import {randomBytes,randomUUID} from "node:crypto";
import {database} from "./support";
import {makeAuth,emailFixtureSQL} from "../src/auth";

test("Better Auth native D1: signup, blocked unverified login, verification, session, reset",async()=>{
  const proxy=await database(randomUUID());
  const baseURL="http://localhost:8787";
  const auth=makeAuth(proxy.env.DB,{secret:randomBytes(32).toString("hex"),baseURL,mode:"local"});
  const migrations=await getMigrations(auth.options); await migrations.runMigrations();
  await proxy.env.DB.prepare(emailFixtureSQL).run();
  const request=(path:string,body?:unknown,cookie?:string)=>auth.handler(new Request(baseURL+"/api/auth/"+path,{
    method:body?"POST":"GET",headers:{"Content-Type":"application/json",Origin:baseURL,...(cookie?{Cookie:cookie}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }));
  const email="local-proof@example.invalid";
  const password="LocalOnly-Password-123!";
  try {
    const signup=await request("sign-up/email",{name:"Proof Guest",email,password});
    assert.equal(signup.status,200);
    const blocked=await request("sign-in/email",{email,password});
    assert.equal(blocked.status,403);
    const mail=await proxy.env.DB.prepare("SELECT url FROM proof_email WHERE recipient=? AND kind='verify' LIMIT 1").bind(email).first<{url:string}>();
    assert.ok(mail);
    const verified=await auth.handler(new Request(mail.url,{headers:{Origin:baseURL}}));
    assert.ok([200,302].includes(verified.status));
    const signin=await request("sign-in/email",{email,password});
    assert.equal(signin.status,200);
    const cookie=signin.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    assert.ok(cookie);
    const session=await request("get-session",undefined,cookie);
    const sessionData=await session.json() as {user:{emailVerified:boolean}};
    assert.equal(sessionData.user.emailVerified,true);
    const reset=await request("request-password-reset",{email,redirectTo:baseURL+"/reset-password"});
    assert.equal(reset.status,200);
    const resetMail=await proxy.env.DB.prepare("SELECT url FROM proof_email WHERE recipient=? AND kind='reset' LIMIT 1").bind(email).first<{url:string}>();
    assert.ok(resetMail);
    const token=new URL(resetMail.url).pathname.split("/").at(-1);
    const newPassword="LocalOnly-NewPassword-456!";
    assert.equal((await request("reset-password",{token,newPassword})).status,200);
    assert.equal((await request("sign-in/email",{email,password})).status,401);
    assert.equal((await request("sign-in/email",{email,password:newPassword})).status,200);
  } finally {await proxy.dispose();}
});
