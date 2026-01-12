"use client";

import Loader from "@/components/loader";
import { api } from "@/lib/api/react";
import { useState } from "react";
import { BinderView } from "./binder-view";
import { PlaceCardDialog } from "./place-card-dialog";

interface UserSetContentProps {
  userSetId: string;
}

export function UserSetContent({ userSetId }: UserSetContentProps) {
  const { data: userSet, isLoading: isLoadingUserSet } = api.userSet.getById.useQuery({ id: userSetId });
  const { data: userCards, isLoading: isLoadingUserCards } = api.userCard.getList.useQuery();

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
    currentUserCardId: string | null
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

  if (isLoadingUserSet || isLoadingUserCards) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  if (!userSet || !userCards) {
    return null;
  }

  return (
    <>
      <BinderView
        mode="view"
        userSet={userSet}
        userCards={userCards}
        onCardClick={handleCardClick}
      />

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
