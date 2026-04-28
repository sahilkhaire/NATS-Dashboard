import * as React from "react"
import {
  Activity,
  CircleDot,
  FileText,
  FolderKanban,
  Gauge,
  Globe,
  HeartPulse,
  Leaf,
  Network,
  Server,
  TerminalSquare,
  Waves,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const data = {
  groups: [
    {
      title: "Monitor",
      items: [
        {
          title: "Overview",
          url: "/",
          icon: Activity,
        },
        {
          title: "Health",
          url: "/health",
          icon: HeartPulse,
        },
      ],
    },
    {
      title: "Messaging",
      items: [
        {
          title: "Streams",
          url: "/streams",
          icon: CircleDot,
        },
        {
          title: "Consumers",
          url: "/consumers",
          icon: Waves,
        },
        {
          title: "Subscriptions",
          url: "/subscriptions",
          icon: FolderKanban,
        },
      ],
    },
    {
      title: "Connections",
      items: [
        {
          title: "Connections",
          url: "/connections",
          icon: Network,
        },
        {
          title: "JetStream",
          url: "/jetstream",
          icon: Gauge,
        },
      ],
    },
    {
      title: "Infrastructure",
      items: [
        {
          title: "Cluster",
          url: "/cluster",
          icon: Server,
        },
        {
          title: "Gateways",
          url: "/gateways",
          icon: Globe,
        },
        {
          title: "Leaf Nodes",
          url: "/leaf-nodes",
          icon: Leaf,
        },
        {
          title: "Accounts",
          url: "/accounts",
          icon: FileText,
        },
      ],
    },
    {
      title: "Tools",
      items: [
        {
          title: "CLI",
          url: "/cli",
          icon: TerminalSquare,
        },
      ],
    },
  ],
}

export function AppSidebar({
  ...props
}) {
  const { pathname } = useLocation()
  const isItemActive = (url) => {
    if (url === "/") return pathname === "/"
    return pathname === url || pathname.startsWith(`${url}/`)
  }

  return (
    <Sidebar collapsible="icon" {...props} className="border-r border-sidebar-border">
      <SidebarHeader>
        <div className="px-2 py-2.5">
          <div className="font-mono text-lg font-semibold tracking-wide">NATS</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Enterprise Console</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {data.groups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isItemActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
