import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Feed" },
  { href: "/saved", label: "Saved" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-border/80 bg-card/50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight text-foreground"
        >
          JobPulse
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/80">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
        <p>JobPulse — remote IT roles with honest date clocks.</p>
        <div className="flex gap-2">
          <Link
            href="/privacy"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Privacy
          </Link>
          <Link
            href="/health"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Health
          </Link>
        </div>
      </div>
    </footer>
  );
}
