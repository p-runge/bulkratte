"use client";

import Loader from "@/components/loader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api/react";
import {
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  Lock,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { toast } from "sonner";

export default function TradePage() {
  const intl = useIntl();
  const utils = api.useUtils();

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const { data: currentUser, isLoading: isLoadingUser } =
    api.getCurrentUser.useQuery(undefined, { retry: false });

  const { data: connections, isLoading: isLoadingConns } =
    api.tradeConnection.list.useQuery(undefined, { enabled: !!currentUser });

  const createInviteMutation = api.tradeConnection.createInvite.useMutation({
    onSuccess: async ({ inviteToken }) => {
      await utils.tradeConnection.list.invalidate();
      const url = `${window.location.origin}/trade/join/${inviteToken}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success(
          intl.formatMessage({
            id: "trade.index.inviteCopied",
            defaultMessage: "Invite link copied to clipboard",
          }),
        );
      } catch {
        toast.info(url);
      }
      setCreatingInvite(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setCreatingInvite(false);
    },
  });

  const removeMutation = api.tradeConnection.remove.useMutation({
    onSuccess: () => {
      void utils.tradeConnection.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (isLoadingUser) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-muted-foreground">
        <Lock className="h-12 w-12" />
        <p className="text-lg font-medium">
          <FormattedMessage
            id="trade.index.signInRequired"
            defaultMessage="Please sign in to manage your trade partners."
          />
        </p>
        <Button asChild>
          <a href="/auth/signin">
            <FormattedMessage
              id="trade.index.signIn"
              defaultMessage="Sign in"
            />
          </a>
        </Button>
      </div>
    );
  }

  const accepted = connections?.filter((c) => c.status === "accepted") ?? [];
  const pendingIncoming =
    connections?.filter((c) => c.status === "pending" && !c.isRequester) ?? [];
  const pendingOutgoing =
    connections?.filter((c) => c.status === "pending" && c.isRequester) ?? [];

  async function copyInvite(inviteToken: string) {
    const url = `${window.location.origin}/trade/join/${inviteToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(inviteToken);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.info(url);
    }
  }

  function getInitials(name: string | null | undefined) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            <FormattedMessage
              id="trade.index.heading"
              defaultMessage="Trade Partners"
            />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <FormattedMessage
              id="trade.index.subheading"
              defaultMessage="Share your wantlist and find cards to swap."
            />
          </p>
        </div>
        <Button
          disabled={creatingInvite}
          onClick={() => {
            setCreatingInvite(true);
            createInviteMutation.mutate();
          }}
        >
          <Link2 className="mr-2 h-4 w-4" />
          <FormattedMessage
            id="trade.index.createInvite"
            defaultMessage="Create invite link"
          />
        </Button>
      </div>

      {isLoadingConns ? (
        <div className="flex min-h-32 items-center justify-center">
          <Loader />
        </div>
      ) : (
        <>
          {/* Pending incoming */}
          {pendingIncoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  <FormattedMessage
                    id="trade.index.pendingRequests"
                    defaultMessage="Pending requests"
                  />
                  <Badge variant="secondary">{pendingIncoming.length}</Badge>
                </CardTitle>
                <CardDescription>
                  <FormattedMessage
                    id="trade.index.pendingRequestsDesc"
                    defaultMessage="These users want to trade with you."
                  />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingIncoming.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.partner?.image ?? undefined} />
                      <AvatarFallback>
                        {getInitials(c.partner?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm font-medium">
                      {c.partner?.name ?? (
                        <FormattedMessage
                          id="trade.index.unknownUser"
                          defaultMessage="Unknown user"
                        />
                      )}
                    </span>
                    <Button size="sm" asChild>
                      <Link href={`/trade/join/${c.inviteToken}`}>
                        <FormattedMessage
                          id="trade.index.review"
                          defaultMessage="Review"
                        />
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pending outgoing (invites I created) */}
          {pendingOutgoing.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FormattedMessage
                    id="trade.index.pendingInvites"
                    defaultMessage="Pending invites"
                  />
                </CardTitle>
                <CardDescription>
                  <FormattedMessage
                    id="trade.index.pendingInvitesDesc"
                    defaultMessage="Share these links with someone to start trading."
                  />
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingOutgoing.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground font-mono truncate">
                        {`${typeof window !== "undefined" ? window.location.origin : ""}/trade/join/${c.inviteToken}`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyInvite(c.inviteToken)}
                    >
                      {copiedToken === c.inviteToken ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeMutation.mutate({ id: c.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Accepted partners */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <FormattedMessage
                  id="trade.index.partners"
                  defaultMessage="Trade partners"
                />
                {accepted.length > 0 && (
                  <Badge variant="secondary">{accepted.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {accepted.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  <FormattedMessage
                    id="trade.index.noPartners"
                    defaultMessage="No trade partners yet. Create an invite link and share it!"
                  />
                </p>
              ) : (
                <ul className="space-y-1">
                  {accepted.map((c, i) => (
                    <li key={c.id}>
                      {i > 0 && <Separator className="mb-1" />}
                      <Link
                        href={`/trade/${c.id}`}
                        className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={c.partner?.image ?? undefined} />
                          <AvatarFallback>
                            {getInitials(c.partner?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium">
                          {c.partner?.name ?? (
                            <FormattedMessage
                              id="trade.index.unknownUser"
                              defaultMessage="Unknown user"
                            />
                          )}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
