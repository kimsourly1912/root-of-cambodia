import { publicEndpoint } from "@/src/public-http";
import { browseStays } from "@root-of-cambodia/backend/catalog-queries";
import { DomainError } from "@root-of-cambodia/backend/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return publicEndpoint(({ DB }) => {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some((key) => params.getAll(key).length !== 1))
      throw new DomainError("invalid_request", 422);
    return browseStays(DB, Object.fromEntries(params));
  });
}
