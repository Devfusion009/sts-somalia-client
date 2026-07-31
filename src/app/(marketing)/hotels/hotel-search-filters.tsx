"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function HotelSearchFilters({ initialCity }: { initialCity: string }) {
  const router = useRouter();
  const [city, setCity] = useState(initialCity);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    router.push(`/hotels${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function handleClear() {
    setCity("");
    router.push("/hotels");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <label htmlFor="city" className="text-sm font-medium">
          City
        </label>
        <Input
          id="city"
          placeholder="Mogadishu, Nairobi, Dubai…"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit">
          <Search /> Search
        </Button>
        {initialCity ? (
          <Button type="button" variant="ghost" onClick={handleClear}>
            <X /> Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
