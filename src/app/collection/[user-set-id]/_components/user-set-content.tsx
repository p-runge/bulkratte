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

function BinderContent({
  handleCloseDialog,
  dialogState,
  userCards,
}: {
  handleCloseDialog: any;
  dialogState: any;
  userCards: any[];
}) {
  return (
    <>
      <SetInfo userCards={userCards} />

      <Binder />

      {dialogState && (
        <PlaceCardDialog
          userSetId={dialogState.userSetId}
          userSet={dialogState.userSet}
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
  const { data: placedUserCards } = api.userSet.getPlacedUserCardIds.useQuery();

  const [dialogState, setDialogState] = useState<{
    open: boolean;
    cardId: string;
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
  ) => {
    setDialogState({
      open: true,
      cardId,
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
      <BinderProvider
        mode="place"
        initialUserSet={userSet}
        userSetId={userSet.set.id}
        userCards={userCards}
        placedUserCards={placedUserCards}
        onCardClick={handleCardClick}
      >
        <BinderContent
          handleCloseDialog={handleCloseDialog}
          dialogState={dialogState}
          userCards={userCards}
        />
      </BinderProvider>
    </>
  );
}
