"use client";
import AreaError from "@/components/admin/members/AreaError";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <AreaError retry={retry} />;
}
