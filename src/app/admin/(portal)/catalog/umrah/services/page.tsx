import Link from "next/link";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUmrahServicesAdmin } from "@/modules/umrah/custom-queries";
import {
  PRICE_UNIT_LABELS,
  UMRAH_CATEGORIES,
  UMRAH_TIER_LABELS,
} from "@/modules/umrah/services";
import { formatMoney } from "@/modules/umrah/pricing";
import { NewServiceForm, EditServiceForm, type AdminService } from "./service-forms";

export const metadata = { title: "Private Umrah Services | Admin Console" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  published: "default",
  draft: "secondary",
  suspended: "destructive",
};

/**
 * The price list behind the private Umrah builder. Every row here is one
 * option a customer can tick, and its price and unit are what the running
 * total on /umrah/private multiplies out — so this screen IS the private
 * product, in the same way /admin/catalog/umrah is the group product.
 */
export default async function AdminUmrahServicesPage() {
  const services = (await getUmrahServicesAdmin()) as AdminService[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            render={<Link href="/admin/catalog/umrah" />}
            variant="ghost"
            size="sm"
            className="-ml-2 mb-1 gap-1.5 text-muted-foreground"
          >
            <ArrowLeft className="size-3.5" /> Umrah catalog
          </Button>
          <h1 className="font-heading text-2xl font-semibold">Private Umrah services</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The options customers choose from when they build a private trip, and what each one
            costs. Prices marked <em>per person, per night</em> are multiplied by the travellers and
            the nights in that city; <em>for the whole party</em> is charged once.
          </p>
        </div>
        <NewServiceForm />
      </div>

      {UMRAH_CATEGORIES.map((category) => {
        const rows = services.filter((s) => s.category === category.value);
        return (
          <section key={category.value} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary">
                <category.icon className="size-4" />
              </span>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-base font-semibold">{category.label}</h2>
                <Badge variant="outline">{category.selection === "single" ? "Pick one" : "Pick any"}</Badge>
              </div>
            </div>

            {rows.length === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">
                No options yet — customers will not see this section in the builder.
              </Card>
            ) : (
              <div className="space-y-2">
                {rows.map((service) => (
                  <Card key={service.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {service.name}
                          <Badge variant={STATUS_VARIANT[service.status] ?? "secondary"}>
                            {service.status}
                          </Badge>
                          <Badge variant="secondary">
                            {service.tier ? UMRAH_TIER_LABELS[service.tier] : "All standards"}
                          </Badge>
                          {service.is_default ? (
                            <Badge className="border-transparent bg-primary/10 text-primary">
                              Pre-selected
                            </Badge>
                          ) : null}
                        </p>
                        {service.description ? (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {service.description}
                          </p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {formatMoney(service.price, service.currency)}{" "}
                            {PRICE_UNIT_LABELS[service.price_unit]}
                          </span>
                          {service.star_rating ? (
                            <span className="flex items-center gap-1">
                              <Star className="size-3 fill-brand-gold text-brand-gold" />
                              {service.star_rating}-star
                            </span>
                          ) : null}
                          {service.distance_to_haram_m !== null ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" /> {service.distance_to_haram_m}m from the
                              Haram
                            </span>
                          ) : null}
                          <span>sort {service.sort_order}</span>
                        </p>
                      </div>
                      <EditServiceForm service={service} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
