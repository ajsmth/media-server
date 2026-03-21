import type { LibraryFileRecord } from "@media-server/shared";

import { Button } from "@/components/ui/button";

type FileActionsProps = {
  file: LibraryFileRecord;
  nebulaActive: boolean;
  browserActive: boolean;
  onBrowser: (file: LibraryFileRecord) => void;
  onNebula: (file: LibraryFileRecord) => void;
};

export function FileActions({
  file,
  nebulaActive,
  browserActive,
  onBrowser,
  onNebula,
}: FileActionsProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button
        onClick={() => onBrowser(file)}
        variant={browserActive ? "default" : "outline"}
      >
        Browser
      </Button>
      <Button
        onClick={() => onNebula(file)}
        variant={nebulaActive ? "default" : "secondary"}
      >
        Nebula
      </Button>
    </div>
  );
}
