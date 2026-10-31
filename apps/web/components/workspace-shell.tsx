"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building, Building2, ClipboardCheck, House, LayoutDashboard, Luggage, Plus, Search, UserCheck } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { SignOut } from "@/components/sign-out";

// Read by server/workspace-navigation.ts; null when there is no usable session.
type WorkspaceNavigation = {
  owner: boolean;
  admin: boolean;
  properties: { id: string; nameKm: string; nameEn: string | null }[];
  moreProperties: boolean;
};

// The owner and admin workspace: a sidebar of area-level pages and a top
// bar with sign-out. Page-level navigation (property tabs, booking filters)
// stays inside the page, so links are not repeated and work before hydration.
// Labels here must not duplicate in-page link names used by e2e tests.
function WorkspaceShell({
  navigation,
  defaultOpen,
  notice,
  children,
}: {
  navigation: WorkspaceNavigation | null;
  defaultOpen: boolean;
  notice: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const area = pathname.startsWith("/admin") ? "Admin" : "Owner workspace";
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar>
        <SidebarHeader>
          <Link
            href="/"
            aria-label="Root of Cambodia home"
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 font-semibold tracking-tight"
          >
            <House aria-hidden="true" className="size-5 text-primary" />
            Root of Cambodia
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Workspace">
            <WorkspaceMenu navigation={navigation} pathname={pathname} />
          </nav>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        {notice}
        <div className="flex min-h-14 items-center gap-2 border-b bg-card px-3 sm:px-5">
          <SidebarTrigger />
          <span className="text-sm font-medium">{area}</span>
          <div className="ml-auto">
            <SignOut />
          </div>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspaceMenu({
  navigation,
  pathname,
}: {
  navigation: WorkspaceNavigation | null;
  pathname: string;
}) {
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);
  const propertyId = pathname.match(/^\/owner\/properties\/([^/]+)/)?.[1];
  const item = (href: string, label: string, icon: ReactNode, active: boolean) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton
        isActive={active}
        render={<Link href={href} aria-current={active ? "page" : undefined} onClick={close} />}
      >
        {icon}
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
  // Without a usable session (signed out, read-only staging) only guest links
  // show; the page itself redirects or refuses.
  return (
    <>
      {navigation && (
      <SidebarGroup>
        <SidebarGroupLabel>Owner</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {item("/owner", "Properties", <Building2 aria-hidden="true" />, pathname === "/owner")}
            {navigation?.properties.length ? (
              <SidebarMenuSub>
                {navigation.properties.map((property) => (
                  <SidebarMenuSubItem key={property.id}>
                    <SidebarMenuSubButton
                      isActive={property.id === propertyId}
                      render={
                        <Link
                          href={`/owner/properties/${property.id}`}
                          aria-current={property.id === propertyId ? "page" : undefined}
                          onClick={close}
                        />
                      }
                    >
                      <span lang="km">{property.nameKm}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
                {navigation.moreProperties && (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton render={<Link href="/owner" onClick={close} />}>
                      <span>All properties…</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            ) : null}
            {navigation.owner
              ? item("/owner/properties/new", "New property", <Plus aria-hidden="true" />, pathname === "/owner/properties/new")
              : item("/owner/apply", "Owner application", <Plus aria-hidden="true" />, pathname === "/owner/apply")}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      )}
      {navigation?.admin && (
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {item("/admin", "Overview", <LayoutDashboard aria-hidden="true" />, pathname === "/admin")}
              {item("/admin/reviews", "Review queue", <ClipboardCheck aria-hidden="true" />, pathname.startsWith("/admin/reviews"))}
              {item("/admin/owners", "Owner applications", <UserCheck aria-hidden="true" />, pathname.startsWith("/admin/owners"))}
              {item("/admin/properties", "All properties", <Building aria-hidden="true" />, pathname.startsWith("/admin/properties"))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
      <SidebarGroup>
        <SidebarGroupLabel>As a guest</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {item("/stays", "Explore stays", <Search aria-hidden="true" />, false)}
            {item("/bookings", "My bookings", <Luggage aria-hidden="true" />, false)}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

export { WorkspaceShell, type WorkspaceNavigation };
