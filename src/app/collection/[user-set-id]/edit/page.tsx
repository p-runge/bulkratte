import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/server";
import { auth } from "@/lib/auth";
import { getIntl } from "@/lib/i18n/server";
import { ArrowLeft, Lock } from "lucide-react";
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

  const session = await auth();
  const intl = await getIntl();

  // First, check if the user set exists and if the user has access
  let userSet;
  try {
    userSet = await api.userSet.getById({ id: userSetId });
  } catch (error: any) {
    // If forbidden, show private screen
    if (error.code === "FORBIDDEN") {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Lock className="h-6 w-6 text-muted-foreground" />
              </div>
              <CardTitle>
                {intl.formatMessage({
                  id: "page.user_set.private.title",
                  defaultMessage: "This Set is Private",
                })}
              </CardTitle>
              <CardDescription>
                {intl.formatMessage({
                  id: "page.user_set.private.description",
                  defaultMessage: "This collection set is private and can only be viewed by its owner.",
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Link href="/collection">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {intl.formatMessage({
                    id: "page.user_set.private.back",
                    defaultMessage: "Back to My Collection",
                  })}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }
    // Re-throw other errors
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
