import {
  Home,
  MessageSquare,
  Mic,
  Image,
  FileText,
  GitBranch,
  Zap,
  Workflow,
  Archive,
  FlaskConical,
  Smartphone,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Início", url: "/", icon: Home, color: "text-emerald-400" },
  { title: "Mensagens", url: "/mensagens", icon: MessageSquare, color: "text-green-400" },
  { title: "Áudios", url: "/audios", icon: Mic, color: "text-cyan-400" },
  { title: "Mídias", url: "/midias", icon: Image, color: "text-pink-400" },
  { title: "Documentos", url: "/documentos", icon: FileText, color: "text-rose-400" },
  { title: "Funis", url: "/funis", icon: GitBranch, color: "text-purple-400" },
  { title: "Gatilhos", url: "/gatilhos", icon: Zap, color: "text-amber-400" },
  { title: "Fluxos", url: "/fluxos", icon: Workflow, color: "text-blue-400", disabled: true },
  { title: "Backups", url: "/backups", icon: Archive, color: "text-slate-400" },
  { title: "Espaço de Teste", url: "/teste", icon: FlaskConical, color: "text-lime-400" },
  { title: "Instâncias", url: "/api-keys", icon: Smartphone, color: "text-orange-400" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-bold text-2xl text-sidebar-foreground tracking-tight">
              Rise Zap
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    disabled={item.disabled}
                    tooltip={collapsed ? item.title : undefined}
                    className="h-12"
                  >
                    {item.disabled ? (
                      <span className="flex items-center gap-4 opacity-40 cursor-not-allowed px-3 py-3 text-[17px]">
                        <item.icon className={`h-6 w-6 flex-shrink-0 ${item.color}`} />
                        {!collapsed && <span>{item.title}</span>}
                      </span>
                    ) : (
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-4 px-3 py-3 rounded-md text-[17px] text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      >
                        <item.icon className={`h-6 w-6 flex-shrink-0 ${item.color}`} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
