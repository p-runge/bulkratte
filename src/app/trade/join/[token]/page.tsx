"use client";

import Loader from "@/components/loader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api/react";
import { TRPCClientError } from "@trpc/client";
import { CheckCircle, Clock, Link2Off } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { FormattedMessage } from "react-intl";

export default function TradeJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: currentUser } = api.getCurrentUser.useQuery(undefined, {
    retry: false,
  });

  const {
    data: preview,
    isLoading,
    error: previewError,
  } = api.tradeConnection.getInvitePreview.useQuery({ token });

  const acceptMutation = api.tradeConnection.accept.useMutation({
    onSuccess: ({ connectionId }) => {
      router.push(`/trade/${connectionId}`);
    },
    onError: (err) => {
      setError(err.message);
      setAccepting(false);
    },
  });

  const declineMutation = api.tradeConnection.decline.useMutation({
    onSuccess: () => {
      router.push("/");
    },
    onError: (err) => {
      setError(err.message);
      setDeclining(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (
    previewError instanceof TRPCClientError &&
    previewError.data?.code === "NOT_FOUND"
  ) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
        <Link2Off className="h-12 w-12" />
        <p className="text-lg font-medium">
          <FormattedMessage
            id="trade.join.notFound"
            defaultMessage="This invite link is invalid or has been removed."
          />
        </p>
      </div>
    );
  }

  if (!preview) return null;

  if (preview.status === "accepted") {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium">
          <FormattedMessage
            id="trade.join.alreadyAccepted"
            defaultMessage="This invite has already been accepted."
          />
        </p>
      </div>
    );
  }

  const initials = preview.requesterName
    ? preview.requesterName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex min-h-64 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3 text-center">
          <Avatar className="h-16 w-16">
            <AvatarImage src={preview.requesterImage ?? undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <CardTitle>
            <FormattedMessage
              id="trade.join.title"
              defaultMessage="{name} wants to trade with you"
              values={{ name: preview.requesterName ?? "Someone" }}
            />
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center text-sm text-muted-foreground">
          <FormattedMessage
            id="trade.join.description"
            defaultMessage="Accepting this invite will let both of you see each other's wantlists and find cards to trade."
          />
        </CardContent>

        {error && (
          <CardContent>
            <p className="text-center text-sm text-destructive">{error}</p>
          </CardContent>
        )}

        <CardFooter className="flex flex-col gap-2">
          {currentUser ? (
            <>
              {currentUser.id === preview.requester_id ? (
                <p className="text-sm text-muted-foreground">
                  <FormattedMessage
                    id="trade.join.ownInvite"
                    defaultMessage="This is your own invite link — share it with someone else."
                  />
                </p>
              ) : (
                <>
                  <Button
                    className="w-full"
                    disabled={accepting || declining}
                    onClick={() => {
                      setAccepting(true);
                      setError(null);
                      acceptMutation.mutate({ token });
                    }}
                  >
                    <FormattedMessage
                      id="trade.join.accept"
                      defaultMessage="Accept trade invite"
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={accepting || declining}
                    onClick={() => {
                      setDeclining(true);
                      setError(null);
                      declineMutation.mutate({ token });
                    }}
                  >
                    <FormattedMessage
                      id="trade.join.decline"
                      defaultMessage="Decline"
                    />
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button className="w-full" asChild>
              <a href={`/auth/signin?callbackUrl=/trade/join/${token}`}>
                <FormattedMessage
                  id="trade.join.signIn"
                  defaultMessage="Sign in to accept"
                />
              </a>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
