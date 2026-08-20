import { AppShell } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ViewHeader } from "./ViewHeader";

const meta: Meta<typeof ViewHeader> = {
  title: "Groups/ViewHeader",
  component: ViewHeader,
  decorators: [
    (Story) => (
      <AppShell header={{ height: 60 }}>
        <AppShell.Header>
          <Story />
        </AppShell.Header>
      </AppShell>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ViewHeader>;

export const Connected: Story = {
  args: {
    connected: true,
    serverInfo: { name: "my-mcp-server", version: "1.2.0" },
    status: "connected",
    latencyMs: 23,
    activeTab: "Tools",
    availableTabs: [
      "Tools",
      "Resources",
      "Prompts",
      "Tasks",
      "Logs",
      "Protocol",
    ],
    onTabChange: fn(),
    onExportSession: fn(),
    onExportDescription: fn(),
    onDisconnect: fn(),
    onToggleTheme: fn(),
    onOpenClientSettings: fn(),
  },
  play: async ({ args, canvasElement }) => {
    if (args.connected !== true) {
      throw new Error("The connected story requires connected props");
    }
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Export description" }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByRole("menuitem", { name: "YAML" }));
    await expect(args.onExportDescription).toHaveBeenCalledWith("yaml");
    await waitFor(() => expect(page.queryByRole("menu")).toBeNull());
  },
};

export const Unconnected: Story = {
  args: {
    connected: false,
    onToggleTheme: fn(),
    onOpenClientSettings: fn(),
  },
};
