import { BookOpen, LayoutGrid } from "lucide-react";
import { FormattedMessage } from "react-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { BrowseMode } from "./modes/browse-mode";
import { SheetManagement } from "./modes/sheet-management";

export function Binder() {
  return (
    <Tabs defaultValue="browse" className="w-full">
      <div className="flex justify-center mb-4">
        <TabsList>
          <TabsTrigger value="browse" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <FormattedMessage
              id="binder.mode.browse"
              defaultMessage="Browse Mode"
            />
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            <FormattedMessage
              id="binder.mode.manage"
              defaultMessage="Manage Sheets"
            />
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="browse">
        <BrowseMode />
      </TabsContent>

      <TabsContent value="manage">
        <SheetManagement />
      </TabsContent>
    </Tabs>
  );
}
