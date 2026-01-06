import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/server";
import { getIntl } from "@/lib/i18n/server";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { UserSetContent } from "./_components/user-set-content";

export default async function UserSetPage({
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

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/collection">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-4">
          {userSet.set.image && (
            <img
              src={userSet.set.image}
              alt={userSet.set.name}
              className="w-16 h-16 object-contain rounded border"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold">{userSet.set.name}</h1>
            <p className="text-muted-foreground mt-1">
              {intl.formatMessage({
                id: "page.set.detail.description",
                defaultMessage: "Place your cards into this set",
              })}
            </p>
          </div>
        </div>

        <div className="ml-auto">
          <Link href={`/collection/${userSetId}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4 mr-2" />
              {intl.formatMessage({
                id: "page.set.action.edit",
                defaultMessage: "Edit Set",
              })}
            </Button>
          </Link>
        </div>
      </div>

      <UserSetContent userSetId={userSetId} />
    </>
  );
}
