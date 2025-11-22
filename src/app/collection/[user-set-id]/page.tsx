import Link from "next/link";
import { EditUserSetPageContent } from "./_components/content";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getIntl } from "@/lib/i18n/server";
import { api } from "@/lib/api/server";

export default async function EditUserSetPage({
  params,
}: {
  params: Promise<{ ["user-set-id"]: string }>;
}) {
  const { ["user-set-id"]: userSetId } = await params;
  if (!userSetId) {
    return null;
  }
  const userSet = await api.userSet.getById({ id: userSetId });

  const intl = await getIntl();

  return <>
    <div className="flex items-center gap-4 mb-6">
      <Link href="/collection">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </Link>
      <div>
        <h1 className="text-3xl font-bold">
          {intl.formatMessage({
            id: "userSet.title.edit",
            defaultMessage: "Edit Set",
          })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {intl.formatMessage({
            id: "userSet.subtitle",
            defaultMessage: "Name your set and select cards to add",
          })}
        </p>
      </div>
    </div>
    <EditUserSetPageContent userSet={userSet} />
  </>;
}
