"use client";

import { Binder } from "@/components/binder";
import { BinderProvider } from "@/components/binder/binder-context";
import { BinderCard, UserCardList, UserSet } from "@/components/binder/types";
import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/react";
import { TRPCClientError } from "@trpc/client";
import { ArrowLeft, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { useIntl } from "react-intl";
import { PlaceCardDialog } from "./place-card-dialog";
import { PrivateSet } from "./private-set";
import { SetInfo } from "./set-info";

interface UserSetContentProps {
  userSetId: string;
}

function BinderContent({
  handleCloseDialog,
  dialogState,
  userCards,
}: {
  handleCloseDialog: () => void;
  dialogState: {
    open: boolean;
    cardId: string;
    card: BinderCard | undefined;
    userSetCardId: string;
    hasUserCard: boolean;
    isPlaced: boolean;
    currentUserCardId: string | null;
    userSet: UserSet;
    userSetId: string;
  } | null;
  userCards: UserCardList;
}) {
  return (
    <>
      <SetInfo userCards={userCards} />

      <Binder />

      {dialogState && (
        <PlaceCardDialog
          userSetId={dialogState.userSetId}
          userSet={dialogState.userSet}
          card={dialogState.card}
          cardId={dialogState.cardId}
          userSetCardId={dialogState.userSetCardId}
          hasUserCard={dialogState.hasUserCard}
          isPlaced={dialogState.isPlaced}
          currentUserCardId={dialogState.currentUserCardId}
          userCards={userCards}
          onClose={handleCloseDialog}
          onSuccess={handleCloseDialog}
        />
      )}
    </>
  );
}

export function UserSetContent({ userSetId }: UserSetContentProps) {
  const intl = useIntl();

  const {
    data: userSet,
    isPending: userSetPending,
    error: userSetError,
  } = api.userSet.getById.useQuery({ id: userSetId });
  const { data: userCards, isPending: userCardsPending } =
    api.userCard.getList.useQuery();
  const { data: placedUserCards, isPending: placedPending } =
    api.userSet.getPlacedUserCardIds.useQuery();

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    cardId: string;
    card: BinderCard | undefined;
    userSetCardId: string;
    hasUserCard: boolean;
    isPlaced: boolean;
    currentUserCardId: string | null;
    userSet: UserSet;
    userSetId: string;
  } | null>(null);

  const handleCardClick = (
    userSetCardId: string,
    cardId: string,
    hasUserCard: boolean,
    isPlaced: boolean,
    currentUserCardId: string | null,
    card: BinderCard | undefined,
  ) => {
    if (!userSet) return;
    setDialogState({
      open: true,
      cardId,
      card,
      userSetCardId,
      hasUserCard,
      isPlaced,
      currentUserCardId,
      userSet,
      userSetId: userSet.set.id,
    });
  };

  const handleCloseDialog = () => {
    setDialogState(null);
  };

  if (userSetError instanceof TRPCClientError) {
    if (userSetError.data?.code === "FORBIDDEN") return <PrivateSet />;
    if (userSetError.data?.code === "NOT_FOUND") notFound();
    throw userSetError;
  } else if (userSetError) {
    throw userSetError;
  }

  if (userSetPending || userCardsPending || placedPending) {
    return (
      <div className="flex justify-center py-20">
        <Loader />
      </div>
    );
  }

  if (!userSet) return null;

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
            <Image
              src={userSet.set.image}
              alt={userSet.set.name}
              width={64}
              height={64}
              unoptimized
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

      <BinderProvider
        mode="place"
        initialUserSet={userSet}
        userSetId={userSet.set.id}
        userCards={userCards ?? []}
        placedUserCards={placedUserCards ?? []}
        onCardClick={handleCardClick}
      >
        <BinderContent
          handleCloseDialog={handleCloseDialog}
          dialogState={dialogState}
          userCards={userCards ?? []}
        />
      </BinderProvider>
    </>
  );
}
