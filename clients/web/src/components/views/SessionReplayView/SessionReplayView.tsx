import { useState } from "react";
import {
  Accordion,
  ActionIcon,
  Anchor,
  AppShell,
  Badge,
  Code,
  Divider,
  Flex,
  Group,
  Image,
  NavLink,
  Pagination,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import { MdClose, MdDarkMode, MdLightMode } from "react-icons/md";
import type {
  NativeSessionReplaySectionId,
  NativeSessionReplayStore,
} from "@inspector/core/extensions/builtin/inspector-session/replay.js";
import { VersionBadge } from "../../elements/VersionBadge/VersionBadge";
import {
  CopyrightBadge,
  COPYRIGHT_NOTICE,
} from "../../elements/CopyrightBadge/CopyrightBadge";
import mcpLogo from "../../../theme/assets/MCP.svg";
import mcpLogoDark from "../../../theme/assets/MCP-dark.svg";

export interface SessionReplayViewProps {
  session: NativeSessionReplayStore;
  version?: string;
  onClose: () => void;
  onToggleTheme: () => void;
}

const PAGE_SIZE = 25;

const ReplayShell = AppShell.withProps({
  header: { height: 60 },
  footer: { height: 32 },
  padding: 0,
});

const HeaderRow = Group.withProps({
  h: "100%",
  px: "xl",
  justify: "space-between",
  wrap: "nowrap",
});

const HeaderIdentity = Group.withProps({
  gap: "sm",
  wrap: "nowrap",
});

const DocumentationLink = Anchor.withProps({
  href: "https://modelcontextprotocol.io",
  target: "_blank",
  rel: "noopener noreferrer",
  "aria-label": "MCP Documentation",
});

const LogoImage = Image.withProps({
  w: 32,
  h: 32,
  fit: "contain",
  alt: "MCP",
});

const ReplayTitle = Title.withProps({
  order: 2,
  size: "h3",
});

const HeaderServerName = Text.withProps({
  size: "sm",
  c: "dimmed",
  lineClamp: 1,
});

const ReadOnlyBadge = Badge.withProps({
  variant: "light",
  color: "gray",
});

const HeaderActions = Group.withProps({
  gap: "xs",
  wrap: "nowrap",
});

const HeaderAction = ActionIcon.withProps({
  variant: "subtle",
  size: 36,
});

const ReplayLayout = Flex.withProps({
  variant: "screen",
  h: "calc(100dvh - var(--app-shell-header-height, 0px) - var(--app-shell-footer-height, 0px))",
  gap: "md",
  p: "xl",
});

const NavigationPanel = Paper.withProps({
  withBorder: true,
  p: "md",
  w: 300,
  flex: "0 0 auto",
  variant: "panel",
});

const NavigationStack = Stack.withProps({
  h: "100%",
  gap: "md",
});

const NavigationHeader = Stack.withProps({
  gap: 2,
});

const NavigationTitle = Title.withProps({
  order: 3,
  size: "h4",
});

const MetadataLabel = Text.withProps({
  size: "xs",
  c: "dimmed",
  tt: "uppercase",
  fw: 700,
});

const MetadataValue = Text.withProps({
  size: "sm",
  lineClamp: 2,
});

const NavigationScroll = ScrollArea.withProps({
  type: "auto",
  offsetScrollbars: true,
  flex: 1,
});

const SectionCount = Badge.withProps({
  variant: "light",
  color: "gray",
  size: "sm",
});

const ContentPanel = Paper.withProps({
  withBorder: true,
  p: "lg",
  flex: 1,
  mih: 0,
  variant: "panel",
});

const ContentStack = Stack.withProps({
  h: "100%",
  gap: "md",
});

const ContentScroll = ScrollArea.withProps({
  type: "auto",
  offsetScrollbars: true,
  flex: 1,
});

const SectionHeader = Group.withProps({
  justify: "space-between",
  wrap: "nowrap",
});

const SectionTitle = Title.withProps({
  order: 2,
  size: "h3",
});

const EntryControlContent = Group.withProps({
  justify: "space-between",
  wrap: "nowrap",
  gap: "md",
});

const EntryLabel = Text.withProps({
  fw: 600,
  lineClamp: 1,
});

const EntryIndex = Text.withProps({
  size: "xs",
  c: "dimmed",
  flex: "0 0 auto",
});

const JsonCode = Code.withProps({
  block: true,
  p: "md",
  variant: "wrapping",
});

const PaginationRow = Group.withProps({
  justify: "center",
  mt: "md",
});

const FooterRow = Group.withProps({
  h: "100%",
  px: "xl",
  justify: "space-between",
  wrap: "nowrap",
});

function formatCapturedAt(value: string): string {
  return new Date(value).toLocaleString();
}

export function SessionReplayView({
  session,
  version,
  onClose,
  onToggleTheme,
}: SessionReplayViewProps) {
  const colorScheme = useComputedColorScheme("light");
  const [activeSectionId, setActiveSectionId] =
    useState<NativeSessionReplaySectionId>("overview");
  const [page, setPage] = useState(1);
  const [openedEntry, setOpenedEntry] = useState<string | null>(null);
  const activeSection = session.sections.find(
    ({ id }) => id === activeSectionId,
  )!;
  const totalPages = Math.ceil(activeSection.entries.length / PAGE_SIZE);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEntries = activeSection.entries.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );

  function selectSection(id: NativeSessionReplaySectionId): void {
    setActiveSectionId(id);
    setPage(1);
    setOpenedEntry(null);
  }

  function selectPage(nextPage: number): void {
    setPage(nextPage);
    setOpenedEntry(null);
  }

  const logoSrc = colorScheme === "dark" ? mcpLogoDark : mcpLogo;

  return (
    <ReplayShell
      data-testid="session-replay-view"
      data-session-id={session.metadata.sessionId}
    >
      <AppShell.Header>
        <HeaderRow>
          <HeaderIdentity>
            <Tooltip label="MCP Documentation">
              <DocumentationLink>
                <LogoImage src={logoSrc} />
              </DocumentationLink>
            </Tooltip>
            <Stack gap={0}>
              <ReplayTitle>Session Replay</ReplayTitle>
              <HeaderServerName>{session.metadata.serverName}</HeaderServerName>
            </Stack>
          </HeaderIdentity>
          <ReadOnlyBadge>Read-only artifact</ReadOnlyBadge>
          <HeaderActions>
            <Tooltip
              label={
                colorScheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              <HeaderAction
                aria-label="Toggle color scheme"
                onClick={onToggleTheme}
              >
                {colorScheme === "dark" ? (
                  <MdLightMode size={20} />
                ) : (
                  <MdDarkMode size={20} />
                )}
              </HeaderAction>
            </Tooltip>
            <Tooltip label="Close session replay">
              <HeaderAction aria-label="Close session replay" onClick={onClose}>
                <MdClose size={20} />
              </HeaderAction>
            </Tooltip>
          </HeaderActions>
        </HeaderRow>
      </AppShell.Header>

      <AppShell.Main>
        <ReplayLayout>
          <NavigationPanel>
            <NavigationStack>
              <NavigationHeader>
                <NavigationTitle>{session.metadata.serverName}</NavigationTitle>
                <MetadataLabel>Captured</MetadataLabel>
                <MetadataValue>
                  {formatCapturedAt(session.metadata.capturedAt)}
                </MetadataValue>
                <MetadataLabel>Session ID</MetadataLabel>
                <MetadataValue>{session.metadata.sessionId}</MetadataValue>
                <MetadataLabel>Format</MetadataLabel>
                <MetadataValue>
                  {session.metadata.formatId} · v
                  {session.metadata.formatVersion}
                </MetadataValue>
                <MetadataLabel>Inspector writer</MetadataLabel>
                <MetadataValue>
                  {session.metadata.inspectorVersion}
                </MetadataValue>
                {session.metadata.protocolVersion ? (
                  <>
                    <MetadataLabel>Protocol</MetadataLabel>
                    <MetadataValue>
                      {session.metadata.protocolVersion}
                      {session.metadata.protocolEra
                        ? ` · ${session.metadata.protocolEra}`
                        : ""}
                    </MetadataValue>
                  </>
                ) : null}
              </NavigationHeader>
              <Divider />
              <NavigationScroll>
                <Stack gap="xs">
                  {session.sections.map((section) => (
                    <NavLink
                      key={section.id}
                      label={section.label}
                      active={section.id === activeSectionId}
                      onClick={() => selectSection(section.id)}
                      rightSection={
                        <SectionCount>{section.entries.length}</SectionCount>
                      }
                    />
                  ))}
                </Stack>
              </NavigationScroll>
            </NavigationStack>
          </NavigationPanel>

          <ContentPanel>
            <ContentStack>
              <SectionHeader>
                <SectionTitle>{activeSection.label}</SectionTitle>
                <SectionCount>{activeSection.entries.length}</SectionCount>
              </SectionHeader>
              <Divider />
              <ContentScroll>
                {/* Accordion stays inline: its compound generic loses its JSX
                    call signature when configured through `.withProps()`. */}
                <Accordion
                  variant="separated"
                  value={openedEntry}
                  onChange={setOpenedEntry}
                >
                  {pageEntries.map((entry, index) => (
                    <Accordion.Item key={entry.id} value={entry.id}>
                      <Accordion.Control>
                        <EntryControlContent>
                          <EntryLabel>{entry.label}</EntryLabel>
                          <EntryIndex>
                            {pageStart + index + 1} of{" "}
                            {activeSection.entries.length}
                          </EntryIndex>
                        </EntryControlContent>
                      </Accordion.Control>
                      <Accordion.Panel>
                        {openedEntry === entry.id ? (
                          <JsonCode>
                            {JSON.stringify(entry.value, null, 2)}
                          </JsonCode>
                        ) : null}
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
                {totalPages > 1 ? (
                  <PaginationRow>
                    <Pagination
                      total={totalPages}
                      value={page}
                      onChange={selectPage}
                      withEdges
                    />
                  </PaginationRow>
                ) : null}
              </ContentScroll>
            </ContentStack>
          </ContentPanel>
        </ReplayLayout>
      </AppShell.Main>

      <AppShell.Footer>
        <FooterRow aria-label={COPYRIGHT_NOTICE}>
          <VersionBadge version={version} />
          <CopyrightBadge />
        </FooterRow>
      </AppShell.Footer>
    </ReplayShell>
  );
}
