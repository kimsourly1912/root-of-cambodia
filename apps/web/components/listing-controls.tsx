"use client";
import { useEffect,useRef,useState } from "react";
import type { ListingControls as Controls } from "@root-of-cambodia/backend/listing-control-queries";
import { Button } from "./ui/button";
import { cambodiaTime } from "./booking-format";
export function ListingControls({propertyId,state}:{propertyId:string;state:Controls}) {
  const [hydrated,setHydrated]=useState(false),[confirmed,setConfirmed]=useState(false),[pending,setPending]=useState(false),
    [uncertain,setUncertain]=useState(false),[blocked,setBlocked]=useState(false),[done,setDone]=useState(""),[error,setError]=useState(""),[auth,setAuth]=useState(false);
  const busy=useRef(false),attempt=useRef<{key:string;body:string;action:string}|null>(null);
  const path="/owner/properties/"+propertyId+"/review";
  useEffect(()=>setHydrated(true),[]);
  async function act(action:string) {
    if(!hydrated || !confirmed || busy.current || blocked || done)return;
    if(!attempt.current)attempt.current={key:crypto.randomUUID(),action,body:JSON.stringify({
      action,revision:state.revision,reviewId:state.reviewId,confirmed:true})};
    busy.current=true;setPending(true);setError("");
    try {
      const r=await fetch("/api/owner/properties/"+propertyId+"/listing",{method:"POST",
        headers:{"Content-Type":"application/json","Idempotency-Key":attempt.current.key},body:attempt.current.body});
      if(r.status>=500){setUncertain(true);setError("We couldn’t confirm the result. Keep this tab open and retry the same action.");return;}
      if(!r.ok){
        if(r.status===401||r.status===403){setAuth(true);setUncertain(true);}
        else setBlocked(true);
        setError("The listing, its approval or your access changed. Check the latest status before a new action.");return;
      }
      const receipt=await r.json() as {status:string};
      setDone(receipt.status);setUncertain(false);
    }catch{setUncertain(true);setError("Connection interrupted. Keep this tab open and retry the same action.");}
    finally{busy.current=false;setPending(false);}
  }
  const available=state.canPause||state.canResume||state.canReopen;
  return <section aria-label="Listing visibility" className="my-6 min-w-0 space-y-4 rounded-xl border p-5">
    <h2 className="text-xl font-semibold">Listing visibility</h2>
    <p>Current saved status: <strong className="capitalize">{state.publication}</strong></p>
    {state.canPause && <p>Pausing hides this listing from new guests and stops new online requests. Existing bookings, response deadlines and reserved rooms stay in place.</p>}
    {state.canResume && <p>Resuming makes this same approved listing public again. New requests still need valid terms, prices and available rooms.</p>}
    {state.canReopen&&<p>Starting corrections takes this listing back to a private draft. It stays offline until you confirm the new guest preview and the reviewer approves it. You cannot resume the old approval after starting, even without edits.</p>}
    {state.correctionDraft&&<div className="space-y-3"><p>This correction draft is offline. Save changes, then confirm the guest preview and submit for a fresh review. Existing confirmed guests keep their original saved arrival details.</p>
      <a href={"/owner/properties/"+propertyId} className="inline-block text-primary underline">Edit property draft</a></div>}
    {state.publication==="paused"&&!state.canResume&&<p>Resume is unavailable because this pause or its approval cannot be verified. Existing bookings remain accessible.</p>}
    {available&&!done&&!blocked&&<div className="space-y-4">
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0"
        checked={confirmed} disabled={!hydrated||pending||uncertain} onChange={e=>setConfirmed(e.target.checked)}/>
        <span>I understand the effect on public visibility and existing bookings.</span></label>
      {uncertain ? <Button onClick={()=>act(attempt.current!.action)} disabled={!hydrated||pending}>{pending?"Saving…":"Retry same visibility action"}</Button> :
        <div className="flex flex-wrap gap-3">
          {state.canPause&&<Button onClick={()=>act("pause")} disabled={!hydrated||pending||!confirmed}>{pending?"Saving…":"Pause listing"}</Button>}
          {state.canResume&&<Button onClick={()=>act("resume")} disabled={!hydrated||pending||!confirmed}>{pending?"Saving…":"Resume listing"}</Button>}
          {state.canReopen&&<Button variant="outline" onClick={()=>act("reopen")} disabled={!hydrated||pending||!confirmed}>{pending?"Saving…":"Start corrections"}</Button>}
        </div>}
    </div>}
    {done&&<p role="status">Action saved: {done}. Reload the latest status to see the current listing.</p>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {auth&&<a href={"/sign-in?next="+encodeURIComponent(path)} target="_blank" rel="noopener" className="block text-primary underline">Sign in in a new tab, then retry here</a>}
    {!uncertain&&<a href={path} className="inline-block text-primary underline">Reload listing status</a>}
    {uncertain&&<p className="text-xs">Keep this tab open to preserve the exact action. Reloading or closing it discards the pending attempt; check the latest saved status before choosing a new action.</p>}
    {!!state.history.length&&<details><summary className="cursor-pointer font-medium">Recent visibility history</summary>
      <ol className="mt-3 space-y-2 text-sm">{state.history.map(e=><li key={e.revision}>{e.action==="pause"?"Paused":e.action==="reopen"?"Started corrections":"Resumed"} · {cambodiaTime(e.occurredAt)} Cambodia time</li>)}</ol>
      <p className="mt-2 text-xs">Showing at most the 20 latest visibility actions.</p>
    </details>}
  </section>;
}
