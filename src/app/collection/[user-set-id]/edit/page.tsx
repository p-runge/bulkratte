import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/server";
import { getIntl } from "@/lib/i18n/server";
import { TRPCError } from "@trpc/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrivateSet } from "../_components/private-set";
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

  const intl = await getIntl();

  let userSet;
  try {
    userSet = await api.userSet.getById({ id: userSetId });
  } catch (error: unknown) {
    if (error instanceof TRPCError) {
      if (error.code === "FORBIDDEN") {
        return <PrivateSet />;
      }
      if (error.code === "NOT_FOUND") {
        notFound();
      }
    }
    throw error;
  }

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
                id: "page.set.edit.title",
                defaultMessage: "Edit Set",
              })}
            </h1>
            <p className="text-muted-foreground mt-1">
              {intl.formatMessage({
                id: "page.set.edit.description",
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
