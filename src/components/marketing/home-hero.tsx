"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Building2, Plane, FileText, Landmark, PartyPopper, Search, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function HomeHero() {
  const router = useRouter();
  const [hotelForm, setHotelForm] = useState({ city: "", checkIn: "", checkOut: "", guests: "2" });
  const [flightForm, setFlightForm] = useState({ origin: "", destination: "", departDate: "" });
  const [visaCountry, setVisaCountry] = useState("");

  function submitHotelSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (hotelForm.city) params.set("city", hotelForm.city);
    if (hotelForm.checkIn) params.set("check_in", hotelForm.checkIn);
    if (hotelForm.checkOut) params.set("check_out", hotelForm.checkOut);
    if (hotelForm.guests) params.set("guests", hotelForm.guests);
    router.push(`/hotels?${params.toString()}`);
  }

  function submitFlightSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (flightForm.origin) params.set("origin", flightForm.origin);
    if (flightForm.destination) params.set("destination", flightForm.destination);
    if (flightForm.departDate) params.set("depart_date", flightForm.departDate);
    router.push(`/flights?${params.toString()}`);
  }

  function submitVisaSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (visaCountry) params.set("country", visaCountry);
    router.push(`/visa?${params.toString()}`);
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Your journey starts with{" "}
            <span className="text-primary">Scout Travel Solution</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Flights, hotels, visas, Umrah packages, and event halls — booked with
            confidence, backed by real people in Mogadishu.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card p-2 shadow-lg sm:p-4">
          <Tabs defaultValue="hotels">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="hotels">
                <Building2 /> Hotels
              </TabsTrigger>
              <TabsTrigger value="flights">
                <Plane /> Flights
              </TabsTrigger>
              <TabsTrigger value="visa">
                <FileText /> Visa
              </TabsTrigger>
              <TabsTrigger value="umrah">
                <Landmark /> Umrah
              </TabsTrigger>
              <TabsTrigger value="events">
                <PartyPopper /> Events
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hotels" className="p-2 sm:p-4">
              <form onSubmit={submitHotelSearch} className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="hotel-city">Destination</Label>
                  <Input
                    id="hotel-city"
                    name="hotel-city"
                    autoComplete="off"
                    placeholder="Mogadishu, Nairobi, Dubai…"
                    value={hotelForm.city}
                    onChange={(e) => setHotelForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hotel-checkin">Check-in</Label>
                  <Input
                    id="hotel-checkin"
                    type="date"
                    autoComplete="off"
                    value={hotelForm.checkIn}
                    onChange={(e) => setHotelForm((f) => ({ ...f, checkIn: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hotel-checkout">Check-out</Label>
                  <Input
                    id="hotel-checkout"
                    type="date"
                    autoComplete="off"
                    value={hotelForm.checkOut}
                    onChange={(e) => setHotelForm((f) => ({ ...f, checkOut: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-4">
                  <Button type="submit" className="w-full sm:w-auto">
                    <Search /> Search hotels
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="flights" className="p-2 sm:p-4">
              <form onSubmit={submitFlightSearch} className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="flight-origin">From</Label>
                  <Input
                    id="flight-origin"
                    name="flight-origin"
                    autoComplete="off"
                    placeholder="MGQ"
                    value={flightForm.origin}
                    onChange={(e) => setFlightForm((f) => ({ ...f, origin: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="flight-destination">To</Label>
                  <Input
                    id="flight-destination"
                    name="flight-destination"
                    autoComplete="off"
                    placeholder="DXB"
                    value={flightForm.destination}
                    onChange={(e) => setFlightForm((f) => ({ ...f, destination: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="flight-depart">Departure date</Label>
                  <Input
                    id="flight-depart"
                    type="date"
                    autoComplete="off"
                    value={flightForm.departDate}
                    onChange={(e) => setFlightForm((f) => ({ ...f, departDate: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-4">
                  <Button type="submit" className="w-full sm:w-auto">
                    <Search /> Search flights
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="visa" className="p-2 sm:p-4">
              <form onSubmit={submitVisaSearch} className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-3">
                  <Label htmlFor="visa-country">Destination country</Label>
                  <Input
                    id="visa-country"
                    name="visa-country"
                    autoComplete="off"
                    placeholder="UAE, Turkey, Saudi Arabia…"
                    value={visaCountry}
                    onChange={(e) => setVisaCountry(e.target.value)}
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <Button type="submit" className="w-full">
                    <Search /> Find visas
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="umrah" className="p-2 sm:p-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  <Users className="mr-1 inline size-4" />
                  Browse curated Umrah packages with flights, hotels, and visa included.
                </p>
                <Button render={<Link href="/umrah" />}>Browse packages</Button>
              </div>
            </TabsContent>

            <TabsContent value="events" className="p-2 sm:p-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  <PartyPopper className="mr-1 inline size-4" />
                  Weddings, conferences, and celebrations — book premium halls and venues.
                </p>
                <Button render={<Link href="/events" />}>Explore venues</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}
