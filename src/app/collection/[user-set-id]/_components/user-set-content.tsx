"use client";

import { Binder } from "@/components/binder";
import {
  BinderProvider,
  useBinderContext,
} from "@/components/binder/binder-context";
import { UserSet } from "@/components/binder/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import Loader from "@/components/loader";
import { api } from "@/lib/api/react";
import pokemonAPI from "@/lib/pokemon-api";
import { useState } from "react";
import { PlaceCardDialog } from "./place-card-dialog";
import { SetInfo } from "./set-info";

interface UserSetContentProps {
  userSet: UserSet;
}

function BinderContent({
  userSet,
  userCards,
  handleCloseDialog,
  dialogState,
  considerLanguage,
  setConsiderLanguage,
  considerVariant,
  setConsiderVariant,
  considerCondition,
  setConsiderCondition,
}: {
  userSet: UserSet;
  userCards: any[];
  handleCloseDialog: any;
  dialogState: any;
  considerLanguage: boolean;
  setConsiderLanguage: (value: boolean) => void;
  considerVariant: boolean;
  setConsiderVariant: (value: boolean) => void;
  considerCondition: boolean;
  setConsiderCondition: (value: boolean) => void;
}) {
  const { form } = useBinderContext();

  const preferredLanguage = form.watch("preferredLanguage");
  const preferredVariant = form.watch("preferredVariant");
  const preferredCondition = form.watch("preferredCondition");

  const hasAnyPreferred =
    preferredLanguage || preferredVariant || preferredCondition;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <SetInfo
          userSet={userSet}
          userCards={userCards}
          considerPreferredLanguage={considerLanguage}
          considerPreferredVariant={considerVariant}
          considerPreferredCondition={considerCondition}
        />
        {hasAnyPreferred && (
          <div className="flex items-center gap-3">
            {preferredLanguage && (
              <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-muted/30">
                <Checkbox
                  id="considerPreferredLanguage"
                  checked={considerLanguage}
                  onCheckedChange={(checked) => setConsiderLanguage(!!checked)}
                />
                <Label
                  htmlFor="considerPreferredLanguage"
                  className="text-sm font-normal cursor-pointer flex items-center gap-1.5"
                >
                  <span className="text-lg">
                    {
                      pokemonAPI.cardLanguages.find(
                        (l) => l.code === preferredLanguage,
                      )?.flag
                    }
                  </span>
                  <span className="text-xs font-medium">
                    {
                      pokemonAPI.cardLanguages.find(
                        (l) => l.code === preferredLanguage,
                      )?.name
                    }
                  </span>
                </Label>
              </div>
            )}

            {preferredVariant && (
              <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-muted/30">
                <Checkbox
                  id="considerPreferredVariant"
                  checked={considerVariant}
                  onCheckedChange={(checked) => setConsiderVariant(!!checked)}
                />
                <Label
                  htmlFor="considerPreferredVariant"
                  className="text-sm font-normal cursor-pointer"
                >
                  <Badge variant="outline" className="text-xs font-medium">
                    {preferredVariant}
                  </Badge>
                </Label>
              </div>
            )}

            {preferredCondition && (
              <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-muted/30">
                <Checkbox
                  id="considerPreferredCondition"
                  checked={considerCondition}
                  onCheckedChange={(checked) => setConsiderCondition(!!checked)}
                />
                <Label
                  htmlFor="considerPreferredCondition"
                  className="text-sm font-normal cursor-pointer"
                >
                  <Badge
                    className={`${
                      pokemonAPI.conditions.find(
                        (c) => c.value === preferredCondition,
                      )?.color || "bg-gray-500"
                    } border text-xs font-medium`}
                  >
                    {pokemonAPI.conditions.find(
                      (c) => c.value === preferredCondition,
                    )?.short || preferredCondition}
                  </Badge>
                </Label>
              </div>
            )}
          </div>
        )}
      </div>

      <Binder />

      {dialogState && (
        <PlaceCardDialog
          userSetId={userSet.set.id}
          userSet={userSet}
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

  const [considerLanguage, setConsiderLanguage] = useState(true);
  const [considerVariant, setConsiderVariant] = useState(true);
  const [considerCondition, setConsiderCondition] = useState(true);

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
      <BinderProvider
        mode="place"
        initialUserSet={userSet}
        userSetId={userSet.set.id}
        userCards={userCards}
        placedUserCards={placedUserCards}
        onCardClick={handleCardClick}
        considerPreferredLanguage={considerLanguage}
        considerPreferredVariant={considerVariant}
        considerPreferredCondition={considerCondition}
      >
        <BinderContent
          userSet={userSet}
          userCards={userCards}
          handleCloseDialog={handleCloseDialog}
          dialogState={dialogState}
          considerLanguage={considerLanguage}
          setConsiderLanguage={setConsiderLanguage}
          considerVariant={considerVariant}
          setConsiderVariant={setConsiderVariant}
          considerCondition={considerCondition}
          setConsiderCondition={setConsiderCondition}
        />
      </BinderProvider>
    </>
  );
}
