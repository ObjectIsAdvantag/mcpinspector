import { useRef } from "react";
import { Button, FileButton, Group } from "@mantine/core";
import { MdFolderOpen } from "react-icons/md";
import { INSPECTOR_SESSION_MEDIA_TYPE } from "@inspector/core/extensions/api/sessions.js";
import { ListToggle } from "../../elements/ListToggle/ListToggle";
import {
  ServerAddMenu,
  type AddServerMenuProps,
} from "../ServerAddMenu/ServerAddMenu.js";

export interface ServerListControlsProps extends AddServerMenuProps {
  compact: boolean;
  serverCount: number;
  onToggleList: () => void;
  /** Download the current server list as a canonical `mcp.json` file. */
  onExport: () => void;
  /** Select a passive native-session artifact for read-only replay. */
  onOpenSession: (file: File | null) => void;
  /** Opening an artifact is permitted only while the live client is disconnected. */
  sessionOpenDisabled: boolean;
  /** When false (read-only session), the Add menu is hidden. Defaults to true. */
  writable?: boolean;
}

// `gap="sm"` matches the header's control spacing (its RightSection group), so
// these buttons sit the same distance apart as the header icons.
const ControlsRow = Group.withProps({
  justify: "flex-end",
  gap: "sm",
});

const OpenSessionButton = Button.withProps({
  variant: "default",
  leftSection: <MdFolderOpen size={18} />,
});

export function ServerListControls({
  compact,
  serverCount,
  onToggleList,
  onAddManually,
  onImportConfig,
  onImportServerJson,
  onExport,
  onOpenSession,
  sessionOpenDisabled,
  writable = true,
}: ServerListControlsProps) {
  const resetSessionFileRef = useRef<() => void>(null);

  function handleOpenSession(file: File | null): void {
    resetSessionFileRef.current?.();
    onOpenSession(file);
  }

  return (
    <ControlsRow>
      <FileButton
        onChange={handleOpenSession}
        accept={`${INSPECTOR_SESSION_MEDIA_TYPE},application/json,.json`}
        resetRef={resetSessionFileRef}
      >
        {(props) => (
          <OpenSessionButton
            {...props}
            disabled={sessionOpenDisabled}
            title={
              sessionOpenDisabled
                ? "Disconnect before opening a session"
                : "Open a recorded Inspector session"
            }
          >
            Open Session
          </OpenSessionButton>
        )}
      </FileButton>
      <Button variant="default" onClick={onExport} disabled={serverCount === 0}>
        Export
      </Button>
      {writable && (
        <ServerAddMenu
          onAddManually={onAddManually}
          onImportConfig={onImportConfig}
          onImportServerJson={onImportServerJson}
        />
      )}
      {serverCount > 0 && (
        <ListToggle compact={compact} onToggle={onToggleList} />
      )}
    </ControlsRow>
  );
}
