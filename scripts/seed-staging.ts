// Trusted staging operator only. Never bundled; no public bootstrap endpoint.
// Uses normal application HTTPS APIs after a narrow fixture-account bootstrap.
import {readFile,writeFile,mkdtemp,rm} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {hashPassword,verifyPassword} from "better-auth/crypto";
import {STAGING_ACCOUNTS} from "../apps/web/server/staging-accounts";
import {STAGING_TERMS,STAGING_TERMS_VERSION,type StagingCredential} from "./staging-fixtures";
import {photoDigest} from "@root-of-cambodia/backend/media";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),origin="https://staging.rootsofcambodia.com";
const args=process.argv.slice(2);
if(args.length!==3||!["--bootstrap","--populate"].includes(args[0])||args[1]!=="--credentials") throw new Error("Use --bootstrap or --populate --credentials <private JSON file>");
const credentials=JSON.parse(await readFile(args[2],"utf8")) as StagingCredential[];
if(credentials.length!==3||new Set(credentials.map(c=>c.id)).size!==3||credentials.some(c=>!STAGING_ACCOUNTS.some(a=>a.id===c.id)||typeof c.password!=="string"||c.password.length<24||c.password.length>128)) throw new Error("Exactly three strong, fictional fixture credentials are required");
const exec=promisify(execFile),sqlString=(v:string)=>"'"+v.replaceAll("'","''")+"'";
async function d1(extra:string[]) {
  const {stdout}=await exec(process.execPath,[path.join(root,"node_modules/wrangler/bin/wrangler.js"),"d1","execute","roc-staging","--config",path.join(root,"apps/web/wrangler.jsonc"),"--env","staging","--remote","--json",...extra],{cwd:root,maxBuffer:4*1024*1024});
  const start=stdout.indexOf("["),parsed=JSON.parse(stdout.slice(start));
  if(!Array.isArray(parsed)||parsed.some(r=>!r.success)) throw new Error("staging_database_command_failed");
  return parsed;
}
async function bootstrap() {
  const state=await d1(["--command","SELECT count(*) n FROM d1_migrations; SELECT id,email FROM user; SELECT userId,password FROM account WHERE providerId='credential'; SELECT reviewer_user_id,terms_version FROM pilot_publication_config; SELECT version,content FROM booking_terms_document"]);
  if(state[0]?.results[0]?.n!==20) throw new Error("Unexpected staging schema");
  const users=state[1].results as {id:string;email:string}[],accounts=state[2].results as {userId:string;password:string}[];
  if(users.some(u=>!STAGING_ACCOUNTS.some(a=>a.id===u.id&&a.email===u.email))) throw new Error("Non-fixture account exists; refusing bootstrap");
  if(state[3].results.some((c:{reviewer_user_id:string;terms_version:string})=>c.reviewer_user_id!==STAGING_ACCOUNTS[2].id||c.terms_version!==STAGING_TERMS_VERSION)||state[4].results.some((t:{version:string;content:string})=>t.version!==STAGING_TERMS_VERSION||t.content!==STAGING_TERMS)) throw new Error("Existing configuration differs; refusing bootstrap");
  const statements:string[]=[];
  for(const identity of STAGING_ACCOUNTS) {
    const credential=credentials.find(c=>c.id===identity.id)!,old=accounts.find(a=>a.userId===identity.id);
    if(old) {if(!await verifyPassword({hash:old.password,password:credential.password})) throw new Error("Existing credentials differ; refusing overwrite");continue;}
    if(users.some(u=>u.id===identity.id)) throw new Error("Incomplete fixture identity; inspect before retry");
    const hash=await hashPassword(credential.password),now=Date.now();
    statements.push(`INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES(${sqlString(identity.id)},${sqlString(identity.name)},${sqlString(identity.email)},1,${now},${now});`);
    statements.push(`INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(${sqlString(identity.id+":credential")},${sqlString(identity.id)},'credential',${sqlString(identity.id)},${sqlString(hash)},${now},${now});`);
  }
  statements.push(`INSERT INTO booking_terms_document(version,content) VALUES(${sqlString(STAGING_TERMS_VERSION)},${sqlString(STAGING_TERMS)}) ON CONFLICT(version) DO NOTHING;`,`INSERT INTO pilot_publication_config(singleton,reviewer_user_id,terms_version) VALUES(1,${sqlString(STAGING_ACCOUNTS[2].id)},${sqlString(STAGING_TERMS_VERSION)}) ON CONFLICT(singleton) DO NOTHING;`);
  const temp=await mkdtemp(path.join(os.tmpdir(),"roc-fixture-bootstrap-"));
  try {const file=path.join(temp,"fixtures.sql");await writeFile(file,statements.join("\n"),{mode:0o600});await d1(["--file",file,"--yes"]);} finally {await rm(temp,{recursive:true,force:true});}
  console.log(JSON.stringify({stagingDatabase:"roc-staging",fictionalAccounts:3,emailDelivery:false}));
}
const day=(night:string,n:number)=>new Date(Date.parse(night+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
async function populate() {
  const statePath=path.join(path.dirname(args[2]),"seed-state.json");
  let state:{start:string;complete?:boolean};
  try{state=JSON.parse(await readFile(statePath,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;state={start:day(new Date().toISOString().slice(0,10),3)};await writeFile(statePath,JSON.stringify(state),{mode:0o600});}
  if(state.complete){console.log("Fixture setup already completed; preserving test edits");return;}
  async function request<T=any>(url:string,cookie="",body?:unknown,key?:string,method=body===undefined?"GET":"POST"):Promise<T> {
    const response=await fetch(origin+url,{method,redirect:"manual",headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(key?{"Idempotency-Key":key}:{}),"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json() as T&{error?:string};
    if(!response.ok)throw new Error(`Staging ${method} ${url}: ${response.status} ${data.error??"request_failed"}`);
    return data;
  }
  const cookies:string[]=[];
  for(const identity of STAGING_ACCOUNTS) {
    const response=await fetch(origin+"/api/auth/sign-in/email",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({email:identity.email,password:credentials.find(c=>c.id===identity.id)!.password})});
    if(!response.ok)throw new Error("staging_fixture_signin_failed_"+identity.role);
    cookies.push(response.headers.getSetCookie().map(c=>c.split(";")[0]).join("; "));
    const session=await request("/api/auth/get-session",cookies.at(-1));if(session?.user?.id!==identity.id)throw new Error("staging_fixture_session_failed");
  }
  const [owner,guest,reviewer]=cookies,properties:{id:string;roomId:string;name:string}[]=[];
  for(const fixture of [{slug:"kampot",name:"Demo Riverside Homestay",km:"ផ្ទះស្នាក់នៅសាកល្បងកំពត",province:"Kampot",cents:2800,publish:true},{slug:"siem-reap",name:"Demo Garden Guesthouse",km:"ផ្ទះសំណាក់សាកល្បងសៀមរាប",province:"Siem Reap",cents:4200,publish:true},{slug:"mondulkiri",name:"Demo Forest Bungalow",km:"បឹងហ្គាឡូសាកល្បងមណ្ឌលគិរី",province:"Mondulkiri",cents:3500,publish:false}]) {
    const prefix="staging-demo-v1:"+fixture.slug+":",property=await request("/api/owner/properties",owner,{ownerName:"Demo property owner",nameKm:fixture.km,nameEn:fixture.name,province:fixture.province,checkinTime:"14:00",checkoutTime:"11:00",policyText:"Fictional staging property. No real guests, accommodation or payments."},prefix+"create"),base="/api/owner/properties/"+property.id;
    let review=await request(base+"/review",owner);
    if(review.latest) {const rooms=await request(base+"/rooms",owner);properties.push({id:property.id,roomId:rooms.items[0].id,name:fixture.name});continue;}
    await request(base+"/information",owner,{description:`${fixture.name} is a fictional property for testing ROOTS OF CAMBODIA. Try its room calendar, booking request and publication workflow.`,address:`Demo Lane, ${fixture.province} (not a real address)`,facilities:["Demo garden","Test Wi-Fi","Sample breakfast"],revision:null},prefix+"info","PATCH");
    await request(base+"/logistics",owner,{latitude:null,longitude:null,contactName:"Demo host",contactPhone:"",contactEmail:"host@roc-staging.invalid",arrivalInstructions:"TEST ONLY: these are sample arrival instructions, not directions to a real property.",revision:null},prefix+"logistics","PATCH");
    const room=await request(base+"/rooms",owner,{name:"Demo garden room",adultCapacity:2,childCapacity:1,totalCapacity:3},prefix+"room");
    for(let offset=0;offset<35;offset+=7)await request(base+"/rooms/"+room.id+"/calendar",owner,{roomRevision:1,nights:Array.from({length:7},(_,i)=>({night:day(state.start,offset+i),capacity:4,blocked:0,unitCents:fixture.cents,inventoryRevision:null,rateRevision:null}))},prefix+"calendar:"+offset,"PATCH");
    const bytes=new Uint8Array(await readFile(path.join(root,"fixtures/staging",fixture.slug+".jpg"))),photo=await request(base+"/photos",owner,{contentType:"image/jpeg",byteSize:bytes.length,sha256:await photoDigest(bytes),revision:null},prefix+"photo");
    const upload=await fetch(origin+base+"/photos/"+photo.id,{method:"PUT",headers:{Origin:origin,Cookie:owner,"Content-Type":"image/jpeg"},body:bytes});
    if(!upload.ok)throw new Error("staging_photo_upload_failed_"+upload.status+"_"+((await upload.json()) as {error?:string}).error);
    review=await request(base+"/review",owner);
    const submitted=await request(base+"/review",owner,{action:"submit",propertyRevision:review.propertyRevision,publicDisclosure:{version:review.publicPreview.version,previewHash:review.publicPreview.previewHash}},prefix+"submit");
    if(fixture.publish){const current=await request("/api/property-reviews/"+submitted.id,reviewer);await request("/api/property-reviews/"+submitted.id,reviewer,{action:"approve",revision:current.request.revision,configRevision:current.configRevision},prefix+"approve");}
    properties.push({id:property.id,roomId:room.id,name:fixture.name});console.log(JSON.stringify({property:fixture.name,state:fixture.publish?"published":"review"}));
  }
  await request("/api/owner/properties",owner,{ownerName:"Demo property owner",nameKm:"សេចក្ដីព្រាងសាកល្បង",nameEn:"Demo New Property Draft",province:"Kep",checkinTime:"14:00",checkoutTime:"11:00",policyText:"Fictional draft for testing. Add rooms, information and a photo, then submit it to the demo reviewer."},"staging-demo-v1:empty-draft");
  for(let i=0;i<2;i++) {
    const p=properties[i],attemptId=`00000000-0000-4000-8000-00000000010${i}`,attemptPath="/api/guest/attempts/"+attemptId;
    const old=await fetch(origin+attemptPath,{headers:{Cookie:guest}});
    let attempt:any;
    if(old.status===404){const input={propertyId:p.id,checkin:day(state.start,3+i*2),checkout:day(state.start,5+i*2),termsVersion:STAGING_TERMS_VERSION,lines:[{roomId:p.roomId,quantity:1,adults:2,children:0}]},q=await request("/api/guest/quote",guest,input);await request(attemptPath,guest,{...input,quoteHash:q.hash});}
    else if(old.ok)attempt=await old.json();else throw new Error("staging_attempt_read_failed");
    // A committed request is preserved, including subsequent tester transitions.
    if(attempt?.receipt)continue;
    const receipt=await request(attemptPath+"/send",guest,{acceptedTerms:true});
    if(i===1){const preview=await request("/api/owner/bookings/"+receipt.id+"/acceptance",owner);await request("/api/bookings/"+receipt.id+"/accept",owner,{acceptanceHash:preview.hash},"staging-demo-v1:accept:"+receipt.id);}
    console.log(JSON.stringify({booking:receipt.id,state:i===1?"confirmed":"pending"}));
  }
  await writeFile(statePath,JSON.stringify({...state,complete:true,properties}),{mode:0o600});
  for(const cookie of cookies)await request("/api/auth/sign-out",cookie,{});
  console.log(JSON.stringify({complete:true,properties:4,bookings:2,availableFrom:state.start,availableUntil:day(state.start,35),emailDelivery:false}));
}
try{if(args[0]==="--bootstrap")await bootstrap();else await populate();}
catch(e){const message=e instanceof Error?e.message:"";console.error(/^(Staging (GET|POST|PATCH)|staging_|Existing |Unexpected |Non-fixture |Incomplete )/.test(message)?message:"staging_fixture_setup_failed");process.exitCode=1;}
