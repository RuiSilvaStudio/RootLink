"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/profile?id=${params.id}`);
  }, [params.id, router]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center text-stone-400">
      Redirecting to profile...
    </div>
  );
}
