import { notFound } from "next/navigation";
import { ownerRead } from "./owner-session";
import { DomainError } from "@root-of-cambodia/backend/errors";
export async function reviewerRead<T>(read: () => Promise<T>): Promise<T> {
  const result = await ownerRead(async () => {
    try {
      return {
        data: await read(),
      };
    } catch (error) {
      if (error instanceof DomainError && error.code === "not_found")
        return null;
      throw error;
    }
  });
  if (!result) notFound();
  return result.data;
}
