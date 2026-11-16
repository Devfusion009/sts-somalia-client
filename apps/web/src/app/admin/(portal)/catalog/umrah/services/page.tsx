import { Star } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/ui/card";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { getUmrahServicesAdmin } from "@/modules/umrah/custom-queries";
import {
  PRICE_UNIT_LABELS,
  ROOM_SHARING_LABELS,
  UMRAH_CATEGORIES,
  UMRAH_TIER_LABELS,
} from "@/modules/umrah/services";
import { formatMoney } from "@/modules/umrah/pricing";
import { NewServiceForm, EditServiceForm, type AdminService } from "./service-forms";

export const metadata = { title: "Private Umrah Services" };

/**
 * The price list behind the private Umrah builder. Every row here is one
 * option a customer can tick, and its price and unit are what the running
 * total on /umrah/private multiplies out — so this screen IS the private
 * product, in the same way /admin/catalog/umrah is the group product.
 */
export default async function AdminUmrahServicesPage() {
  const services = (await getUmrahServicesAdmin()) as AdminService[];

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <BackLink href="/admin/catalog/umrah" label="Umrah catalog" />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Private Umrah services</h1>
            <Badge variant="neutral" className="tabular-nums">
              {services.length}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NewServiceForm />
          </div>
        </header>
      </div>

      {UMRAH_CATEGORIES.map((category) => {
        const rows = services.filter((s) => s.category === category.value);
        return (
          <section key={category.value} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-base font-semibold">{category.label}</h2>
              <Badge variant="outline">{category.selection === "single" ? "Pick one" : "Pick any"}</Badge>
            </div>

            <Card className="gap-0 py-0">
              {rows.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">No options</p>
              ) : (
                <ul className="divide-y divide-border">
                  {rows.map((service) => (
                    <li key={service.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {service.name}
                          <Badge variant={statusBadgeVariant(service.status)} className="capitalize">
                            {service.status.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="neutral">
                            {service.tier ? UMRAH_TIER_LABELS[service.tier] : "All standards"}
                          </Badge>
                          {service.is_default ? <Badge variant="info">Pre-selected</Badge> : null}
                        </p>
                        {service.description ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">{service.description}</p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                          <span className="font-semibold text-foreground">
                            {formatMoney(service.price, service.currency)} {PRICE_UNIT_LABELS[service.price_unit]}
                          </span>
                          {[...service.sharing_prices]
                            .sort((a, b) => a.sharing - b.sharing)
                            .map((p) => (
                              <span key={p.sharing}>
                                {ROOM_SHARING_LABELS[p.sharing]}{" "}
                                <span className="font-semibold text-foreground">
                                  {formatMoney(p.price, service.currency)}
                                </span>
                              </span>
                            ))}
                          {service.star_rating ? (
                            <span className="flex items-center gap-1">
                              <Star className="size-3 fill-brand-gold text-brand-gold" aria-hidden="true" />
                              {service.star_rating}-star
                            </span>
                          ) : null}
                          {service.distance_to_haram_m !== null ? (
                            <span>{service.distance_to_haram_m}m from the Haram</span>
                          ) : null}
                          <span>Order {service.sort_order}</span>
                        </p>
                      </div>
                      <EditServiceForm service={service} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        );
      })}
    </div>
  );
}
