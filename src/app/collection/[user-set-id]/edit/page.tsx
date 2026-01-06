import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/server";
import { getIntl } from "@/lib/i18n/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DeleteUserSetButton } from "../_components/delete-user-set-button";
import { EditSetContent } from "../_components/edit-set-content";

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

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/collection/${userSetId}`}>
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

        <div className="ml-auto">
          <DeleteUserSetButton userSetId={userSetId} />
        </div>
      </div>
      <EditSetContent userSet={userSet} />
    </>
  );
}
