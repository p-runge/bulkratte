import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/server";
import { getIntl } from "@/lib/i18n/server";
import { TRPCError } from "@trpc/server";
import { ArrowLeft, Lock, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
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

  const intl = await getIntl();

  let userSet;
  try {
    userSet = await api.userSet.getById({ id: userSetId });
  } catch (error: unknown) {
    if (!(error instanceof TRPCError)) {
      throw error;
    }

    switch (error.code) {
      case "FORBIDDEN": {
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
      case "NOT_FOUND":
        {
          notFound();
        }
      default:
        throw error;
    }



  }

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
