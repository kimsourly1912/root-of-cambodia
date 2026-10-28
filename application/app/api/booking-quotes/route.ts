import { endpoint } from "../../../src/http";
import { quote } from "../../../src/quotes";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return endpoint(request, true, async ({ db, actor, body }) => {
    const q = await quote(db, actor, body);
    return {
      hash: q.hash,
      input: q.input,
      totalCents: q.totalCents,
      currency: "USD",
      charges: q.charges,
      policy: {
        version: q.property.policy_version,
        text: q.property.policy_text,
      },
      lines: q.lines.map((l) => ({
        selection: l.selection,
        roomName: l.room.name,
        rates: l.rates.map((r) => ({
          night: r.night,
          unitCents: r.unit_cents,
        })),
      })),
    };
  });
}
