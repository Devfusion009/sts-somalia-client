import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Clock, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getVisaTypes } from "@/lib/data/visa";
import { countryName } from "@/lib/countries";

export const metadata: Metadata = { title: "Visa Services" };

export default async function VisaListPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const visaTypes = await getVisaTypes({ country });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold">Visa Services</h1>
        <p className="mt-1 text-muted-foreground">
          We handle the paperwork — apply online and track your application status.
        </p>
      </div>

      <form className="mb-8 flex max-w-md gap-2">
        <Input name="country" placeholder="Search by country (e.g. Turkey, UAE)" defaultValue={country} />
        <Button type="submit">
          <Search /> Search
        </Button>
      </form>

      {visaTypes.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {visaTypes.map((visa) => (
            <Link key={visa.id} href={`/visa/${visa.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {countryName(visa.destination_country_code)}
                    </p>
                    <h3 className="font-heading text-lg font-semibold group-hover:text-primary">{visa.name}</h3>
                  </div>
                  {visa.description ? (
                    <p className="flex-1 text-sm text-muted-foreground">{visa.description}</p>
                  ) : (
                    <div className="flex-1" />
                  )}
                  <div className="flex items-center justify-between pt-1 text-sm">
                    {visa.processing_days_min ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3.5" />
                        {visa.processing_days_min}
                        {visa.processing_days_max && visa.processing_days_max !== visa.processing_days_min
                          ? `–${visa.processing_days_max}`
                          : ""}{" "}
                        days
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="font-semibold text-foreground">
                      {visa.currency} {visa.price.toFixed(0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No visa services found{country ? ` for "${country}"` : ""}.{" "}
            <Link href="/visa" className="text-primary hover:underline">
              View all visa services
            </Link>
            .
          </CardContent>
        </Card>
      )}
    </div>
  );
}
