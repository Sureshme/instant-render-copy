import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Cable,
  Check,
  CheckCircle2,
  Cloud,
  Gauge,
  Globe,
  Info,
  Lock,
  Network,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MTU Provisioning Console | Console Connect" },
      {
        name: "description",
        content:
          "Provision B2B, cloud on-ramp and internet transit virtual circuits with live MTU guardrails and real-time billing.",
      },
      { property: "og:title", content: "MTU Provisioning Console | Console Connect" },
      {
        property: "og:description",
        content:
          "Provision virtual circuits with live MTU guardrails and real-time billing summary.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProvisioningConsole,
});

type PortId = "SYD-01" | "SIN-02" | "HKG-05";
type ServiceType = "b2b" | "b2c" | "iod";
type CloudId = "aws" | "azure" | "gcp";

const PORTS: {
  id: PortId;
  name: string;
  hardware: string;
  region: string;
  jumbo: boolean;
}[] = [
  {
    id: "SYD-01",
    name: "Sydney SYD-01",
    hardware: "Nexus 9300",
    region: "AU · Equinix SY3",
    jumbo: true,
  },
  {
    id: "SIN-02",
    name: "Singapore SIN-02",
    hardware: "Core Edge",
    region: "SG · Global Switch",
    jumbo: true,
  },
  {
    id: "HKG-05",
    name: "Hong Kong HKG-05",
    hardware: "Legacy Edge",
    region: "HK · MEGA-i",
    jumbo: false,
  },
];

const SERVICES: { id: ServiceType; title: string; subtitle: string; icon: typeof Cable }[] = [
  {
    id: "b2b",
    title: "Business-to-Business",
    subtitle: "B2B Private Link between two access ports",
    icon: Cable,
  },
  {
    id: "b2c",
    title: "Business-to-Cloud",
    subtitle: "B2C Cloud On-Ramp to hyperscaler fabrics",
    icon: Cloud,
  },
  {
    id: "iod",
    title: "Internet On-Demand",
    subtitle: "IOD Public Transit with burstable egress",
    icon: Globe,
  },
];

const CLOUDS: { id: CloudId; name: string; note: string; maxMtu: number }[] = [
  { id: "aws", name: "AWS Direct Connect", note: "Supports 9001 MTU", maxMtu: 9001 },
  {
    id: "azure",
    name: "Microsoft Azure ExpressRoute",
    note: "Enforces 1500 MTU ceiling",
    maxMtu: 1500,
  },
  {
    id: "gcp",
    name: "Google Cloud Interconnect",
    note: "Enforces 1500 MTU default",
    maxMtu: 1500,
  },
];

const BASE_PORT_FEE = 1200;
const BANDWIDTH_FEE = 300;
const JUMBO_FEE = 150;

function StepHeader({
  index,
  title,
  hint,
  done,
}: {
  index: number;
  title: string;
  hint: string;
  done: boolean;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold",
          done
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-border bg-secondary text-muted-foreground",
        )}
      >
        {done ? <Check className="size-4" /> : index}
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur-sm">
      {children}
    </section>
  );
}

function SelectCard({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group w-full rounded-lg border p-4 text-left transition-all",
        "border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/70",
        selected && "border-primary bg-primary/10 panel-glow",
        disabled && "cursor-not-allowed opacity-50 hover:border-border hover:bg-secondary/40",
      )}
    >
      {children}
    </button>
  );
}

function ProvisioningConsole() {
  const [portId, setPortId] = useState<PortId | null>(null);
  const [service, setService] = useState<ServiceType | null>(null);
  const [cloud, setCloud] = useState<CloudId | null>(null);
  const [targetPortId, setTargetPortId] = useState<PortId | null>(null);
  const [jumboRequested, setJumboRequested] = useState(false);
  const [provisioned, setProvisioned] = useState(false);

  const port = PORTS.find((p) => p.id === portId) ?? null;
  const targetPort = PORTS.find((p) => p.id === targetPortId) ?? null;
  const cloudInfo = CLOUDS.find((c) => c.id === cloud) ?? null;

  const guard = useMemo(() => {
    if (!port || !service) {
      return { allowed: false, reason: "pending" as const, maxMtu: 1500 };
    }
    if (!port.jumbo) {
      return { allowed: false, reason: "legacy" as const, maxMtu: 1500 };
    }
    if (service === "iod") {
      return { allowed: false, reason: "iod" as const, maxMtu: 1500 };
    }
    if (service === "b2c") {
      if (!cloudInfo) return { allowed: false, reason: "pending" as const, maxMtu: 1500 };
      if (cloudInfo.maxMtu < 9000) {
        return {
          allowed: false,
          reason: cloudInfo.id === "azure" ? ("azure" as const) : ("gcp" as const),
          maxMtu: 1500,
        };
      }
      return { allowed: true, reason: "ok" as const, maxMtu: 9001 };
    }
    if (!targetPort) return { allowed: false, reason: "pending" as const, maxMtu: 1500 };
    if (!targetPort.jumbo) return { allowed: false, reason: "legacy" as const, maxMtu: 1500 };
    return { allowed: true, reason: "ok" as const, maxMtu: 9000 };
  }, [port, service, cloudInfo, targetPort]);

  const jumboActive = guard.allowed && jumboRequested;
  const effectiveMtu = jumboActive ? guard.maxMtu : 1500;
  const jumboCost = jumboActive ? JUMBO_FEE : 0;
  const total = BASE_PORT_FEE + BANDWIDTH_FEE + jumboCost;

  const destinationReady =
    service === "b2c" ? Boolean(cloud) : service === "b2b" ? Boolean(targetPortId) : service === "iod";
  const readyToProvision = Boolean(port && service && destinationReady);

  const destinationLabel =
    service === "b2c"
      ? (cloudInfo?.name ?? "—")
      : service === "b2b"
        ? (targetPort?.name ?? "—")
        : service === "iod"
          ? "Public Transit Baseline"
          : "—";

  function selectService(id: ServiceType) {
    setService(id);
    setCloud(null);
    setTargetPortId(null);
    setJumboRequested(false);
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-border/70 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border border-primary/40 bg-primary/15 text-primary">
              <Network className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Console Connect</p>
              <p className="font-mono text-xs text-muted-foreground">
                Interconnect &amp; MTU Provisioning
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-success" />
            Fabric status: operational
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Step 1 */}
          <Panel>
            <StepHeader
              index={1}
              title="Select origin access port"
              hint="Choose the physical port terminating your circuit."
              done={Boolean(port)}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {PORTS.map((p) => (
                <SelectCard
                  key={p.id}
                  selected={portId === p.id}
                  onClick={() => {
                    setPortId(p.id);
                    setJumboRequested(false);
                  }}
                >
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {p.hardware} · {p.region}
                  </p>
                  <Badge
                    className={cn(
                      "mt-3 border-none font-mono text-[11px]",
                      p.jumbo
                        ? "bg-success/20 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {p.jumbo ? "Jumbo Capable (9000 MTU)" : "Standard 1500 MTU Only"}
                  </Badge>
                </SelectCard>
              ))}
            </div>
            {portId === "HKG-05" && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                Selected legacy switch hardware does not support &gt;1500 MTU.
              </div>
            )}
          </Panel>

          {/* Step 2 */}
          <Panel>
            <StepHeader
              index={2}
              title="Select service connection type"
              hint="Defines the routing domain of the virtual circuit."
              done={Boolean(service)}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              {SERVICES.map((s) => {
                const Icon = s.icon;
                return (
                  <SelectCard
                    key={s.id}
                    selected={service === s.id}
                    onClick={() => selectService(s.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full border",
                          service === s.id ? "border-primary" : "border-muted-foreground/60",
                        )}
                      >
                        {service === s.id && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      <Icon className="size-4 text-primary" />
                    </div>
                    <p className="mt-3 text-sm font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.subtitle}</p>
                  </SelectCard>
                );
              })}
            </div>
          </Panel>

          {/* Step 3 */}
          <Panel>
            <StepHeader
              index={3}
              title="Destination partner / endpoint"
              hint="Select the far end of the interconnect."
              done={destinationReady}
            />
            {!service && (
              <p className="text-sm text-muted-foreground">
                Select a service connection type to continue.
              </p>
            )}
            {service === "b2c" && (
              <div className="grid gap-3 sm:grid-cols-3">
                {CLOUDS.map((c) => (
                  <SelectCard
                    key={c.id}
                    selected={cloud === c.id}
                    onClick={() => {
                      setCloud(c.id);
                      setJumboRequested(false);
                    }}
                  >
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{c.note}</p>
                  </SelectCard>
                ))}
              </div>
            )}
            {service === "b2b" && (
              <div className="grid gap-3 sm:grid-cols-3">
                {PORTS.map((p) => (
                  <SelectCard
                    key={p.id}
                    selected={targetPortId === p.id}
                    disabled={p.id === portId}
                    onClick={() => {
                      setTargetPortId(p.id);
                      setJumboRequested(false);
                    }}
                  >
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {p.jumbo ? "Jumbo capable" : "1500 MTU only"}
                      {p.id === portId ? " · origin" : ""}
                    </p>
                  </SelectCard>
                ))}
              </div>
            )}
            {service === "iod" && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                <Lock className="size-4 shrink-0" />
                Partner selection disabled — Public Transit Baseline.
              </div>
            )}
          </Panel>

          {/* Step 4 */}
          <Panel>
            <StepHeader
              index={4}
              title="MTU & performance configuration"
              hint="Guardrails enforce the lowest common MTU across the path."
              done={destinationReady}
            />
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4",
                guard.allowed
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-secondary/40",
              )}
            >
              <div className="flex items-start gap-3">
                <Zap
                  className={cn(
                    "mt-0.5 size-5",
                    guard.allowed ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <div>
                  <p className="text-sm font-semibold">
                    Enable High-Throughput Jumbo Frames (9000/9001 MTU)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reduces per-packet overhead for storage replication and bulk transfer.
                  </p>
                </div>
              </div>
              <Switch
                checked={jumboActive}
                disabled={!guard.allowed}
                onCheckedChange={setJumboRequested}
                aria-label="Enable jumbo frames"
              />
            </div>

            {guard.reason === "azure" && (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-warning/50 bg-warning/10 p-4 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <p>
                  <span className="font-semibold">Cloud Provider Constraint:</span> Microsoft Azure
                  ExpressRoute gateways enforce a 1500 MTU maximum. Enabling Jumbo Frames will cause
                  packet fragmentation. Setting locked for network stability.
                </p>
              </div>
            )}
            {guard.reason === "gcp" && (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-warning/50 bg-warning/10 p-4 text-sm text-warning">
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <p>
                  <span className="font-semibold">Cloud Provider Constraint:</span> Google Cloud
                  Interconnect enforces a 1500 MTU default. Jumbo Frames locked for this endpoint.
                </p>
              </div>
            )}
            {(guard.reason === "iod" || guard.reason === "legacy") && (
              <div className="mt-4 flex items-start gap-3 rounded-md border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" />
                Internet transit &amp; legacy ports are locked to 1500 MTU standard.
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricTile
                icon={Gauge}
                label="Effective MTU"
                value={`${effectiveMtu} bytes`}
                accent={jumboActive}
              />
              <MetricTile icon={Activity} label="Port speed" value="10 Gbps" />
              <MetricTile
                icon={ShieldCheck}
                label="Path policy"
                value={guard.allowed ? "Jumbo permitted" : "Standard enforced"}
              />
            </div>
          </Panel>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur panel-glow">
            <h2 className="text-sm font-semibold tracking-tight">Order &amp; Billing Summary</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">Live estimate · USD</p>

            <dl className="mt-5 space-y-3 text-sm">
              <SummaryRow label="Origin port" value={port?.name ?? "—"} mono />
              <SummaryRow
                label="Service"
                value={service ? (SERVICES.find((s) => s.id === service)?.title ?? "—") : "—"}
                mono
              />
              <SummaryRow label="Destination" value={destinationLabel} mono />
              <SummaryRow label="Effective MTU" value={`${effectiveMtu} bytes`} mono />
            </dl>

            <Separator className="my-5" />

            <dl className="space-y-3 text-sm">
              <SummaryRow label="Base Port Fee" value={`$${BASE_PORT_FEE.toLocaleString()} / mo`} />
              <SummaryRow
                label="Bandwidth Fee (10 Gbps)"
                value={`$${BANDWIDTH_FEE} / mo`}
              />
              <SummaryRow
                label="Jumbo Frames Add-on"
                value={jumboActive ? `$${JUMBO_FEE} / mo` : "$0"}
                highlight={jumboActive}
              />
            </dl>

            <Separator className="my-5" />

            <div className="flex items-end justify-between">
              <span className="text-sm text-muted-foreground">Total monthly</span>
              <span className="font-mono text-2xl font-semibold text-primary">
                ${total.toLocaleString()}
              </span>
            </div>

            <Button
              className="mt-6 w-full"
              disabled={!readyToProvision}
              onClick={() => setProvisioned(true)}
            >
              Provision Virtual Circuit
            </Button>
            {!readyToProvision && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Complete steps 1–3 to enable provisioning.
              </p>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={provisioned} onOpenChange={setProvisioned}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-6" />
            </div>
            <DialogTitle>Virtual Circuit Provisioned Successfully!</DialogTitle>
            <DialogDescription>
              Your interconnect is now active on the Console Connect fabric.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-secondary/50 p-4 font-mono text-sm">
            <p>Effective MTU: {effectiveMtu} bytes</p>
            <p className="mt-1">Circuit ID: VC-CC-99042</p>
            <p className="mt-1 text-muted-foreground">
              Monthly recurring: ${total.toLocaleString()}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setProvisioned(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <p
        className={cn(
          "mt-1 font-mono text-sm font-semibold",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right",
          mono && "font-mono text-xs",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
