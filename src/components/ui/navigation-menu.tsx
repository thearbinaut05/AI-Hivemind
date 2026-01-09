// src/components/ui/navigation-menu.tsx

import * as React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { ChevronDownIcon } from "@radix-ui/react-icons";

const NavigationMenu = NavigationMenuPrimitive.Root;
const NavigationMenuList = NavigationMenuPrimitive.List;
const NavigationMenuItem = NavigationMenuPrimitive.Item;
const NavigationMenuTrigger = NavigationMenuPrimitive.Trigger;
const NavigationMenuContent = NavigationMenuPrimitive.Content;
const NavigationMenuLink = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Link>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Link>
>((props, ref) => (
  <NavigationMenuPrimitive.Link
    {...props}
    ref={ref}
    className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
      props.className ?? ""
    }`}
  />
));
NavigationMenuLink.displayName = "NavigationMenuLink";

const NavigationMenuIndicator = NavigationMenuPrimitive.Indicator;
const NavigationMenuViewport = NavigationMenuPrimitive.Viewport;

/**
 * NavigationMenuDemo component renders a fully accessible,
 * production-ready navigation menu using Radix UI NavigationMenu primitives.
 * It supports nested submenus with clear keyboard focus styles and transitions.
 */
function NavigationMenuDemo() {
  return (
    <NavigationMenu className="relative z-50 flex w-full justify-center px-4 py-4 bg-white shadow">
      <NavigationMenuList className="flex gap-6">
        <NavigationMenuItem>
          <NavigationMenuTrigger className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2">
            Products
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </NavigationMenuTrigger>
          <NavigationMenuContent className="absolute top-full mt-2 w-60 rounded-md border border-gray-200 bg-white shadow-lg focus:outline-none">
            <ul className="space-y-2 p-4">
              <li>
                <NavigationMenuLink
                  href="/products/analytics"
                  className="block rounded-md px-3 py-2 hover:bg-gray-100"
                >
                  Analytics
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink
                  href="/products/marketing"
                  className="block rounded-md px-3 py-2 hover:bg-gray-100"
                >
                  Marketing
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink
                  href="/products/sales"
                  className="block rounded-md px-3 py-2 hover:bg-gray-100"
                >
                  Sales
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2">
            Solutions
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          </NavigationMenuTrigger>
          <NavigationMenuContent className="absolute top-full mt-2 w-60 rounded-md border border-gray-200 bg-white shadow-lg focus:outline-none">
            <ul className="space-y-2 p-4">
              <li>
                <NavigationMenuLink
                  href="/solutions/startups"
                  className="block rounded-md px-3 py-2 hover:bg-gray-100"
                >
                  Startups
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink
                  href="/solutions/enterprise"
                  className="block rounded-md px-3 py-2 hover:bg-gray-100"
                >
                  Enterprise
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink
                  href="/solutions/agencies"
                  className="block rounded-md px-3 py-2 hover:bg-gray-100"
                >
                  Agencies
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink
            href="/pricing"
            className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            Pricing
          </NavigationMenuLink>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuLink
            href="/docs"
            className="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            Docs
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>

      <NavigationMenuIndicator className="top-full z-10 mt-px h-2 w-2 rotate-45 rounded bg-white shadow-sm" />

      <NavigationMenuViewport
        className="absolute top-full left-0 mt-2 h-[var(--radix-navigation-menu-viewport-height)] w-full origin-top-center overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg transition-[width,_height] duration-300 ease-in-out"
        forceMount
      />
    </NavigationMenu>
  );
}

export default NavigationMenuDemo;
```
