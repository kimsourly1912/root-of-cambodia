import { getPlatformProxy } from "wrangler";
import { readFile } from "node:fs/promises";
import path from "node:path";
export async function database(name: string) {
  return getPlatformProxy<{ DB: D1Database }>({
    configPath: path.resolve("wrangler.jsonc"),
    remoteBindings: false,
    persist: {path:path.resolve(".wrangler/proof-tests",name)}
  });
}
export async function migrate(db:D1Database) {
  // D1 exec() splits at newlines. Prepare complete trigger statements as a batch instead.
  const schema=await readFile("schema/booking.sql","utf8");
  const statements:string[]=[];
  let buffer="",trigger=false;
  for(const line of schema.split("\n")) {
    if(line.startsWith("CREATE TRIGGER")) trigger=true;
    buffer+=line+"\n";
    if((!trigger && line.trim().endsWith(";")) || (trigger && line.trim()==="END;")) {
      statements.push(buffer.trim()); buffer=""; trigger=false;
    }
  }
  await db.batch(statements.filter(Boolean).map(s=>db.prepare(s)));
}
export async function fixture(db:D1Database, opts:{capacity?:number; blocked?:number; secondNight?:boolean; expires?:number; gap?:boolean; total?:number; unsealed?:boolean}={}) {
  const tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const day2=new Date(Date.now()+(opts.gap?259200000:172800000)).toISOString().slice(0,10);
  const checkout=new Date(Date.now()+(opts.gap?345600000:259200000)).toISOString().slice(0,10);
  const now=Math.floor(Date.now()/1000);
  await db.batch([
    db.prepare("INSERT INTO property VALUES ('p','owner'),('other','other-owner')"),
    db.prepare("INSERT INTO room_type VALUES ('room','p'),('other-room','other')"),
    db.prepare("INSERT INTO inventory_night VALUES ('room',?,?,?,0)").bind(tomorrow,opts.capacity??1,opts.blocked??0),
    ...((opts.secondNight??true)?[db.prepare("INSERT INTO inventory_night VALUES ('room',?,?,0,0)").bind(day2,opts.capacity??1)]:[]),
    ...["a","b"].map(id=>db.prepare("INSERT INTO booking(id,property_id,guest_id,expires_at,checkin_at,checkin_date,checkout_date,expected_nights,total_cents) VALUES (?,'p',?,?,?,?,?,2,?)")
      .bind(id,"guest-"+id,opts.expires??now+43200,Math.floor(Date.parse(tomorrow+'T14:00:00+07:00')/1000),tomorrow,checkout,opts.total??7000)),
    ...["a","b"].flatMap(id=>[tomorrow,day2].map(day=>db.prepare("INSERT INTO requested_night VALUES (?,'room',?,1,3500)").bind(id,day))),
    ...(opts.unsealed?[]:[db.prepare("UPDATE booking SET snapshot_sealed=1")])
  ]);
  return {tomorrow,day2};
}
