"use client";

import { Binder } from "@/components/binder";
import { BinderProvider } from "@/components/binder/binder-context";
import { UserSet } from "@/components/binder/types";
import Loader from "@/components/loader";
import { api } from "@/lib/api/react";
import { useState } from "react";
import { PlaceCardDialog } from "./place-card-dialog";
import { SetInfo } from "./set-info";

interface UserSetContentProps {
  userSet: UserSet;
}

export function UserSetContent({
  userSet: initialUserSet,
}: UserSetContentProps) {
  const { data: userSet } = api.userSet.getById.useQuery(
    { id: initialUserSet.set.id },
    {
      initialData: initialUserSet,
    },
  );
  const { data: userCards, isLoading } = api.userCard.getList.useQuery();

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    cardId: string;
    userSetCardId: string;
    hasUserCard: boolean;
    isPlaced: boolean;
    currentUserCardId: string | null;
  } | null>(null);

  const handleCardClick = (
    userSetCardId: string,
    cardId: string,
    hasUserCard: boolean,
    isPlaced: boolean,
    currentUserCardId: string | null,
  ) => {
    setDialogState({
      open: true,
      cardId,
      userSetCardId,
      hasUserCard,
      isPlaced,
      currentUserCardId,
    });
  };

  const handleCloseDialog = () => {
    setDialogState(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  if (!userCards) {
    return null;
  }

  return (
    <>
      <SetInfo userSet={userSet} userCards={userCards} />

      <BinderProvider
        key={`${userSet.set.id}-${userSet.cards.length}-${userSet.cards.filter((c) => c.userCardId).length}`}
        mode="place"
        initialUserSet={userSet}
        userSetId={userSet.set.id}
        userCards={userCards}
        onCardClick={handleCardClick}
      >
        <Binder />
      </BinderProvider>

      {dialogState && (
        <PlaceCardDialog
          userSetId={userSet.set.id}
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
