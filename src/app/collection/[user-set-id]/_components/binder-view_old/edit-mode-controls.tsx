import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CardPicker } from "@/components/card-browser/card-picker";
import { Plus } from "lucide-react";

interface EditModeControlsProps {
  hasEmptySlots: boolean;
  onAddPage: () => void;
  addDialogOpen: boolean;
  setAddDialogOpen: (open: boolean) => void;
  onCardSelect: (selectedCardIds: Set<string>) => void;
}

export function EditModeControls({
  hasEmptySlots,
  onAddPage,
  addDialogOpen,
  setAddDialogOpen,
  onCardSelect,
}: EditModeControlsProps) {
  return (
    <>
      {!hasEmptySlots && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" onClick={onAddPage} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Page
          </Button>
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Cards to Set</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            <CardPicker
              onSelect={onCardSelect}
              onClose={() => setAddDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
