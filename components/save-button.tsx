"use client";

import { Button } from "@/components/ui/button";
import { useSavedJobs } from "./saved-jobs-provider";

interface SaveButtonProps {
  id: string;
  slug: string;
  title: string;
  company_name: string;
  className?: string;
}

export function SaveButton({
  id,
  slug,
  title,
  company_name,
  className = "",
}: SaveButtonProps) {
  const { ready, isSaved, toggle } = useSavedJobs();
  const saved = ready && isSaved(id);

  return (
    <Button
      type="button"
      size="sm"
      variant={saved ? "secondary" : "outline"}
      disabled={!ready}
      aria-pressed={saved}
      className={className}
      onClick={() => toggle({ id, slug, title, company_name })}
    >
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
