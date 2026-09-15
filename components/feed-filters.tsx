"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { countryLabel, orderCountryFacet, roleLabel } from "@/lib/jobs/format";
import type { Facets, FeedMode, FeedWindow } from "@/lib/jobs/types";

export interface FeedFilterState {
  q?: string;
  role?: string;
  country?: string;
  level?: string;
  window: FeedWindow;
  mode: FeedMode;
}

function toHref(base: string, state: FeedFilterState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.role) params.set("role", state.role);
  if (state.country) params.set("country", state.country);
  if (state.level) params.set("level", state.level);
  if (state.window !== "24h") params.set("window", state.window);
  if (state.mode !== "verified") params.set("mode", state.mode);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {label}
      <Select
        value={value}
        onValueChange={(next) => {
          if (next != null) onChange(next);
        }}
      >
        <SelectTrigger className="w-full bg-card">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function FeedFilters({
  state,
  facets,
  basePath = "/",
}: {
  state: FeedFilterState;
  facets: Facets;
  basePath?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (next: FeedFilterState) => {
    startTransition(() => {
      router.push(toHref(basePath, next));
    });
  };

  const countries = orderCountryFacet(facets.countries, state.country);

  return (
    <Card className={cn(pending && "opacity-80")}>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const q = String(form.get("q") ?? "").trim();
            const next: FeedFilterState = {
              window: state.window,
              mode: state.mode,
            };
            if (q) next.q = q;
            if (state.role) next.role = state.role;
            if (state.country) next.country = state.country;
            if (state.level) next.level = state.level;
            go(next);
          }}
        >
          <Input
            type="search"
            name="q"
            defaultValue={state.q ?? ""}
            placeholder="Search title or company"
            className="min-w-0 flex-1 bg-card"
          />
          <Button type="submit">Search</Button>
        </form>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FilterSelect
            label="Role"
            value={state.role ?? "all"}
            placeholder="All roles"
            options={[
              { value: "all", label: "All roles" },
              ...facets.roles.map((role) => ({
                value: role,
                label: roleLabel(role),
              })),
            ]}
            onChange={(value) => {
              const next: FeedFilterState = {
                window: state.window,
                mode: state.mode,
              };
              if (state.q) next.q = state.q;
              if (value !== "all") next.role = value;
              if (state.country) next.country = state.country;
              if (state.level) next.level = state.level;
              go(next);
            }}
          />
          <FilterSelect
            label="Country"
            value={state.country ?? "all"}
            placeholder="All countries"
            options={[
              { value: "all", label: "All countries" },
              ...countries.map((code) => ({
                value: code,
                label: countryLabel(code),
              })),
            ]}
            onChange={(value) => {
              const next: FeedFilterState = {
                window: state.window,
                mode: state.mode,
              };
              if (state.q) next.q = state.q;
              if (state.role) next.role = state.role;
              if (value !== "all") next.country = value;
              if (state.level) next.level = state.level;
              go(next);
            }}
          />
          <FilterSelect
            label="Level"
            value={state.level ?? "all"}
            placeholder="All levels"
            options={[
              { value: "all", label: "All levels" },
              ...facets.levels.map((level) => ({
                value: level,
                label: level,
              })),
            ]}
            onChange={(value) => {
              const next: FeedFilterState = {
                window: state.window,
                mode: state.mode,
              };
              if (state.q) next.q = state.q;
              if (state.role) next.role = state.role;
              if (state.country) next.country = state.country;
              if (value !== "all") next.level = value;
              go(next);
            }}
          />
          <FilterSelect
            label="Posted within"
            value={state.window}
            placeholder="24 hours"
            options={[
              { value: "24h", label: "24 hours" },
              { value: "48h", label: "48 hours" },
              { value: "7d", label: "7 days" },
            ]}
            onChange={(value) => {
              let window: FeedWindow = "24h";
              switch (value) {
                case "7d":
                  window = "7d";
                  break;
                case "48h":
                  window = "48h";
                  break;
                case "24h":
                  window = "24h";
                  break;
                default:
                  window = "24h";
                  break;
              }
              const next: FeedFilterState = {
                window,
                mode: state.mode,
              };
              if (state.q) next.q = state.q;
              if (state.role) next.role = state.role;
              if (state.country) next.country = state.country;
              if (state.level) next.level = state.level;
              go(next);
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Mode</span>
          <Button
            type="button"
            size="sm"
            variant={state.mode === "verified" ? "default" : "outline"}
            onClick={() => {
              const next: FeedFilterState = {
                window: state.window,
                mode: "verified",
              };
              if (state.q) next.q = state.q;
              if (state.role) next.role = state.role;
              if (state.country) next.country = state.country;
              if (state.level) next.level = state.level;
              go(next);
            }}
          >
            Verified dates
          </Button>
          <Button
            type="button"
            size="sm"
            variant={state.mode === "discovered" ? "default" : "outline"}
            onClick={() => {
              const next: FeedFilterState = {
                window: state.window,
                mode: "discovered",
              };
              if (state.q) next.q = state.q;
              if (state.role) next.role = state.role;
              if (state.country) next.country = state.country;
              if (state.level) next.level = state.level;
              go(next);
            }}
          >
            Discovered
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function LoadMoreLink({
  state,
  cursor,
  basePath = "/",
}: {
  state: FeedFilterState;
  cursor: string;
  basePath?: string;
}) {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.role) params.set("role", state.role);
  if (state.country) params.set("country", state.country);
  if (state.level) params.set("level", state.level);
  if (state.window !== "24h") params.set("window", state.window);
  if (state.mode !== "verified") params.set("mode", state.mode);
  params.set("cursor", cursor);
  return (
    <Link
      href={`${basePath}?${params.toString()}`}
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      Next page
    </Link>
  );
}
