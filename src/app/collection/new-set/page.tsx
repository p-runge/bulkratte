"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useIntl } from "react-intl";
import { CreateSetContent } from "./_components/create-set-content";

export default function NewSetPage() {
  const intl = useIntl();

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/collection">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">
            {intl.formatMessage({
              id: "page.set.new.title",
              defaultMessage: "Create New Set",
            })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {intl.formatMessage({
              id: "page.set.new.description",
              defaultMessage: "Name your set and select cards to add",
            })}
          </p>
        </div>
      </div>

      <CreateSetContent />
    </>
  );
}
